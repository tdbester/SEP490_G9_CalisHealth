# Test Survey API bằng Postman

Hai file trong thư mục này:

| File | Nội dung |
|---|---|
| `CalisHealth-Survey.postman_collection.json` | 63 request, chia 6 folder, request nào cũng có assertion trong tab **Tests** |
| `CalisHealth-Local.postman_environment.json` | Biến môi trường: `baseUrl`, `surveyCode`, tài khoản test, `token`, `sessionId`... |

## 1. Chuẩn bị (làm 1 lần)

### 1.1 Chạy backend

```powershell
cd server
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = "<mật khẩu MySQL của bạn>"
.\mvnw.cmd spring-boot:run
```

Khi khởi động, Flyway tự chạy `V2__survey_schema.sql` để tạo bảng. Dữ liệu cấu hình khảo sát `CALISHEALTH_ONBOARDING` (4 bước, câu hỏi, lựa chọn) **không** nằm trong migration, nên phải được nạp vào DB riêng trước khi test. Khi đã có dữ liệu, log khởi động sẽ có:

```
Survey CALISHEALTH_ONBOARDING v1 configuration OK
```

### 1.2 Tạo 2 tài khoản test

Cần 2 tài khoản: **A** là chủ phiên, **B** dùng để thử đọc/ghi phiên của người khác.

1. Đăng ký bằng collection `CalisHealth-Auth-Pro` (request *1. Register*) hoặc bằng lệnh:
   ```powershell
   $body = '{"fullName":"Survey A","email":"survey.a@example.com","password":"Test@123","confirmPassword":"Test@123"}'
   Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/register -ContentType 'application/json' -Body $body
   ```
   Làm tương tự với `survey.b@example.com`.
2. Xác thực email bằng **một** trong hai cách:
   - Mở link `.../verify-email?token=...` in trong console Spring Boot (khối `===== EMAIL TO ... =====`), rồi gọi `GET /api/auth/verify?token=<token>`.
   - Hoặc dùng SQL trên DB local: `UPDATE users SET enabled = 1 WHERE email IN ('survey.a@example.com', 'survey.b@example.com');`

### 1.3 Import vào Postman

1. **Import** → kéo cả 2 file JSON vào.
2. Góc phải trên cùng, chọn environment **CalisHealth - Local**.
3. Mở environment và điền `userPassword` / `otherUserPassword` (ví dụ `Test@123`). Nếu dùng email khác thì sửa luôn `userEmail` / `otherUserEmail`. Collection không chứa mật khẩu hay token thật.

## 2. Chạy test

**Cách 1 (khuyên dùng):** chuột phải collection → **Run collection** → giữ nguyên thứ tự → **Run**. Kết quả mong đợi: mọi test đều xanh.

**Cách 2:** bấm **Send** từng request theo thứ tự từ trên xuống. Các folder phụ thuộc nhau qua biến `sessionId` và `skipSessionId`, nên không được nhảy cóc.

**Cách 3 (CLI):**
```powershell
npx newman run postman/CalisHealth-Survey.postman_collection.json `
  -e postman/CalisHealth-Local.postman_environment.json `
  --env-var userPassword=Test@123 --env-var otherUserPassword=Test@123
```

Collection chạy lại được bao nhiêu lần cũng được: mỗi lần chạy sẽ tạo 1 phiên mới rồi kết thúc nó ở trạng thái `COMPLETED`, và 1 phiên khác ở trạng thái `SKIPPED`.

Nếu một lần chạy bị dừng giữa chừng, phiên `IN_PROGRESS` còn sót lại sẽ được request *Start session* ở lần sau dùng tiếp (trả về 200 thay vì 201). Riêng folder 05 lại cần tạo phiên **mới** (201), nên khi gặp lỗi ở đây, hãy chạy lại toàn bộ từ đầu.

## 3. Cấu trúc collection và kết quả mong đợi

| Folder | Mục đích |
|---|---|
| 00. Setup | Đăng nhập A và B, lưu `token` / `otherToken` |
| 01. Survey definition | Lấy định nghĩa (4 bước, rules, options, điều kiện); survey/version không tồn tại; thiếu token |
| 02. E2E - làm khảo sát | Start → lưu 4 bước → đổi HEALTH sang SKILLS → sửa AGE → GET lại để khôi phục |
| 03. Negative | Các lỗi validation và phân quyền trên phiên đang làm, kèm kiểm tra rằng request lỗi không lưu gì |
| 04. E2E - hoàn thành | Complete → `COMPLETED`; sau đó sửa hoặc complete lại phải bị từ chối |
| 05. E2E - bỏ qua | Phiên mới → lưu bước 1 → skip → câu trả lời vẫn còn → không sửa được → resume → skip lại |

### Positive

| # | Request | HTTP | Kiểm tra | Tác động DB |
|---|---|---|---|---|
| 1 | `GET /api/surveys/{code}` | 200 | Có 4 bước đúng thứ tự, AGE có rules, GENDER có options, HEALTH_GOAL có điều kiện, không lộ id | – |
| 2 | `POST /api/survey-sessions` | 201 (200 nếu đã có phiên) | `status = IN_PROGRESS`, lưu `sessionId` | +1 `survey_sessions` |
| 3 | `GET /api/survey-sessions/{id}` | 200 | Đúng phiên | – |
| 4, 6, 8 | PUT `BODY_INFORMATION` (NUMBER + SINGLE_SELECT, 4 câu) | 200 | Giá trị đã chuẩn hóa, `currentStepCode = GOALS_AND_MOTIVATION` | +4 `assessment_answers` |
| 7, 11 | PUT `GOALS` với HEALTH + `HEALTH_GOAL` + MULTIPLE_SELECT | 200 | `HEALTH_GOAL.applicable = true`, `TRAINING_SKILLS.applicable = false` | +3 |
| 9, 11 | PUT `GOALS` → SKILLS, `HEALTH_GOAL: null` | 200 | HEALTH_GOAL bị xóa, skills sắp theo thứ tự option | −1, +1, 2 bản ghi được update |
| 9 | PUT `AGE = 23` | 200 | Các câu khác trong bước giữ nguyên | update 1 bản ghi, không tạo bản trùng |
| 10 | GET session | 200 | Khôi phục đủ dữ liệu, mọi bước `complete` | – |
| 12 | `POST .../complete` | 200 | `COMPLETED`, có `completedAt` | update `survey_sessions` |
| 13 | `POST .../skip` | 200 | `SKIPPED`, có `skippedAt` | update `survey_sessions` |
| 14 | GET sau khi skip | 200 | AGE = 30, WEIGHT = 55.5 vẫn còn | answers không bị xóa |

