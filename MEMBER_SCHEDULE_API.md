# Member Workout Schedule — Backend

Chức năng: member tự kéo workout (lấy từ **Daily Training Plan Template** do Content
Manager tạo) vào các thứ trong tuần, rồi review lại kế hoạch tuần.

Luồng: `/` (Start Workout) → `/schedule` → Save → `/schedule/review` → Let's go → `/plan`

---

## Database (Flyway `V25__member_weekly_schedule.sql`)

Project chạy `spring.jpa.hibernate.ddl-auto: none`, nên schema do Flyway quản lý —
migration là bắt buộc, không dựa vào Hibernate.

### `member_weekly_schedules`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → `users` | ON DELETE CASCADE |
| `template_id` | BIGINT FK → `daily_plan_templates` | nullable, ON DELETE SET NULL |
| `week_start_date` | DATE | Thứ 2 của tuần |
| `created_at`, `updated_at` | DATETIME(6) | |

`UNIQUE (user_id, week_start_date)` — mỗi member chỉ có một lịch cho mỗi tuần.

### `member_weekly_schedule_days`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | BIGINT PK | |
| `schedule_id` | BIGINT FK → `member_weekly_schedules` | ON DELETE CASCADE |
| `day_of_week` | VARCHAR(20) | `MONDAY`…`SUNDAY` (CHECK) |
| `workout_id` | BIGINT FK → `workout_entries` | |
| `order_in_day` | INT | mặc định 0, cho nhiều workout/ngày |
| `status` | VARCHAR(20) | `PENDING` / `COMPLETED` / `SKIPPED` (CHECK) |

---

## Backend files

| Lớp | File |
| --- | --- |
| Entity | `models/MemberWeeklySchedule.java`, `models/MemberScheduleDay.java` |
| Repository | `repository/MemberWeeklyScheduleRepository.java` |
| DTO | `dtos/MemberScheduleDtos.java` |
| Service | `service/MemberScheduleService.java` |
| Controller | `controllers/MemberScheduleController.java` |
| Migration | `resources/db/migration/V25__member_weekly_schedule.sql` |

---

## Endpoints

Base path `/api/member/schedule`. Tất cả yêu cầu JWT (`Authorization: Bearer <token>`);
dữ liệu luôn lọc theo email trong token nên member không đọc được lịch của người khác.

### `GET /workouts`

Workout có thể xếp lịch — đã lọc theo level của member (lấy từ `member_profiles`,
sau khảo sát). Chỉ lấy workout `source = SYSTEM`, `active = true`, không phải
`DAILY_TRAINING_PLAN`.

```json
[
  {
    "code": "SYS_INT_UPPER",
    "name": "Intermediate Upper Strength",
    "level": "Intermediate",
    "exerciseCount": 4,
    "categories": ["HEALTH", "SKILL"],
    "targetMuscles": ["Back", "Chest", "Shoulders"]
  }
]
```

### `GET /plan-info`

Thẻ "Plan info" của màn Review: template active khớp level member. Trả `null` nếu
không có (FE ẩn thẻ).

```json
{
  "templateCode": "DP-SEED-INT-M1-3D",
  "templateName": "Intermediate Month 1 - 3 days/week",
  "level": "Intermediate",
  "monthNumber": 1,
  "daysPerWeek": 3,
  "year": 2026
}
```

### `POST /`

Lưu (upsert) lịch tuần. `201 Created`.

```json
{
  "weekStartDate": "2026-11-02",
  "templateCode": "DP-SEED-INT-M1-3D",
  "scheduledDays": [
    { "dayOfWeek": "MONDAY", "workoutCode": "SYS_INT_UPPER", "orderInDay": 0 },
    { "dayOfWeek": "WEDNESDAY", "workoutCode": "SYS_INT_CONDITIONING", "orderInDay": 0 }
  ]
}
```

Response:

```json
{
  "id": 1,
  "weekStartDate": "2026-11-02",
  "templateCode": "DP-SEED-INT-M1-3D",
  "templateName": "Intermediate Month 1 - 3 days/week",
  "scheduledDays": [
    {
      "dayOfWeek": "MONDAY",
      "workoutCode": "SYS_INT_UPPER",
      "workoutName": "Intermediate Upper Strength",
      "workoutLevel": "Intermediate",
      "exerciseCount": 4,
      "orderInDay": 0,
      "status": "PENDING"
    }
  ],
  "createdAt": "2026-11-02T16:23:46.46",
  "updatedAt": "2026-11-02T16:23:46.46"
}
```

Gửi lại cùng `weekStartDate` sẽ **thay toàn bộ** danh sách ngày (upsert, `id` giữ nguyên).

### `GET /current`

Lịch tuần hiện tại, `null` nếu chưa xếp.

### `GET /?date=YYYY-MM-DD`

Lịch của tuần chứa `date` (backend chuẩn hoá về Thứ 2).

### `GET /all`

Tất cả lịch của member, mới nhất trước.

### `PATCH /status?weekStartDate=&dayOfWeek=&status=`

Đánh dấu `COMPLETED` / `SKIPPED` / `PENDING` cho một ngày.

---

## Validation

| Tình huống | Status |
| --- | --- |
| Thiếu `weekStartDate` | 400 |
| Trùng `dayOfWeek` trong cùng request | 400 |
| Workout không tồn tại / đã inactive | 400 |
| `status` không thuộc 3 giá trị cho phép | 400 |
| Tuần chưa có lịch | 404 |
| Ngày được PATCH không có workout | 404 |
| Không gửi token | 401 |

---

## Lỗi đã gặp và cách xử lý

1. **`WorkoutEntry` không có `duration`** — model chỉ có `exercises` (mỗi item có
   `sets`/`reps`/`durationSeconds`/`restSeconds`). DTO dùng `exerciseCount` thay vì
   duration; muốn hiện thời lượng thì phải tính từ các item.
2. **`ddl-auto: none`** — thiếu migration thì `Table doesn't exist` khi start.
3. **`toISOString()` lệch múi giờ** — API client format `YYYY-MM-DD` theo giờ local
   (`toIsoDate`) để tránh gửi lùi một ngày ở UTC+7.
4. **Drag & drop trên Firefox/Safari** — phải `dataTransfer.setData("text/plain", code)`
   trong `onDragStart`, nếu không `onDrop` không bắn.
5. **2 trang chưa có route** — phải thêm `/schedule` và `/schedule/review` vào `App.jsx`;
   nút "Let's go" trỏ `/plan` (không phải `/daily-workout`).

---

## Test đã chạy

Backend (curl/Invoke-RestMethod với `demo.member@calishealth.com` / `Test@123`):

- `GET /workouts` → 5 workout level Intermediate ✔
- `GET /plan-info` → `DP-SEED-INT-M1-3D` ✔
- `POST /` → tạo lịch, `201`, id 1 ✔
- `GET /current` → đúng 3 ngày đã lưu ✔
- `GET /?date=2026-11-05` → cùng tuần ✔ ; `?date=2026-11-12` → `null` ✔
- `POST /` lần 2 → upsert, id vẫn 1, thay danh sách ngày ✔
- `PATCH /status` → `TUESDAY: COMPLETED` ✔
- Validation: duplicate day / unknown workout / missing date / bad status → 400;
  ngày không có workout, tuần không tồn tại → 404; không token → 401 ✔

UI (browser, desktop 1512×1000):

- `/` Start Workout → `/schedule` ✔
- Sidebar load 5 workout, lịch load lại đúng Thứ 3 + Thứ 7 đã lưu ✔
- Save schedule → chuyển `/schedule/review`, hiện 2 workouts planned ✔
- Let's go → `/plan` ✔

---

## Lệnh chạy

```powershell
# backend (tự chạy Flyway V25 khi start)
cd SEP490_G9_CalisHealth\server
.\mvnw.cmd spring-boot:run

# frontend
cd SEP490_G9_CalisHealth\client
npm run dev
```

Tài khoản test: `demo.member@calishealth.com` / `Test@123`
