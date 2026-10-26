# Survey management (Content Manager) – Backend

Thiết kế backend cho màn **Survey management**, nơi Content Manager quản lý các bước của khảo sát đăng ký. Tài liệu này chỉ mô tả BE.

- **Base URL:** `/api/content/surveys/{surveyCode}/steps`, ví dụ `surveyCode = CALISHEALTH_ONBOARDING`
- **Quyền:** JWT có role `CONTENT_MANAGER`. Toàn bộ `/api/content/**` đã được chặn theo role này trong `SecurityConfig`.
- **Query `version` (tùy chọn, mọi endpoint):** chọn survey version cần thao tác. Bỏ trống thì dùng version `ACTIVE`, nếu không có thì dùng version `DRAFT` mới nhất. Version `ARCHIVED` chỉ đọc được.
- **Lỗi:** cùng format với Survey Engine: `{"code": "...", "message": "...", "errors": [...]}`.

---

## 1. Danh sách chức năng

| # | Chức năng trên màn | Method & path | Thành công |
|---|---|---|---|
| F1 | Danh sách bước, tìm theo tên, lọc theo tab trạng thái, đếm số bước mỗi tab | `GET /steps?search=&status=` | 200 |
| F2 | Xem chi tiết 1 bước (dữ liệu cho pop-up Update step) | `GET /steps/{stepId}` | 200 |
| F3 | **Create step** | `POST /steps` | 201 |
| F4 | **Edit** (pop-up Update step → **Save changes**): tên, mô tả, trạng thái, câu hỏi (thứ tự, Required, thêm, gỡ) | `PUT /steps/{stepId}` | 200 |
| F4a | Pop-up Update step → **Add question**: câu hỏi có thể thêm | `GET /steps/{stepId}/available-questions?search=` | 200 |
| F5 | **Preview**: bước như member sẽ thấy, có số "Step n of m" | `GET /steps/{stepId}/preview` | 200 |
| F5a | Pop-up Preview → **Continue**: kiểm tra thử câu trả lời, không lưu gì | `POST /steps/{stepId}/preview/check` | 200 |
| F6 | **⋮**: Activate / Deactivate | `PUT /steps/{stepId}/status` | 200 |
| F7 | **⋮**: Delete | `DELETE /steps/{stepId}` | 204 |
| F8 | **Save order** sau khi kéo thả | `PUT /steps/order` | 200 |
| F9 | **Configure** bước Result: đọc cấu hình | `GET /steps/{stepId}/result-config` | 200 |
| F10 | **Configure** bước Result: lưu cấu hình | `PUT /steps/{stepId}/result-config` | 200 |
| F11 | (Member) định nghĩa khảo sát trả thêm `result` | `GET /api/surveys/{surveyCode}` | 200 |

---

## 2. Chi tiết từng chức năng

### F1 – Danh sách bước

`GET /api/content/surveys/CALISHEALTH_ONBOARDING/steps?search=goal&status=ACTIVE`

| Param | Ý nghĩa |
|---|---|
| `search` | Lọc theo tên bước: chứa chuỗi, không phân biệt hoa thường, tối đa 100 ký tự. |
| `status` | `ACTIVE` \| `DRAFT` \| `INACTIVE`. Bỏ trống tương ứng tab **All**. |

```json
{
  "survey": { "surveyCode": "CALISHEALTH_ONBOARDING", "surveyName": "CalisHealth onboarding survey", "version": 1, "status": "ACTIVE" },
  "counts": { "all": 5, "active": 5, "draft": 0, "inactive": 0 },
  "steps": [
    {
      "id": 1, "stepCode": "BODY_INFORMATION", "stepName": "Body information",
      "description": "Collect height, weight and other basic body measurements.",
      "stepType": "QUESTIONS", "status": "ACTIVE", "position": 1,
      "questionCount": 4, "questionTypes": ["SINGLE_SELECT", "NUMBER"],
      "updatedAt": "2026-10-23T10:00:00"
    },
    {
      "id": 5, "stepCode": "RESULT_AND_RECOMMENDED_PLAN", "stepName": "Result and recommended plan",
      "stepType": "RESULT", "status": "ACTIVE", "position": 5,
      "questionCount": 0, "questionTypes": [], "updatedAt": "2026-10-22T10:00:00"
    }
  ]
}
```

