# Dynamic Survey Engine (onboarding survey)

Backend cho luồng khảo sát sau đăng ký. Câu hỏi, bước, lựa chọn và điều kiện đều là **dữ liệu trong DB**. Java chỉ chứa phần xử lý theo **loại** câu hỏi.

Engine **không** làm: tính level, gợi ý bài tập, sinh giáo án, trang kết quả. Khi hoàn thành, nó chỉ ghi nhận trạng thái `COMPLETED`.

## 1. Kiến trúc

```
SurveyController / SurveySessionController    chỉ nhận request -> gọi service -> trả response
        │
SurveyService (định nghĩa)   SurveySessionService (phiên, lưu / complete / skip / resume)
        │                              │
        └──────► SurveyDefinitionLoader ◄┘   đọc 1 survey version (3 query) -> SurveyDefinition bất biến
                       │
                SurveyConfigValidator         loại câu hỏi có handler? rules hợp lệ? điều kiện trỏ câu đứng trước?
                       │
                QuestionTypeRegistry ──► QuestionTypeHandler (NUMBER, TEXT, TEXTAREA,
                                          SINGLE_SELECT, MULTIPLE_SELECT, BOOLEAN)
                ConditionParser / Condition   EQ NE IN NOT_IN GT GTE LT LTE AND OR
```

| Package | Nội dung |
|---|---|
| `models` | `Survey`, `SurveyStep`, `AssessmentQuestion`, `AssessmentOption`, `SurveyStepQuestion`, `SurveySession`, `AssessmentAnswer`, `ConfigStatus` |
| `repository` | 7 repository; câu hỏi và option được lấy bằng `join fetch` / `IN (...)` để tránh N+1 |
| `service/survey` | Loader, validator, startup check, `SurveyJson` |
| `service/survey/definition` | Các record bất biến: `SurveyDefinition`, `StepDefinition`, `StepQuestion`, `QuestionDefinition`, `OptionDefinition` |
| `service/survey/questiontype` | Registry và các handler |
| `service/survey/condition` | Parser và evaluator điều kiện, không dùng `eval` |
| `exception/SurveyException` | `{code, message, errors[]}` |

## 2. Database (Flyway `V2__survey_schema.sql`)

Dữ liệu cấu hình khảo sát `CALISHEALTH_ONBOARDING` không được đưa vào migration mà phải nạp vào DB riêng.

| Bảng | Ràng buộc chính |
|---|---|
| `surveys` | `UNIQUE(survey_code, version)`; mỗi `survey_code` chỉ có 1 version `ACTIVE` (dùng generated column `active_marker`) |
| `survey_steps` | `UNIQUE(survey_id, step_code)` |
| `assessment_questions` | `UNIQUE(question_code)`; `question_type` là VARCHAR, không phải ENUM |
| `assessment_options` | `UNIQUE(question_id, option_code)` |
| `survey_step_questions` | `UNIQUE(step_id, question_id)`; `conditional_rules` JSON |
| `survey_sessions` | mỗi user + survey version chỉ có tối đa 1 phiên `IN_PROGRESS` (dùng `in_progress_marker`) |
| `assessment_answers` | `UNIQUE(session_id, question_id)`; `answer_value` JSON đã chuẩn hóa |

- Mọi FK để mặc định RESTRICT, nên không xóa được câu hỏi hay option đã có người trả lời. Muốn tắt thì đổi `status = 'INACTIVE'`, hoặc đặt `is_active = 0` trên bảng liên kết.
- `answer_value` có dạng: NUMBER → `22` / `172.5`; SINGLE_SELECT → `"MALE"`; MULTIPLE_SELECT → `["MUSCLE_UP","HANDSTAND"]` (sắp theo `sort_order` của option); BOOLEAN → `true`; TEXT → `"..."`.
- Lọc MULTIPLE_SELECT: `JSON_CONTAINS(answer_value, '"HANDSTAND"')`. Nếu sau này cần thống kê nặng theo từng option, có thể thêm bảng con `assessment_answer_options`.

## 3. Quy tắc nghiệp vụ

**Trạng thái phiên**

```
IN_PROGRESS ──complete──► COMPLETED   (kết thúc, không sửa được)
IN_PROGRESS ──skip──────► SKIPPED     (giữ nguyên câu trả lời)
SKIPPED     ──resume────► IN_PROGRESS
```

- `POST /api/survey-sessions`: nếu đã có phiên `IN_PROGRESS` (ở bất kỳ version nào) thì trả lại phiên đó với HTTP 200. Nếu chưa có, tạo phiên mới trên version `ACTIVE` và trả HTTP 201. Phiên `COMPLETED` / `SKIPPED` chỉ còn là lịch sử; frontend dùng `GET /api/survey-sessions?surveyCode=` để biết người dùng đã làm onboarding hay chưa.
- Phiên của người khác trả **404 `SESSION_NOT_FOUND`**, giống hệt phiên không tồn tại, để không lộ id hợp lệ.
- `userId` luôn được lấy từ JWT, không bao giờ lấy từ body.

