# SEP490_G9_CalisHealth

Ứng dụng sức khỏe & kỹ năng calisthenics.

- **Backend**: Spring Boot 3 + JWT + MySQL (xem `src/main/java/com/calishealth/`)
- **Frontend**: React 18 + Vite + JavaScript + Tailwind CSS

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
├── api/              # axios client + endpoint theo domain (auth, library, survey, tracking...)
├── components/       # UI shared (layout, common, content, survey, session, tracking...)
├── context/          # FavoritesContext
├── data/             # seed/mock data cho dashboard, health tracking
├── features/
│   └── content-manager/  # Quản trị bài tập & chương trình tập
├── hooks/            # usePoseDetection, useVideoPoseScan, useHoldTracker...
├── i18n/             # locales vi/en + useTranslation
├── pages/            # Trang global (Login, Library, Survey, Tracking, Admin...)
├── styles/           # global.css, notification.css
├── utils/            # helper thuần (bmi, levelLabel, exerciseMedia, planCalendar...)
├── App.jsx
├── main.jsx
└── index.css
```

> Toàn bộ source frontend là **JavaScript (JSX)** — không còn file `.ts`/`.tsx` nào trong `src/`.

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
> Kế hoạch gợi ý do backend tính (module `survey.level`) và trả về qua API — frontend chỉ render kết quả.

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
- [x] Auth end-to-end (register · verify email · login · reset password · đổi mật khẩu)
- [x] Onboarding survey 4 bước + chấm level + plan khuyến nghị
- [x] Library bài tập / workout (CRUD, video, duyệt nội dung)
- [x] Tracking tập luyện (MediaPipe pose tracking, kết quả bài/set, phân tích hiệu năng)
- [x] AI Support chat (Gemini) + quota
- [x] Lịch tập theo tháng, quy tắc thăng tiến, leaderboard tuần
- [x] Storage / media management (Cloudinary + quota)
- [ ] Gợi ý kế hoạch tập cá nhân hoá theo hồ sơ sinh lý

## Conventions

- **Layout components** đặt trong `client/src/components/layout/`
- **Pages** đặt trong `client/src/pages/`
- Mỗi file một component, default export cho page
- Không hardcode màu trong component — dùng CSS class hoặc MUI theme token