- `position` là số **STEP n** tính trên toàn survey. Số này giữ nguyên khi tìm kiếm hay lọc.
- `counts` đã áp dụng `search` nhưng **không** áp dụng `status`, để mỗi tab luôn hiện đúng số của nó.
- `questionCount` / `questionTypes` chỉ tính những câu hỏi member thực sự thấy, tức là cả liên kết và câu hỏi đều ACTIVE. FE tự đổi mã loại sang nhãn, ví dụ `NUMBER` thành "Numeric input", `SINGLE_SELECT` thành "Single choice".
- Với bước RESULT, dòng tóm tắt "System output · Uses the level criteria" do FE hiển thị dựa vào `stepType = RESULT`.
- `updatedAt` lấy mốc mới nhất giữa lần sửa nội dung bước và lần sửa câu hỏi thuộc bước. FE tự đổi thành "Updated 2 days ago". **Kéo thả đổi thứ tự không cập nhật mốc này.**

### F2 – Chi tiết bước

`GET /steps/{stepId}` trả `{ step: <StepSummary>, questions: [...], resultConfig }`.
`questions` liệt kê cả câu hỏi đang tắt (`active: false`) để Content Manager thấy đủ. Mỗi phần tử gồm `questionCode, questionText, questionType, required, sortOrder, active, conditionalRules`.

### F3 – Create step

```json
POST /steps
{ "stepName": "Mobility check", "description": "Check joint mobility.", "stepCode": null, "stepType": null }
```

- `stepCode` có thể bỏ trống. Khi đó BE tự sinh từ tên: bỏ dấu tiếng Việt, viết hoa, đổi ký tự lạ thành `_`, nếu trùng thì thêm `_2`, `_3`… Ví dụ "Mục tiêu & động lực" thành `MUC_TIEU_DONG_LUC`. Nếu client tự gửi thì phải khớp `^[A-Z][A-Z0-9_]{1,63}$`.
- `stepType` mặc định là `QUESTIONS`. Chỉ tạo được `RESULT` khi survey chưa có bước RESULT nào.
- Bước mới luôn ở trạng thái **DRAFT**, nên member chưa thấy.
- Vị trí: bước QUESTIONS được chèn **ngay trước bước RESULT**. Bước RESULT luôn đứng cuối và có sẵn cấu hình mặc định.
- Tên bước không được trùng trong cùng survey (không phân biệt hoa thường).

### F4 – Edit (pop-up Update step → Save changes)

Mở pop-up: gọi F2 `GET /steps/{stepId}`. Mỗi câu hỏi trả `required` (đã tính ghi đè), `requiredByDefault`, `unit` và `validationRules`, đủ để hiện dòng "Numeric input · 100 to 250 cm". Response cũng có `step.revision`.

Bấm **Save changes**: một request lưu **toàn bộ** pop-up trong 1 transaction. Lỗi ở bất kỳ phần nào thì không lưu gì.

```json
PUT /steps/{stepId}
{
  "revision": 3,
  "stepName": "Body information",
  "description": "Collect height, weight and other basic body measurements.",
  "status": "ACTIVE",
  "questions": [
    { "questionCode": "HEIGHT", "required": true },
    { "questionCode": "WEIGHT", "required": true }
  ]
}
```

| Field | Quy tắc |
|---|---|
| `revision` | Bắt buộc. Gửi lại đúng `step.revision` đã đọc lúc mở pop-up. Nếu có người khác lưu bước này trước đó: `409 STEP_MODIFIED`, FE cần tải lại thay vì ghi đè. `revision` tăng 1 mỗi lần nội dung bước đổi; kéo thả thứ tự (F8) **không** làm tăng. |
| `stepName` | Bắt buộc, tối đa 255 ký tự, không trùng tên bước khác trong survey. `stepCode` **không đổi được**, vì phiên khảo sát tham chiếu bước bằng mã này. |
| `description` | Tối đa **150** ký tự (bộ đếm "57 / 150" trên màn). Chuỗi trắng được lưu thành null. |
| `status` | Tab Active / Draft / Inactive. Luật giống F6: không quay về DRAFT sau khi đã publish; bước ACTIVE phải có ít nhất 1 câu hỏi ACTIVE. |
| `questions` | Danh sách **cuối cùng** của bước, theo đúng thứ tự kéo thả (tối đa 50). Mỗi câu gồm `questionCode` và trạng thái nút `required`. |

Cách BE xử lý `questions`:

- **Thêm câu hỏi:** câu phải tồn tại trong ngân hàng câu hỏi, đang ACTIVE, và **chưa dùng ở bước khác** của survey, vì mỗi câu hỏi chỉ xuất hiện 1 lần trong một survey.
- **Gỡ câu hỏi (nút ✕):**
  - Câu đã có member trả lời: BE chỉ **tắt** liên kết. Câu trả lời cũ được giữ nguyên, đúng dòng "Answers members already gave stay the same" trên màn.
  - Câu chưa ai trả lời: BE xóa liên kết. Câu hỏi vẫn còn trong ngân hàng.
  - Thêm lại một câu đã bị tắt thì liên kết cũ được bật lại.
- **Required:** chỉ ghi đè **trong bước này** (cột `survey_step_questions.required`), không đổi câu hỏi gốc trong ngân hàng. Nếu giá trị trùng với mặc định của ngân hàng thì lưu null. Luồng member dùng ngay giá trị mới.
- **Lỗi câu hỏi được gom chung:** mọi lỗi câu hỏi trả về một lần dưới dạng `400 INVALID_STEP_QUESTIONS`, kèm `errors[]` theo từng câu: `DUPLICATE_QUESTION`, `QUESTION_NOT_FOUND`, `QUESTION_IN_OTHER_STEP`, `QUESTION_INACTIVE`.
- **Kiểm tra cấu hình:** BE kiểm tra lại cấu hình survey. Ví dụ: gỡ `GOAL_TYPE` trong khi `HEALTH_GOAL` có điều kiện dựa trên câu này, hoặc kéo `HEALTH_GOAL` lên trước `GOAL_TYPE`, sẽ nhận `409 SURVEY_CONFIG_CONFLICT`.
- Bước RESULT không dùng endpoint này: `400 RESULT_STEP_NOT_EDITABLE`, cần dùng F10.

### F4a – Add question

`GET /steps/{stepId}/available-questions?search=height` trả danh sách:

```json
[{ "questionCode": "HEIGHT", "questionText": "What is your height?", "questionType": "NUMBER",
   "required": true, "unit": "cm", "validationRules": { "min": 100, "max": 250, "maxDecimals": 1 },
   "optionCount": 0, "inCurrentStep": true }]
```

- Danh sách gồm câu hỏi ACTIVE trong ngân hàng, **trừ câu đang dùng ở bước khác** của survey.
- `inCurrentStep = true` nghĩa là câu đang nằm trong bước này. FE dùng cờ này để disable nút thêm.
- `search` lọc theo mã hoặc nội dung câu hỏi, tối đa 100 ký tự.
- Tạo câu hỏi **mới** vào ngân hàng chưa nằm trong phạm vi này (xem mục 7).

### F5 – Preview

`GET /steps/{stepId}/preview` trả `{ step, memberStepNumber, memberStepCount, visibleToMembers, questions, resultConfig }`.

- `memberStepNumber` / `memberStepCount` dùng cho dòng **"Step 1 of 4"** và thanh tiến trình. BE đánh số trên các bước câu hỏi mà member thấy (ACTIVE). Bước đang xem luôn được tính vào, đúng vị trí của nó, kể cả khi đang DRAFT. Bước RESULT có cả hai giá trị là `null`.
- `visibleToMembers = false` khi bước chưa ACTIVE, để FE hiện nhãn cảnh báo.
- `questions` có cùng format với API member `GET /api/surveys/{code}`: câu hỏi và lựa chọn ACTIVE, `required` đã tính ghi đè, `unit`, `validationRules` (để hiện "Between 100 and 250 cm"), `displayConfig`, `defaultValue` và điều kiện hiển thị. Nhờ vậy FE dùng lại được component của member.
- Với bước RESULT: `questions = []` và `resultConfig` có dữ liệu.
- Preview **không ghi gì** vào DB.

### F5a – Preview → Continue (kiểm tra thử)

```json
POST /steps/{stepId}/preview/check
{ "answers": [ { "questionCode": "HEIGHT", "value": 170 }, { "questionCode": "WEIGHT", "value": 65 } ] }
```

Response: `{ "valid": false, "errors": [ { "stepCode": "BODY_INFORMATION", "questionCode": "AGE", "code": "VALUE_OUT_OF_RANGE", "message": "..." } ] }`