**Lưu câu trả lời** (`PUT .../steps/{stepCode}/answers`)

- Mỗi request là một transaction và khóa dòng phiên (`SELECT ... FOR UPDATE`). Chỉ cần một câu sai là cả request bị từ chối, không lưu gì. Response trả về **toàn bộ** lỗi một lần.
- Chỉ ghi những câu có trong request; các câu khác được giữ nguyên. Gửi lại cùng giá trị thì update tại chỗ, không tạo bản ghi trùng.
- Ba trường hợp được phân biệt rõ:
  - thiếu key `value` → `VALUE_MISSING`;
  - `"value": null` → **xóa** câu trả lời đã lưu;
  - `""` hoặc `[]` → handler quyết định (TEXT: `EMPTY_VALUE`; MULTIPLE_SELECT: so với `minSelections`, mặc định là 1).
- Field lạ như `questionType`, `required`, `validationRules` → `UNKNOWN_FIELD`. Cấu hình chỉ lấy từ DB.

**Câu hỏi có điều kiện**

- Điều kiện được tính trên trạng thái *sau khi* áp dụng request. Nhờ vậy `GOAL_TYPE` và `HEALTH_GOAL` có thể gửi trong cùng một request.
- Trả lời câu đang không thỏa điều kiện → `QUESTION_NOT_APPLICABLE`.
- Khi câu nguồn đổi (ví dụ HEALTH → SKILLS), câu phụ thuộc cũ **không bị xóa tự động**. Nó được đánh dấu `applicable: false` trong `GET session`, và `complete` sẽ từ chối với `ANSWER_NOT_APPLICABLE` cho đến khi frontend gửi `null` cho câu đó. Câu bị ẩn thì không bắt buộc.

**Hoàn thành**: lúc complete, mọi câu bắt buộc đang áp dụng đều phải có câu trả lời, và mọi câu trả lời đều được validate lại theo cấu hình hiện tại. Nếu không đạt, trả `SURVEY_INCOMPLETE` với `errors[].stepCode` và `questionCode`.

**Versioning**: mỗi phiên trỏ đến đúng một dòng `surveys`, tức một version cố định. Version đã `ACTIVE` coi như bất biến. Muốn đổi cấu trúc thì tạo version mới (`DRAFT` → `ACTIVE`, version cũ → `ARCHIVED`). Phiên đang làm vẫn chạy trên version cũ; frontend lấy định nghĩa của version đó qua `GET /api/surveys/{code}?version=N`. Body lưu câu trả lời có thể gửi kèm `surveyVersion`; nếu lệch thì trả `409 SURVEY_VERSION_MISMATCH`.

> Lưu ý: `assessment_questions` dùng chung giữa các version. Nếu cần đổi *ý nghĩa* hoặc rules của một câu đã có người trả lời, hãy tạo câu mới với mã mới (ví dụ `AGE_V2`) và gắn vào version mới, đừng sửa câu cũ.

## 4. API

Tất cả đều cần JWT (`Authorization: Bearer ...`). Không có API quản trị cấu hình; cấu hình chỉ được thay đổi qua migration hoặc DB.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/surveys/{surveyCode}[?version=N]` | Định nghĩa khảo sát gồm các bước, câu hỏi, rules, options và điều kiện |
| POST | `/api/survey-sessions` `{"surveyCode"}` | Bắt đầu phiên, hoặc tiếp tục phiên đang làm (201 / 200) |
| GET | `/api/survey-sessions?surveyCode=` | Lịch sử phiên của tôi |
| GET | `/api/survey-sessions/{id}` | Trạng thái, câu trả lời đã lưu, `currentStepCode` |
| PUT | `/api/survey-sessions/{id}/steps/{stepCode}/answers` | Lưu hoặc sửa câu trả lời của một bước |
| POST | `/api/survey-sessions/{id}/complete` | Hoàn thành |
| POST | `/api/survey-sessions/{id}/skip` | Bỏ qua |
| POST | `/api/survey-sessions/{id}/resume` | Tiếp tục phiên đã bỏ qua |

Mẫu lỗi:

```json
{
  "code": "SURVEY_VALIDATION_FAILED",
  "message": "Some answers are invalid. Nothing was saved.",
  "errors": [
    { "stepCode": "BODY_INFORMATION", "questionCode": "AGE", "code": "VALUE_OUT_OF_RANGE",
      "message": "Value must be between 13 and 100 years" }
  ]
}
```

## 5. Thêm câu hỏi mới chỉ bằng dữ liệu

Ví dụ: thêm câu "Vòng eo (cm)" vào bước `BODY_INFORMATION`, chỉ hiện khi `GOAL_TYPE = HEALTH`. Hãy tạo migration mới, ví dụ `V3__add_waist_question.sql` (lấy số version tiếp theo), và **không sửa migration đã chạy**:

```sql
INSERT INTO assessment_questions (question_code, question_text, question_type, required, validation_rules, unit)
VALUES ('WAIST', 'Waist', 'NUMBER', 0, '{"min": 40, "max": 200, "maxDecimals": 1}', 'cm');

