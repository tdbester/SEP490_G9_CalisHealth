# CalisHealth

Web app hỗ trợ học, lên kế hoạch và theo dõi tiến trình tập **calisthenics** (bodyweight), kèm trang quản trị để quản lý nội dung, bài tập, video và quy tắc thăng tiến.

## Công nghệ

| Tầng | Stack |
|------|-------|
| **Frontend** (`client/`) | React 18 · Vite 5 · React Router 6 · Material UI 6 · CSS thuần |
| **Backend** (`server/`) | Java 17 · Spring Boot 4 (Web, Data JPA, Security, Validation, Mail) · MySQL · JWT (jjwt 0.12) · Lombok |
| **Build** | npm (client) · Maven (server) |

## Cấu trúc repo

```
SEP490_G9_CalisHealth/
├── client/                                # React + Vite frontend (admin panel)
│   ├── src/
│   │   ├── App.jsx                        # Router (BrowserRouter + Routes)
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   └── layout/                    # AdminLayout, Sidebar, Topbar
│   │   ├── pages/                         # Dashboard, Login, PlaceholderPage…
│   │   └── assets/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                                # Spring Boot backend
│   ├── src/main/java/com/calishealth/
│   │   ├── CalisHealthApplication.java
│   │   ├── controllers/AuthController.java
│   │   ├── service/                       # AuthService, EmailService
│   │   ├── security/                      # SecurityConfig, JwtService, JwtAuthFilter
│   │   ├── models/                        # User, AuthToken
│   │   ├── dtos/AuthDtos.java
│   │   ├── repository/                    # UserRepository, TokenRepository
│   │   ├── validation/                    # @ValidEmail, @StrongPassword
│   │   └── exception/GlobalExceptionHandler.java
│   ├── src/main/resources/
│   │   ├── application.yml                # MySQL + JWT + mail config
│   │   └── application.properties
│   └── pom.xml
├── postman/
│   └── CalisHealth-Auth-Pro.postman_collection.json
└── README.md
```

## Chạy local

### 1. Backend — `server/`

Yêu cầu: **JDK 17+** · **Maven 3.9+** · **MySQL 8+**

```bash
cd server

# (Tùy chọn) tạo DB — Spring sẽ tự tạo nếu createDatabaseIfNotExist=true
# mysql -u root -p -e "CREATE DATABASE calishealth;"

# Cấu hình env nếu muốn override default
# DB_USERNAME / DB_PASSWORD (mặc định: root / 12345678)
# app.mail.username / app.mail.password — dùng cho flow quên mật khẩu (Gmail + App Password)

# Chạy dev
./mvnw spring-boot:run
# hoặc:  mvn spring-boot:run
```

API mặc định chạy ở **http://localhost:8080**.
CORS đã whitelist `http://localhost:5173` (xem `app.frontend-url` trong `application.yml`).

### 2. Frontend — `client/`

Yêu cầu: **Node 18+** · **npm 9+**

```bash
cd client

# Cài dependencies (lần đầu)
npm install

# Dev server
npm run dev
# Mặc định mở http://localhost:5173

# Build production
npm run build

# Preview bản build
npm run preview

# Lint
npm run lint
```

## Routes (frontend)

| Path | Trang | Trạng thái |
|------|-------|------------|
| `/login` | `Login` | ✅ UI sẵn, chưa nối API |
| `/` | `Dashboard` (Tổng quan) | ✅ UI mock |
| `/library` | `PlaceholderPage` | 🚧 WIP |
| `/tracking` | `PlaceholderPage` | 🚧 WIP |
| `*` | redirect → `/login` | — |

## Thiết kế

- **Brand color**: deep purple `#5B21B6`
- **Sidebar**: 256px cố định, nền tím đậm, chữ trắng; item active nền tím nhạt (`#EDE9FE`), chữ tím đậm
- **Topbar**: 64px cố định, nền trắng
- **Canvas**: nền xám nhạt (`#F9FAFB`)
- Font: **Inter** → Roboto → Helvetica → Arial
- Không dùng shadcn/Tailwind — UI viết tay bằng CSS, dùng MUI cho icon + theme token (đang dần thay thế bằng CSS thuần ở các page)

## Cấu hình hữu ích

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