- **Luôn trả 200.** Kết quả nằm ở `valid`, vì đây là thao tác kiểm tra chứ không phải lưu. BE không tạo phiên và không lưu câu trả lời.
- BE dùng **đúng luật** của luồng member: kiểm tra kiểu dữ liệu và rules (`VALUE_OUT_OF_RANGE`, `TOO_MANY_DECIMALS`, `INVALID_OPTION`…), câu bắt buộc chưa trả lời (`MISSING_REQUIRED_ANSWER`), câu bị ẩn theo điều kiện (`QUESTION_NOT_APPLICABLE`), câu không thuộc bước (`QUESTION_NOT_IN_STEP`).
- Điều kiện hiển thị chỉ được đánh giá khi câu nguồn nằm trong chính bước này. Câu có điều kiện trỏ sang bước khác được coi là hiển thị, vì Preview không có câu trả lời của bước trước.
- Gọi trên bước RESULT sẽ nhận `400 NOT_A_QUESTION_STEP`.

### F6 – Đổi trạng thái (menu ⋮)

`PUT /steps/{stepId}/status` với body `{ "status": "ACTIVE" | "INACTIVE" }`

```
DRAFT ──► ACTIVE ◄──► INACTIVE
  └──────────────────►┘
```

- Bước đã publish (ACTIVE hoặc INACTIVE) **không quay lại DRAFT** được: `409 INVALID_STATUS_TRANSITION`.
- Bước QUESTIONS phải có ít nhất 1 câu hỏi ACTIVE mới được ACTIVE, nếu không sẽ nhận `409 STEP_HAS_NO_QUESTIONS`.
- Gửi đúng trạng thái hiện tại thì BE trả 200 và không thay đổi gì.
- BE kiểm tra lại cấu hình survey. Ví dụ: tắt bước 2 trong khi câu hỏi ở bước 3 có điều kiện trỏ tới câu hỏi của bước 2 sẽ nhận `409 SURVEY_CONFIG_CONFLICT`, kèm danh sách lỗi trong `errors`, và không có gì được lưu.

### F7 – Delete (menu ⋮)

`DELETE /steps/{stepId}` trả `204`.

Chỉ xóa được khi bước thỏa **cả 3 điều kiện** sau:
1. Không phải bước RESULT (`409 RESULT_STEP_NOT_DELETABLE`).
2. Không ở trạng thái ACTIVE (`409 STEP_ACTIVE`). Cần Deactivate trước.
3. Chưa có member nào trả lời câu hỏi của bước trong version này (`409 STEP_IN_USE`). Trường hợp này chỉ nên chuyển INACTIVE để giữ dữ liệu.

Khi xóa, BE chỉ gỡ liên kết câu hỏi. Câu hỏi vẫn còn trong ngân hàng câu hỏi. Sau khi xóa, thứ tự các bước được đánh lại liên tục 1..n.

### F8 – Save order

`PUT /steps/order` với body `{ "stepIds": [2, 1, 3, 4, 5] }`. Response giống F1.

- `stepIds` phải chứa **đúng toàn bộ** bước của survey, mỗi bước đúng 1 lần.
  - Có id bị trùng: `400 DUPLICATE_STEP`.
  - Thiếu hoặc thừa bước, ví dụ vì người khác vừa thêm/xóa bước: `409 STEP_ORDER_STALE`. FE cần tải lại danh sách thay vì ghi đè.
- Bước RESULT phải đứng cuối: `400 RESULT_STEP_MUST_BE_LAST`.
- BE kiểm tra lại cấu hình survey. Ví dụ: kéo bước chứa `HEALTH_GOAL` lên trước bước chứa `GOAL_TYPE`, khiến điều kiện trỏ tới câu hỏi đứng sau, sẽ nhận `409 SURVEY_CONFIG_CONFLICT`.

### F9 / F10 – Configure bước Result

`GET /steps/{stepId}/result-config` trả `{ step, config, fitnessLevels: [{id, name}] }`.

```json
PUT /steps/{stepId}/result-config
{
  "stepName": "Result and recommended plan",
  "description": "Classify the member's level and build the recommended plan.",
  "config": {
    "showLevelBreakdown": true,
    "showPlanPreview": true,
    "planDurationWeeks": 4,
    "sessionsPerWeek": 3,
    "minutesPerSession": 30,
    "fallbackFitnessLevelId": 1
  }
}
```