INSERT INTO survey_step_questions (step_id, question_id, sort_order, conditional_rules)
SELECT st.id, q.id, 5, NULL
FROM surveys s JOIN survey_steps st ON st.survey_id = s.id AND st.step_code = 'BODY_INFORMATION'
JOIN assessment_questions q ON q.question_code = 'WAIST'
WHERE s.survey_code = 'CALISHEALTH_ONBOARDING' AND s.version = 1;
```

Điều kiện chỉ được trỏ tới câu đứng **trước** trong khảo sát. `GOAL_TYPE` nằm ở bước 2, nên muốn điều kiện hóa `WAIST` theo nó thì phải đặt `WAIST` ở bước 2 trở đi.

Không cần đụng tới Controller, Service hay API. Khi khởi động lại, `SurveyConfigStartupCheck` sẽ log `configuration OK`, hoặc chỉ ra lỗi cấu hình.

Thêm câu chọn với option:

```sql
INSERT INTO assessment_options (question_id, option_code, option_label, sort_order)
SELECT id, 'MORNING', 'Morning', 1 FROM assessment_questions WHERE question_code = 'PREFERRED_TIME';
```

## 6. Cấu hình điều kiện

```json
{"operator": "EQ", "questionCode": "GOAL_TYPE", "value": "SKILLS"}
{"operator": "IN", "questionCode": "TRAINING_EXPERIENCE", "value": ["MONTHS_6_TO_12", "OVER_1_YEAR"]}
{"operator": "GTE", "questionCode": "AGE", "value": 50}
{"operator": "AND", "conditions": [
  {"operator": "EQ", "questionCode": "GOAL_TYPE", "value": "HEALTH"},
  {"operator": "OR", "conditions": [
    {"operator": "GT", "questionCode": "WEIGHT", "value": 90},
    {"operator": "EQ", "questionCode": "HEALTH_GOAL", "value": "LOSE_WEIGHT"}]}]}
```

- Nếu câu nguồn chưa được trả lời, mọi phép so sánh đều cho `false` (kể cả `NE` / `NOT_IN`).
- Nếu câu nguồn là MULTIPLE_SELECT: `EQ` nghĩa là "có chứa", `IN` nghĩa là "có giao nhau".
- Các trường hợp sau làm cấu hình bị từ chối (`SURVEY_CONFIG_INVALID`): operator lạ, key lạ, lồng sâu hơn 8 cấp, trỏ tới câu đứng sau hoặc chính nó.

## 7. Thêm một loại câu hỏi mới

Ví dụ thêm `RATING` (1..N sao). **Chỉ cần thêm một file**; registry, service, controller và các handler cũ đều giữ nguyên:

```java
@Component
public class RatingQuestionType extends AbstractQuestionTypeHandler {
    @Override public String type() { return "RATING"; }

    @Override protected Set<String> ruleKeys() { return Set.of("maxStars"); }

    @Override
    protected void validateRules(QuestionDefinition q, List<String> problems) {
        intRule(q, "maxStars", 1, problems);
    }

    @Override
    public AnswerCheck check(QuestionDefinition q, JsonNode value) {
        Integer max = intRule(q, "maxStars", 1, ignoredProblems());
        int maxStars = max == null ? 5 : max;
        if (!value.isIntegralNumber()) return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Rating must be a whole number");
        if (value.intValue() < 1 || value.intValue() > maxStars)
            return AnswerCheck.fail(AnswerCheck.VALUE_OUT_OF_RANGE, "Rating must be 1.." + maxStars);
        return AnswerCheck.ok(SurveyJson.nodes().numberNode(value.intValue()));
    }
}
```

Sau đó dùng `question_type = 'RATING'` trong DB. Test `QuestionTypeRegistryTest.newTypeWorksJustByRegisteringAHandler` chứng minh luồng này với đúng class trên. Khi chưa có handler, mọi câu `RATING` đều bị `SurveyConfigValidator` từ chối, không có chuyện chấp nhận âm thầm.

Các loại dự kiến chưa làm trong MVP: SCALE, RATING, DATE, TIME, DATETIME, RANGE, FILE_UPLOAD, IMAGE_SELECT. Riêng FILE_UPLOAD sẽ cần thêm một endpoint upload riêng trả về `fileId`; khi đó câu trả lời chỉ lưu `fileId`.

## 8. Test

- Unit test (không cần DB): `QuestionTypeHandlersTest`, `QuestionTypeRegistryTest`, `ConditionTest`, `SurveyConfigValidatorTest`, `SurveyDtosJsonTest`, `SurveySessionServiceTest`.
  ```powershell
  .\mvnw.cmd test "-Dtest=QuestionTypeHandlersTest,QuestionTypeRegistryTest,ConditionTest,SurveyConfigValidatorTest,SurveyDtosJsonTest,SurveySessionServiceTest"
  ```
- API end-to-end: xem `postman/README-Survey.md`.
