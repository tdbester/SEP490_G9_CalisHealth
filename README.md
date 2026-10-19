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
│   └── auth/         # Toàn bộ flow auth: api, hooks, schemas, forms, pages
├── lib/              # axios, storage, error, utils
├── pages/            # Trang global (HomePage...)
├── routes/           # AppRoutes, ProtectedRoute, PublicRoute
├── App.tsx
├── main.tsx
└── index.css
```

### Stack

- **Vite** + **TypeScript** + **React 18**
- **React Router v6** — routing
- **TanStack Query v5** — data fetching, cache
- **React Hook Form** + **Zod** — form & validation (khớp với backend)
- **Axios** — HTTP client (có JWT interceptor + 401 handler)
- **Tailwind CSS** + shadcn-style components — UI
- Path alias `@/*` trỏ về `src/*`