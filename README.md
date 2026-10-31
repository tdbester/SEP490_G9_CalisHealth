# SEP490_G9_CalisHealth

Ứng dụng sức khỏe & kỹ năng calisthenics.

- **Backend**: Spring Boot 3 + JWT + MySQL (xem `src/main/java/com/calishealth/`)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS

---

## Frontend — chạy local

```bash
# 1. Cài dependencies (chỉ làm lần đầu)
npm install

# 2. Copy file env mẫu
cp .env.example .env.local
# Sửa VITE_API_URL nếu backend chạy ở URL khác

# 3. Chạy dev server
npm run dev
# Mặc định mở http://localhost:5173

# 4. Build production
npm run build
```

Backend phải chạy ở `http://localhost:8080` (cấu hình trong `application.yml`).
CORS backend đã cho phép `http://localhost:5173` (xem `SecurityConfig.java`).

### Cấu trúc thư mục (rút gọn)

```
src/
├── components/       # UI shared (Button, Input, AuthLayout)
├── contexts/         # AuthContext
├── features/
│   ├── auth/         # Toàn bộ flow auth: api, hooks, schemas, forms, pages
│   ├── content-manager/  # Quản trị bài tập & chương trình tập
│   └── survey/       # Khảo sát 4 bước (context, schemas, components, pages)
├── lib/              # axios, storage, error, utils
├── pages/            # Trang global (HomePage...)
├── routes/           # AppRoutes, ProtectedRoute, PublicRoute
├── App.tsx
├── main.tsx
└── index.css
```

### Routes

| Path | Trang | Trạng thái |
|------|-------|------------|
| `/login` | `LoginPage` | ✅ nối API |
| `/register` | `RegisterPage` | ✅ nối API |
| `/forgot-password` | `ForgotPasswordPage` | ✅ nối API |
| `/reset-password` | `ResetPasswordPage` | ✅ nối API |
| `/verify` | `VerifyEmailPage` | ✅ nối API |
| `/change-password` | `ChangePasswordPage` | ✅ nối API |
| `/survey/body-information` | `BodyInfoPage` | ✅ UI + validation (bước 1/4) |
| `/survey/goals-and-motivation` | `GoalsPage` | ✅ UI + validation (bước 2/4) |
| `/survey/current-training-routine` | `TrainingRoutinePage` | ✅ UI + validation (bước 3/4) |
| `/survey/level-test` | `LevelTestPage` | ✅ UI + validation (bước 4/4) |
| `/survey/result` | `SurveyResultPage` | ✅ UI + data mẫu (kết quả & plan) |
| `/content/*` | Content manager | ✅ CRUD bài tập & chương trình |
| `/admin/notifications` | Notification management (ADMIN) | ✅ Danh sách, lọc và xóa |
| `/404` | `NotFoundPage` | — |

> Survey flow: `/survey` → `body-information` → `goals-and-motivation` → `current-training-routine` → `level-test` → `result`.
> Bước 4 (level test) điều hướng sang `result`, nơi hiển thị level + plan khuyến nghị.
> Plan hiện là **data mẫu chạy client-side** trong `features/survey/data/recommendation.ts` — khi backend có API plan thật, chỉ cần thay `buildRecommendation` mà không đổi phần UI.

### Stack

- **Database**: `server/src/main/resources/application.yml` — đổi `spring.datasource.url` / `username` / `password` nếu không dùng default
- **JWT secret**: `app.jwt.secret` trong `application.yml` (>= 32 ký tự) — **đổi trước khi deploy**
- **JWT TTL**: `app.jwt.expiration-ms` (mặc định 24h)
- **CORS / frontend URL**: `app.frontend-url`

## API test nhanh

Import collection `postman/CalisHealth-Auth-Pro.postman_collection.json` vào Postman — đã có sẵn các endpoint:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET  /api/auth/me`
- `GET  /api/auth/verify-email?token=…`

### Admin notifications

Các API quản lý thông báo yêu cầu tài khoản có role `ADMIN`:

- `GET    /api/admin/notifications?type=ALL`
- `GET    /api/admin/notifications/{id}`
- `POST   /api/admin/notifications`
- `PUT    /api/admin/notifications/{id}`
- `DELETE /api/admin/notifications/batch`
- `DELETE /api/admin/notifications/{id}`

Request tạo thông báo gồm `title`, `message`, `type` (`ANNOUNCEMENT` hoặc `UPDATE`) và `status` (`PUBLISHED` hoặc `DRAFT`). Tài khoản đăng nhập phải có role `ADMIN`; `created_by` được gán theo tài khoản đang xác thực.

Request cập nhật thông báo dùng cùng các trường; thông báo `MAINTENANCE` có thể cập nhật nội dung/trạng thái nhưng không thể đổi loại.

### Onboarding survey

Collection `postman/CalisHealth-Survey.postman_collection.json` cùng environment `postman/CalisHealth-Local.postman_environment.json` chứa 63 request có assertion. Hướng dẫn chạy nằm ở [postman/README-Survey.md](postman/README-Survey.md), còn kiến trúc, cách thêm câu hỏi và cách thêm loại câu hỏi nằm ở [server/docs/survey-engine.md](server/docs/survey-engine.md).

- `GET  /api/surveys/{surveyCode}`
- `POST /api/survey-sessions` · `GET /api/survey-sessions?surveyCode=` · `GET /api/survey-sessions/{id}`
- `PUT  /api/survey-sessions/{id}/steps/{stepCode}/answers`
- `POST /api/survey-sessions/{id}/complete` · `/skip` · `/resume`

## Roadmap

- [x] Monorepo `client/` + `server/`
- [x] Admin layout (Sidebar + Topbar + canvas)
- [x] Dashboard UI (search / filter / bảng / pagination)
- [x] Login UI (chưa nối API)
- [x] Placeholder cho `/library` và `/tracking`
- [ ] Nối frontend ↔ backend (auth + CRUD)
- [ ] Hoàn thiện `/library` (CRUD bài tập, video)
- [ ] `/tracking` (theo dõi sức khỏe & tiến trình)
- [ ] Thêm sidebar items (Khảo sát, Quy tắc thăng tiến, Tiêu chí lên cấp)

## Conventions

- **Layout components** đặt trong `client/src/components/layout/`
- **Pages** đặt trong `client/src/pages/`
- Mỗi file một component, default export cho page
- Không hardcode màu trong component — dùng CSS class hoặc MUI theme token