| Field | Ràng buộc | Ý nghĩa |
|---|---|---|
| `showLevelBreakdown` | bắt buộc | Hiện chi tiết cách xếp level từ kết quả level test |
| `showPlanPreview` | bắt buộc | Hiện lịch tập gợi ý (pop-up Training plan preview) |
| `planDurationWeeks` | 1–52 | Độ dài kế hoạch gợi ý |
| `sessionsPerWeek` | 1–7 | Số buổi tập mỗi tuần |
| `minutesPerSession` | 10–180 | Thời lượng mỗi buổi |
| `fallbackFitnessLevelId` | null hoặc id có trong `fitness_levels` | Level gán khi member bỏ qua level test hoặc không đạt tiêu chí nào |

- Gọi vào bước không phải RESULT sẽ nhận `400 NOT_A_RESULT_STEP`. Level không tồn tại sẽ nhận `400 FITNESS_LEVEL_NOT_FOUND`.
- Nếu `result_config` trong DB hỏng, GET trả về cấu hình mặc định để Content Manager lưu lại cho đúng.

### F11 – Ảnh hưởng tới API member

`GET /api/surveys/{surveyCode}` có thêm field `result`:

```json
"result": { "stepCode": "RESULT_AND_RECOMMENDED_PLAN", "stepName": "...", "description": "...", "config": { ... } }
```

- Bước RESULT **không** nằm trong `steps` và không tham gia luồng trả lời hay complete của phiên. Vì vậy collection Postman Survey cũ vẫn thấy đúng 4 bước.
- `result` là `null` nếu survey chưa có bước RESULT hoặc bước RESULT đang không ACTIVE.

---

## 3. Quy tắc chung

1. **Chống ghi đồng thời:** mọi thao tác ghi khóa dòng survey bằng `SELECT … FOR UPDATE`, nên hai Content Manager thao tác cùng lúc trên một survey sẽ được xử lý lần lượt. Thứ tự bước và kiểm tra cấu hình vì thế không bị xen nhau.
2. **Không làm hỏng khảo sát đang chạy:** F6 và F8 chạy lại `SurveyConfigValidator` trước khi commit. BE chỉ chặn lỗi **mới** do chính thay đổi đó gây ra. Lỗi đã có từ trước không chặn, để Content Manager vẫn sửa được một survey đang lỗi.
3. **Không xóa dữ liệu member đã dùng:** bước đã có câu trả lời chỉ chuyển INACTIVE được, không xóa được.
4. **Bước RESULT:** mỗi survey có tối đa 1 bước RESULT (DB có UNIQUE), không có câu hỏi, luôn đứng cuối, không xóa được, và chỉ sửa qua Configure.
5. **Audit:** `updated_at` và `updated_by` được ghi lại mỗi khi nội dung bước thay đổi.
6. Bước ở survey version khác trả về `404 STEP_NOT_FOUND`, tức là không lộ id của survey khác.

### Bảng mã lỗi

| HTTP | code | Khi nào |
|---|---|---|
| 400 | `INVALID_REQUEST` | Body hoặc param sai (thiếu tên, sai pattern `stepCode`, config vượt khoảng, `search` quá 100 ký tự…) |
| 400 | `DUPLICATE_STEP` | `stepIds` có id trùng |
| 400 | `RESULT_STEP_MUST_BE_LAST` | Save order đặt RESULT không ở cuối |
| 400 | `RESULT_STEP_NOT_EDITABLE` | Gọi Edit trên bước RESULT |
| 400 | `NOT_A_RESULT_STEP` | Gọi Configure trên bước QUESTIONS |
| 400 | `FITNESS_LEVEL_NOT_FOUND` | `fallbackFitnessLevelId` không tồn tại |
| 400 | `INVALID_STEP_QUESTIONS` | Save changes có câu hỏi không hợp lệ (chi tiết từng câu nằm trong `errors`) |
| 400 | `NOT_A_QUESTION_STEP` | Preview check trên bước RESULT |
| 409 | `STEP_MODIFIED` | Save changes với `revision` cũ (người khác vừa lưu) |
| 401 | `UNAUTHORIZED` | Token hợp lệ nhưng user đã bị xóa |
| 403 | – | Không có role CONTENT_MANAGER |
| 404 | `SURVEY_NOT_FOUND` / `STEP_NOT_FOUND` | Không tìm thấy survey/version hoặc bước |
| 409 | `SURVEY_ARCHIVED` | Ghi vào version đã ARCHIVED |
| 409 | `STEP_NAME_EXISTS` / `STEP_CODE_EXISTS` | Trùng tên hoặc mã bước trong survey |
| 409 | `RESULT_STEP_EXISTS` | Tạo bước RESULT thứ hai |
| 409 | `INVALID_STATUS_TRANSITION` | Đưa bước đã publish về DRAFT |
| 409 | `STEP_HAS_NO_QUESTIONS` | Activate bước chưa có câu hỏi ACTIVE |
| 409 | `STEP_ACTIVE` / `STEP_IN_USE` / `RESULT_STEP_NOT_DELETABLE` | Không xóa được bước |
| 409 | `STEP_ORDER_STALE` | Danh sách bước đã thay đổi kể từ lúc tải |
| 409 | `SURVEY_CONFIG_CONFLICT` | Thay đổi làm hỏng cấu hình survey (chi tiết nằm trong `errors`) |

