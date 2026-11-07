# CalisHealth — Context 3 ngày gần đây (2026-11-03 → 2026-11-07)

> File này là **sổ ghi nhớ dự án** cho các phiên làm việc sau. Đọc lại file này
> trước khi sửa code để tránh lặp lại lỗi đã gặp.
>
> - Cập nhật gần nhất: **2026-11-07**
> - Branch hiện tại: `SGC105-SGC106`
> - Khu vực liên quan: Member library, Content Manager, Admin area, i18n, navigation shell

---

## 0. Quy tắc vàng — đọc trước khi code

| # | Quy tắc | Chi tiết |
|---|---------|----------|
| R1 | **Mỗi thay đổi DB = 1 migration Flyway mới** | Tuyệt đối **không** sửa migration đã apply. `V1..V56` là lịch sử bất biến. Migration mới đánh số tiếp (`V57`, `V58`, …). Khi merge nhánh có migration trùng số → **đánh số lại** (chỉ file mới của mình). |
| R2 | **`/api/admin/**` chỉ ADMIN, `/api/content/**` chỉ CONTENT_MANAGER** | Khai báo trong `SecurityConfig.java`. Controller admin/content nên có `@PreAuthorize` cho rõ ràng. |
| R3 | **Số liệu hiển thị phải là số thật** | Không hardcode số trong component. Đọc từ API → repository query. Mock chỉ dành cho biểu đồ chưa có API. |
| R4 | **Mọi chuỗi hiển thị phải qua i18n** | `t("namespace.key")`, file ở `client/src/i18n/locales/{en,vi}/<ns>.js`. Thêm namespace mới → tạo file ở **cả hai** thư mục và khai báo trong `resources.js` (`NAMESPACES`). |
| R5 | **Không thêm thư viện mới khi chưa cần** | Biểu đồ dashboard vẽ tay bằng SVG (`ActivityTrendChart.jsx`) thay vì thêm chart lib. |
| R6 | **Shell của Admin/CM giống Member** | Topbar cố định 56px + sidebar cố định 220px bên trái. Không restyle shell theo từng màn — sửa `StaffTopbar.jsx` / `StaffLayout.css` cho cả hai. |

---

## 1. Hạ tầng i18n (đa ngôn ngữ EN / VI)

### 1.1.1. Cấu trúc

```
client/src/i18n/
├── index.js                       # init i18next, changeLanguage(), SUPPORTED_LANGUAGES
├── resources.js                   # gom namespace, tạo namespace `translation` phẳng
├── singleBraceProcessor.js        # hỗ trợ placeholder {name} (1 dấu ngoặc)
└── locales/
    ├── en/{common,member,admin,contentManager}.js
    └── vi/{common,member,admin,contentManager}.js
```

- Namespace: `common`, `member`, `admin`, `contentManager`.
- `resources.js` tạo thêm namespace `translation` gộp tất cả lại → key kiểu
  `admin.dashboard.title` hay `common.ui.close` đều tra được dù component gọi
  `useTranslation()` (không truyền namespace) lẫn `useTranslation("member")`.
- Locale files dùng placeholder **một dấu ngoặc** `{count}` — i18next mặc định chỉ hiểu
  `{{count}}`, nên `singleBraceProcessor` là bắt buộc, đừng xoá.

### 1.1.2. Key lưu ngôn ngữ — `calishealth_lang`

```js
// client/src/i18n/index.js
export const LANG_STORAGE_KEY = "calishealth_lang";
```

> **BUG ĐÃ GẶP (đừng lặp lại):** `AccountMenu`/`StaffTopbar` từng lưu ngôn ngữ vào
> `localStorage.setItem("language", ...` → sai key, và **không** gọi
> `i18n.changeLanguage()`. Kết quả: đổi ngôn ngữ ở Admin / Content Manager
> **không hoạt động**. Sửa đúng cách:
>
> ```js
> import { SUPPORTED_LANGUAGES, changeLanguage } from "../../i18n";
> const [language, setLanguage] = useState(() => localStorage.getItem("calishealth_lang") || "vi");
> // ...
> changeLanguage(next);   // changeLanguage tự lưu đúng key + set documentElement.lang
> ```
>
> `changeLanguage(code)` trong `i18n/index.js` đã lo đủ: validate code, lưu
> `calishealth_lang`, set `document.documentElement.lang`, gọi `i18n.changeLanguage`.