### Negative

| # | Tình huống | HTTP | `code` | `errors[].code` |
|---|---|---|---|---|
| 1 | Survey không tồn tại | 404 | `SURVEY_NOT_FOUND` | |
| 2 | Start với survey không tồn tại | 404 | `SURVEY_NOT_FOUND` | |
| 3 | Session không tồn tại | 404 | `SESSION_NOT_FOUND` | |
| 4 | Đọc hoặc ghi phiên của user khác | 404 | `SESSION_NOT_FOUND` (cố ý giống hệt #3) | |
| 5 | `questionCode` không tồn tại | 400 | `SURVEY_VALIDATION_FAILED` | `QUESTION_NOT_FOUND` |
| 6 | `stepCode` không tồn tại | 404 | `STEP_NOT_FOUND` | |
| 7 | Câu hỏi thuộc bước khác | 400 | `SURVEY_VALIDATION_FAILED` | `QUESTION_NOT_IN_STEP` |
| 8 | AGE = `"22"` (chuỗi) | 400 | `SURVEY_VALIDATION_FAILED` | `TYPE_MISMATCH` |
| 9 | AGE = 150, HEIGHT = 172.55 | 400 | `SURVEY_VALIDATION_FAILED` | `VALUE_OUT_OF_RANGE`, `TOO_MANY_DECIMALS` (WEIGHT hợp lệ trong cùng request cũng **không** được lưu) |
| 10 | Option không hợp lệ | 400 | `SURVEY_VALIDATION_FAILED` | `INVALID_OPTION` |
| 11 | Option bị trùng / mảng rỗng | 400 | `SURVEY_VALIDATION_FAILED` | `DUPLICATE_OPTION` / `TOO_FEW_SELECTIONS` |
| 12 | Trả lời HEALTH_GOAL khi GOAL_TYPE = SKILLS | 400 | `SURVEY_VALIDATION_FAILED` | `QUESTION_NOT_APPLICABLE` |
| 13 | Complete khi thiếu câu bắt buộc | 400 | `SURVEY_INCOMPLETE` | `MISSING_REQUIRED_ANSWER` (kèm `stepCode`) |
| – | Complete khi còn câu trả lời đã hết áp dụng | 400 | `SURVEY_INCOMPLETE` | `ANSWER_NOT_APPLICABLE` |
| 14 | Sửa phiên đã hoàn thành | 409 | `SESSION_COMPLETED` | |
| 15 | JSON hỏng | 400 | `INVALID_REQUEST` | |
| 16 | Trùng câu hỏi trong 1 request | 400 | `SURVEY_VALIDATION_FAILED` | `DUPLICATE_QUESTION` |
| 17 | Client tự gửi `questionType` / `validationRules` | 400 | `SURVEY_VALIDATION_FAILED` | `UNKNOWN_FIELD` |
| 18 | Không có token | 401 | (body rỗng, theo SecurityConfig hiện có) | |
| 19 | Sửa, complete hoặc skip phiên đã skip | 409 | `SESSION_SKIPPED` | |
| – | `surveyVersion` trong body khác version của phiên | 409 | `SURVEY_VERSION_MISMATCH` | |
| – | `answers: []`, thiếu `surveyCode` | 400 | `INVALID_REQUEST` | |
| – | Thiếu key `value` | 400 | `SURVEY_VALIDATION_FAILED` | `VALUE_MISSING` |

Mọi request lỗi đều không ghi gì vào DB. Request *Kiểm tra: request lỗi không lưu gì* xác nhận điều đó.

### Test thủ công: loại câu hỏi chưa được hỗ trợ trong DB (#17, phía cấu hình)

Client không gửi được loại câu hỏi (#17 ở trên đã kiểm tra), nên trường hợp "DB chứa loại chưa có handler" chỉ xảy ra khi cấu hình sai. Unit test `QuestionTypeRegistryTest` và `SurveyConfigValidatorTest` đã bao phủ trường hợp này. Nếu muốn tự thử trên **DB local**:

```sql
UPDATE assessment_questions SET question_type = 'FILE_UPLOAD' WHERE question_code = 'AGE';
-- GET /api/surveys/CALISHEALTH_ONBOARDING -> 500 {"code":"SURVEY_CONFIG_INVALID", ...}
-- log server: "Question AGE (step BODY_INFORMATION): unsupported question type 'FILE_UPLOAD' ..."
UPDATE assessment_questions SET question_type = 'NUMBER' WHERE question_code = 'AGE';   -- trả lại
```

### Kiểm tra trực tiếp trong DB

```sql
SELECT id, user_id, survey_version, status, started_at, completed_at, skipped_at
FROM survey_sessions ORDER BY id DESC LIMIT 5;

SELECT q.question_code, a.answer_value, a.updated_at
FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id
WHERE a.session_id = <sessionId>;
```