---

## 4. Thay đổi database – `V4__survey_step_management.sql`

Không tạo bảng mới, chỉ mở rộng bảng `survey_steps`:

| Cột / ràng buộc | Mô tả |
|---|---|
| `step_type VARCHAR(16)` | `QUESTIONS` (mặc định) \| `RESULT` |
| `result_config JSON` | Cấu hình bước RESULT. CHECK: chỉ bước RESULT được có giá trị |
| `status` | Thêm `DRAFT`, mặc định là `DRAFT` cho bước mới |
| `created_at`, `updated_at`, `updated_by → users.id` | Audit. `updated_at` do service tự đặt, **không** dùng ON UPDATE |
| `result_marker` + `UNIQUE (survey_id, result_marker)` | Đảm bảo mỗi survey có tối đa 1 bước RESULT |

Dữ liệu cũ: các bước hiện có được gán `QUESTIONS` và giữ nguyên trạng thái.

### `V5__survey_step_edit.sql` (pop-up Update step)

| Cột | Mô tả |
|---|---|
| `survey_step_questions.required BIT NULL` | Ghi đè cờ bắt buộc của câu hỏi trong bước. NULL = dùng `assessment_questions.required` |
| `survey_steps.revision INT` | Số phiên bản nội dung bước, dùng để chặn ghi đè khi 2 người cùng sửa |

> Nếu nhánh khác (ví dụ Library) cũng thêm migration `V4__…` hoặc `V5__…`, cần đổi số version của một trong hai file trước khi merge.

## 5. Seed dữ liệu

File [seed_survey_management.sql](seed_survey_management.sql) được chạy **thủ công** trên MySQL, sau khi backend đã chạy migration:

1. Đăng ký 1 tài khoản, sau đó sửa `@cm_email` ở đầu file.
2. Chạy file. Script sẽ nâng tài khoản lên `CONTENT_MANAGER`, tạo 3 fitness level, và tạo survey `CALISHEALTH_ONBOARDING` v1 với 5 bước như trên màn hình (4 bước câu hỏi và 1 bước Result).
3. Khởi động lại backend. Log phải có `Survey CALISHEALTH_ONBOARDING v1 configuration OK`.

DB đã có survey này thì chạy khối **RESET** (đang comment) ở cuối file trước. Khối này xóa cả phiên và câu trả lời, nên chỉ dùng ở môi trường local/dev.

## 6. Mã nguồn

| File | Vai trò |
|---|---|
| `controllers/ContentSurveyStepController.java` | Endpoint F1–F10 |
| `service/SurveyStepManagementService.java` | Nghiệp vụ, khóa, kiểm tra cấu hình |
| `dtos/SurveyStepManagementDtos.java` | Request / response |
| `dtos/SurveyDtos.java` | Thêm `ResultConfig`, `ResultStepResponse`, field `result` |
| `models/SurveyStep.java` | Thêm `Status` (DRAFT), `Type`, `resultConfig`, audit |
| `service/survey/SurveyDefinitionLoader.java` | `findProblems()`, bỏ bước RESULT khỏi luồng member |
| `service/SurveyService.java` | Trả `result` cho member |
| `repository/*` | Query mới: khóa survey, câu hỏi theo bước, đếm câu trả lời, `FitnessLevelRepository` |
| `test/.../SurveyStepManagementServiceTest.java` | 30 unit test cho các quy tắc ở trên |
| `postman/CalisHealth-SurveyManagement.postman_collection.json` | 67 request kèm assertion, chạy bằng Collection Runner |