### 1.1.3. Vị trí nút đổi ngôn ngữ (quyết định, 2026-11-06)

- **Chỉ còn trong menu tài khoản (popover avatar) trên Topbar** — giống Member.
- **Đã BỎ** nút ngôn ngữ ở đáy sidebar trái của **mọi** role (Member, Admin, CM).
- Màn authentication (Login/Register/ForgotPassword/…) vẫn giữ nút ngôn ngữ ở
  header, canh phải; logo **căn giữa tuyệt đối**.

---

## 2. Navigation shell cho Admin & Content Manager

### 2.2.1. Files

```
client/src/components/layout/
├── StaffTopbar.jsx     # topbar dùng chung Admin + CM
├── StaffSidebar.jsx    # sidebar dùng chung Admin + CM
├── StaffLayout.css     # toàn bộ style của shell (import bởi StaffTopbar & StaffSidebar)
├── AdminAreaLayout.jsx # guard ADMIN + danh sách link ADMIN_LINKS
├── ContentManagerLayout.jsx # guard CONTENT_MANAGER + CONTENT_LINKS
├── Topbar.jsx / Topbar.css    # shell Member (nguồn tham chiếu phong cách)
└── Sidebar.jsx / Sidebar.css   # shell Member
```

### 2.2.2. Quy tắc bố cục

- Topbar: `position: fixed; top:0; left:0; width:100%; height:56px;` nền `#1a1230`, border-bottom `#2d2550`.
- Sidebar: cố định bên trái, **nằm dưới** topbar (bắt đầu `top: 56px`), rộng 220px.
- Mục đang xem: nền `#2e1f68`, viền `#5b3ce8`.
- Nội dung: `margin-left: 220px; padding-top: 56px`.
- Responsive: `<900px` → sidebar trượt (`transform: translateX(-100%)`), nút menu (hamburger)
  hiện ở topbar, nội dung `margin-left: 0`.

### 2.2.3. Logo "CalisHealth" — BUG ĐÃ GẶP (đừng lặp lại)

Triệu chứng: chữ **"Calis"** và **"Health"** bị tách ra thành 2 khối rời nhau ở Admin & CM.

Nguyên nhân: `.staff-topbar-logo` là `display:flex` với `gap: 10px`, và "Calis" /
"Health" là **2 phần tử con riêng** → flex gap + `background-clip: text` tách chữ.

Cách sửa đúng (đã áp dụng): **lồng "Health" vào trong** span của "Calis":

```jsx
<span className="staff-topbar-logo-text">
  Calis<span className="staff-topbar-gradient">Health</span>
</span>
```

và `.staff-topbar-gradient` cần `display: inline-block;` để gradient text hiển thị đúng.

> Lưu ý: Member (`Topbar.jsx`) dùng `.topbar-logo-text` + `.gradient-text` là 2 span
> riêng nhưng **không** bị tách vì `.topbar-logo-text` có `margin-left: 10px` và
> `.topbar-logo` **không** có `gap`. Nếu sửa `StaffTopbar` thì đừng thêm `gap` vào logo.

---

## 3. Tính năng Favorites (Member) — hoàn thành 2026-11-05

### 3.3.1. Quyết định thiết kế

- **4 nhóm nội dung**, phân biệt rõ System vs Member:
  `SYSTEM_EXERCISE`, `MEMBER_EXERCISE`, `SYSTEM_WORKOUT`, `MEMBER_WORKOUT`.
- Bảng riêng `member_favorites` (V57) thay vì dùng lại `member_saved_exercises`
  (bảng cũ chỉ phục vụ `saveCount` của bài community).
- `item_type` được **ghi lúc toggle** → khi đọc danh sách không cần suy ra lại.

