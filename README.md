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
| `/404` | `NotFoundPage` | — |

> Survey flow: `/survey` → `body-information` → `goals-and-motivation` → `current-training-routine` → `level-test` → `result`.
> Bước 4 (level test) điều hướng sang `result`, nơi hiển thị level + plan khuyến nghị.
> Plan hiện là **data mẫu chạy client-side** trong `features/survey/data/recommendation.ts` — khi backend có API plan thật, chỉ cần thay `buildRecommendation` mà không đổi phần UI.

### Stack

- **Vite** + **TypeScript** + **React 18**
- **React Router v6** — routing
- **TanStack Query v5** — data fetching, cache
- **React Hook Form** + **Zod** — form & validation (khớp với backend)
- **Axios** — HTTP client (có JWT interceptor + 401 handler)
- **Tailwind CSS** + shadcn-style components — UI
- Path alias `@/*` trỏ về `src/*`