## 7. Ngoài phạm vi màn này

Pop-up Update step đã quản lý được **câu hỏi trong bước**: thêm từ ngân hàng câu hỏi, gỡ, sắp xếp, bật/tắt Required.

Các phần sau cần màn riêng nên chưa làm:
- Tạo hoặc sửa **câu hỏi mới** trong ngân hàng (nội dung, loại, rules, lựa chọn).
- Sửa **điều kiện hiển thị**.

Câu hỏi hiện có được nạp qua file seed.

## 8. Chấm level sau onboarding (member) – `V6__level_assessment_rules.sql`

Khi member hoàn thành khảo sát (`POST /api/survey-sessions/{id}/complete`), backend chấm level theo **bộ luật lưu trong DB**. Java chỉ có thuật toán chung (`LevelRuleEvaluator`), không chứa ngưỡng của bài tập nào.

| Bảng | Nội dung |
|---|---|
| `level_rule_sets` | 1 bộ luật / `survey_code`, có version như `surveys` (DRAFT → ACTIVE → ARCHIVED), `scoring_method` = `WEIGHTED_AVERAGE` \| `MINIMUM` |
| `level_rule_criteria` | Tiêu chí = 1 câu hỏi NUMBER (vd `PUSH_UP_MAX_REPS`), `weight`, `required` |
| `level_rule_bands` | Khoảng `[min_value, max_value)` → `score` + level của bài đó, `band_label` (vd "Limited"), `applies_when` = điều kiện theo câu trả lời khác (cùng cú pháp `conditional_rules`, vd tách theo `GENDER` / `AGE`) |
| `level_rule_outcomes` | Điểm tổng ≥ `min_score` → fitness level; `sort_order` = thứ hạng; `summary` + `recommendation` (JSON kế hoạch gợi ý) |
| `survey_level_results` | Kết quả của 1 phiên: level, điểm, `method` (`RULES` \| `FALLBACK` \| `NONE`), `breakdown` = ảnh chụp toàn bộ màn Result |

Thuật toán:
1. Mỗi tiêu chí lấy khoảng **đầu tiên** (theo `sort_order`) có `applies_when` thỏa và chứa giá trị → điểm.
2. Điểm tổng: trung bình có trọng số (hoặc điểm thấp nhất với `MINIMUM`).
3. Level là mốc có `min_score` cao nhất mà điểm tổng đạt được.
4. Không chấm được thì dùng `fallbackFitnessLevelId` của bước Result. Lý do được lưu ở `reason`: `NO_RULE_SET`, `RULES_INVALID`, `MISSING_REQUIRED_ANSWER`, `NO_MATCHING_BAND`, `NOTHING_SCORED`, `BELOW_LOWEST_OUTCOME`.
5. Level được ghi vào `member_profiles.fitness_level_id`.

Kế hoạch gợi ý lấy nội dung (tên, buổi tập, bài tập) theo level. Số tuần, số buổi mỗi tuần và số phút mỗi buổi lấy từ cấu hình bước Result (F9/F10). Các buổi được trải đều trong tuần.

API member: `GET /api/survey-sessions/{id}/result`, chỉ cho phiên `COMPLETED` (nếu chưa → 409 `SESSION_NOT_COMPLETED`). Phiên đã hoàn thành trước khi có V6 sẽ được chấm bù ở lần gọi đầu.

Kiểm tra cấu hình: lúc khởi động, log in `Level rule set ONBOARDING_LEVEL v<n> configuration OK` hoặc liệt kê từng lỗi. Bộ luật lỗi không chặn member hoàn thành khảo sát mà rơi về level dự phòng.

Seed: [seed_onboarding_level_rules.sql](seed_onboarding_level_rules.sql). File có bảng ngưỡng Push-up / Squat / Plank, `display_config` cho màn onboarding và ví dụ kết quả mong đợi. Chạy sau `seed_survey_management.sql`, chạy lại nhiều lần được. Mỗi lần chạy tạo 1 version ACTIVE mới, version cũ chuyển sang ARCHIVED.

Mã nguồn: `service/survey/level/*` (definition, evaluator, loader, service, startup check), `models/LevelRule*.java`, `models/SurveyLevelResult.java`, test `LevelRuleEvaluatorTest` (13 test).