### 3.3.2. API

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/v1/library/favorites` | MEMBER | Danh sách mục đã đánh dấu sao (có gom nhóm System/Member) |
| POST | `/api/v1/library/favorites/{itemType}/{itemId}/toggle` | MEMBER | Bật/tắt, trả `{itemType, itemId, favorite, count}` |

Files: `MemberFavoriteController`, `MemberFavoriteService`, `MemberFavorite` (model),
`MemberFavoriteRepository`, `FavoriteItemResponseDTO`, `FavoriteToggleResponseDTO`,
migration `V57__create_member_favorites.sql`.

### 3.3.3. Frontend

- `client/src/api/favorites.js` — hằng `FAVORITE_ITEM_TYPES`, `normalizeItemId()`,
  `exerciseFavoriteType()`, `workoutFavoriteType()`.
- `client/src/context/FavoritesContext.jsx` — **nguồn sự thật duy nhất** cho trạng
  thái sao. Nạp 1 lần khi mount, toggle optimistic rồi gọi API. Chỉ nạp khi
  phiên đăng nhập hợp lệ là `MEMBER` (`hasMemberSession()`).
- `client/src/pages/FavoritesPage.jsx` — 4 tab: System Exercises / Member Exercises /
  System Workouts / Member Workouts.
- Nút sao trên card thư viện + màn detail (`ExerciseDetailPage`, `SystemWorkoutDetailPage`).

---

## 4. Tính năng Góp ý & Khiếu nại (Feedback) — hoàn thành 2026-11-06/07

### 4.4.1. Luồng nghiệp vụ

```
Member gửi đơn  ──►  PENDING
                        │
                        ▼
              Content Manager tiếp nhận  ──►  IN_REVIEW   (PATCH /take)
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   APPROVE          ESCALATE          REJECT
   (RESOLVED)       (ESCALATED)       (REJECTED)
        │               │
        ▼               ▼
  báo Member      báo Admin → Admin quyết định cuối:
  đã xử lý         RESOLVE | REJECT
```

- **Mọi đơn của Member đều đi qua Content Manager trước.** Không có đường thẳng
  từ Member sang Admin.
- Nội dung thuộc phạm vi thư viện → Content Manager tự giải quyết.
- Vấn đề thuộc về hệ thống → chuyển tiếp lên Admin.
- Trạng thái đóng: `RESOLVED`, `REJECTED` (`Status.isClosed()`).
- Category: `GENERAL`, `EXERCISE_CONTENT`, `WORKOUT_CONTENT`, `TECHNICAL`, `OTHER`.

### 4.4.2. Database — `V58__create_member_feedback.sql`

Bảng `member_feedback`: `id, member_id (FK users), title, content, category, status,
resolution_note, handled_by, escalated_at, resolved_at, created_at, updated_at`.

> Vì sao tạo bảng mới: `notifications` chỉ mang thông điệp một chiều, không lưu
> vòng đời của đơn (tiêu đề, nội dung, trạng thái, ghi chú xử lý, ai xử lý).
> Việc gửi thông báo vẫn dùng chung bảng `notifications`.

### 4.4.3. API

| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET | `/api/v1/library/feedback` | MEMBER | Danh sách đơn của chính mình |
| POST | `/api/v1/library/feedback` | MEMBER | Gửi đơn mới `{title, content, category}` |
| GET | `/api/content/feedback` | CM | List + filter `status, category, search, fromDate, toDate` |
| GET | `/api/content/feedback/{id}` | CM | Chi tiết đơn |
| PATCH | `/api/content/feedback/{id}/take` | CM | Nhận việc → `IN_REVIEW` |
| PATCH | `/api/content/feedback/{id}/handle` | CM | `APPROVE` / `ESCALATE` / `REJECT` |
| GET | `/api/admin/feedback` | ADMIN | Đơn `ESCALATED` + các đơn đã đóng (`RESOLVED`/`REJECTED`), hoặc lọc theo `status` |
| GET | `/api/admin/feedback/{id}` | ADMIN | Chi tiết đơn |
| PATCH | `/api/admin/feedback/{id}/handle` | ADMIN | `RESOLVE` / `REJECT` |

Files: `MemberFeedbackController`, `ContentFeedbackController`, `AdminFeedbackController`,
`MemberFeedbackService`, `MemberFeedback` (model), `MemberFeedbackRepository`,
`MemberFeedbackDtos`.

### 4.4.4. Frontend

| Màn | File | Route |
|-----|------|-------|
| Member gửi & theo dõi | `pages/MemberFeedbackPage.jsx` | `/library/feedback`, `/feedback` |
| CM quản lý | `pages/ContentFeedbackPage.jsx` | `/content/feedback` |
| CM chi tiết | `pages/ContentFeedbackDetailPage.jsx` | `/content/feedback/:id` |
| Admin quản lý | `pages/AdminFeedbackPage.jsx` | `/admin/feedback` |
| Admin chi tiết | `pages/AdminFeedbackDetailPage.jsx` | `/admin/feedback/:id` |

API client: `client/src/api/feedback.js` (Member) và `client/src/api/contentManager.js`
(CM), `client/src/api/adminUsers.js` (Admin — `feedback`, `feedbackDetail`, `handleFeedback`).

### 4.4.5. Yêu cầu UI đã chốt

- Màn list của CM **và** Admin có: filter `category`, `search by name`, `date start`,
  `date end`.
- **Có màn detail riêng** cho cả CM và Admin; **toàn bộ action button nằm trong
  màn detail**, không đặt ở list.
- Màn Member: bỏ nút "Back to library"; tắt tự động điền ở các field
  (`autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}`);
  đổi font placeholder của content.

---

## 5. Bảng Admin — canh cột bị lệch (đã sửa)

Triệu chứng: cột trong bảng feedback của Admin lệch/không thẳng hàng.

Nguyên nhân: `theme-content.js` ép **toàn bộ** `TableCell` `textAlign: "center"` và
ép mọi `Stack` bên trong ô về `justifyContent: center` → tiêu đề cột lệch khỏi dữ liệu.

Cách sửa đúng (đã áp dụng trong `AdminFeedbackPage.jsx`):

```jsx
// 1. colgroup với width % cố định -> header và body khớp tuyệt đối
<table style={{ tableLayout: "fixed" }}>
  <colgroup>
    {COL_SIZES.map((col) => <col key={col.key} style={{ width: col.width }} />)}
  </colgroup>

// 2. Dùng chung style cho header & body
const HEAD_CELL_SX = { textAlign: "left", verticalAlign: "middle", /* ... */ };
const BODY_CELL_SX = { textAlign: "left", verticalAlign: "middle", px: 2,
                       "& > .MuiStack-root": { justifyContent: "flex-start" } };
```

> Nếu gặp lại hiện tượng "cột lệch" ở bảng khác: **đừng sửa `theme-content.js`**,
> hãy làm theo pattern `colgroup` + `tableLayout: fixed` + style riêng cho
> header/body như trên.

---

## 6. Admin Dashboard — số liệu thật (2026-11-07)

### 6.6.1. Vấn đề

3 thẻ số liệu dùng số giả từ `client/src/data/adminDashboardMock.js`
(`ADMIN_STATS`: 12482 / 86 / 100).

### 6.6.2. Quyết định

Tách 2 phần:
- **Số liệu tổng quan → API thật** (bắt buộc).
- **Biểu đồ xu hướng → vẫn là mock** (chưa có API workout logs theo tuần/tháng/quý),
  nhưng đã **ghi chú rõ TODO** trong file mock.

### 6.6.3. Backend mới

```
server/src/main/java/com/calishealth/
├── controllers/AdminDashboardController.java   # GET /api/admin/dashboard/overview
├── service/AdminDashboardService.java
└── dtos/AdminDashboardDtos.java                # record SystemOverviewResponse
```

`SystemOverviewResponse(totalUsers, totalSkillExercises, totalHealthExercises,
totalSkillWorkouts, totalHealthWorkouts)`

Nguồn số liệu (đều là query thật):

| Trường | Nguồn |
|--------|-------|
| `totalUsers` | `UserRepository.count()` — **đúng** bảng User Management thật (gồm cả Admin/CM, khớp `summary.total` của `/api/admin/users`) |
| `totalSkillExercises` | `ExerciseRepository.countAcceptedSystemExercisesByType("SKILL")` → `source='SYSTEM' AND type='SKILL' AND moderationStatus IN ('ACTIVE','ACCEPTED') AND active=true` |
| `totalHealthExercises` | `ExerciseRepository.countAcceptedSystemExercisesByType("HEALTH")` |
| `totalSkillWorkouts` / `totalHealthWorkouts` | `WorkoutRepository.countSystemWorkoutsByType("SKILL"/"HEALTH")` → `source='SYSTEM' AND active=true AND status='ACCEPTED'` |

> **RULE R3 nhớ lại:** đừng viết query mới khi đã có sẵn count method trong
> `ExerciseRepository` / `WorkoutRepository`. Tái dùng `countAcceptedSystemExercisesByType`
> và `countSystemWorkoutsByType`.

### 6.6.4. Frontend

- `client/src/api/adminDashboard.js` (mới) — `adminDashboardApi.overview()`.
- `client/src/pages/AdminDashboard.jsx` — `useState` + `useEffect` gọi API, có
  `CircularProgress` khi loading, lỗi API → giữ `0` (không hiện số giả).
- `client/src/data/adminDashboardMock.js` — **đã xoá** `ADMIN_STATS`; chỉ còn
  `TREND_RANGES` + `TREND_DATA`.

### 6.6.5. Mở rộng sau này

Biểu đồ "User Activity Trend" vẫn mock. Khi làm API workout logs:
- 30d → theo tuần, 6m → theo tháng, 1y → theo quý.
- Nguồn dữ liệu gợi ý: `SessionSetResultRepository` / `MemberTrackingRepository`.

---

## 7. Sửa lỗi khác trong 3 ngày qua

| Vấn đề | Nguyên nhân | Sửa |
|---------|-------------|-----|
| Đổi ngôn ngữ ở Admin/CM không hoạt động | Lưu sai key `language`, không gọi `i18n.changeLanguage()` | Dùng `LANG_STORAGE_KEY` + `changeLanguage()` từ `i18n/index.js` |
| "Calis"/"Health" bị tách ở logo Admin/CM | 2 span + `gap: 10px` trong flex container | Lồng span + `display: inline-block` cho gradient |
| Cột bảng feedback Admin lệch | `theme-content.js` ép center mọi `TableCell`/`Stack` | `colgroup` + `tableLayout: fixed` + `HEAD_CELL_SX`/`BODY_CELL_SX` |
| Admin không nhận được notification `targetAudience='ADMIN'` | Thiếu `'ADMIN'` trong `NotificationRepository` query + `MemberNotificationService` audience check | Thêm `'ADMIN'` vào cả 2 chỗ |
| Logo màn authentication lệch trái | Header dùng flex | `.login-header` dùng `grid-template-columns: 1fr auto 1fr`, logo ở `grid-column: 2` → luôn căn giữa |

---

## 8. Bản đồ tính năng nhanh

### Member
- Thư viện: `/library`, `/library/exercises`, `/library/workouts`, `/library/personal`,
  `/library/exercise-tree`, `/library/skills/tree`
- Favorites: `/library/favorites` (alias `/favorites`)
- Feedback: `/library/feedback` (alias `/feedback`)
- Sức khỏe & tiến độ: `/tracking`, `/plan`, `/schedule`, `/survey`, `/profile`

### Content Manager (`/content/*`)
`dashboard`, `management/:section`, `daily-training-plans`, `exercises`,
`progression-rules`, `benchmark-criteria`, `workouts`, `feedback`, `feedback/:id`, `profile`

### Admin (`/admin/*`)
`dashboard`, `users`, `users/create`, `users/:id`, `surveys`, `notifications`,
`storage`, `maintenance`, `feedback`, `feedback/:id`, `profile`

---

## 9. Lệnh build / kiểm tra

```powershell
# Backend (dùng wrapper, máy không có mvn trong PATH)
cd server; .\mvnw.cmd -o compile -DskipTests

# Frontend
cd client; npm run build
```

> `mvn` không có sẵn trong PATH trên máy này → **luôn dùng `.\mvnw.cmd`**.

---

## 10. Tài liệu liên quan (đọc thêm)

| File | Nội dung |
|------|----------|
| `context.md` | Tổng quan dự án, tech stack, design system gốc |
| `ADMIN_DASHBOARD_CONTEXT.md` | Lịch sử làm Admin Dashboard (Figma frames, quyết định shell) |
| `MEMBER_SCHEDULE_API.md` | API lịch tập của Member |
| `docs/workflow/survey-management-step-by-step.md` | Quy trình quản lý survey |
| `server/docs/survey-management/SURVEY_MANAGEMENT_BE.md` | Backend survey management |
