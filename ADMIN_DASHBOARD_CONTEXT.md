# Admin Dashboard - Working Context

Running log for the admin dashboard work. Update this file as the work progresses.

## Task

- Branch: `SGC155-SGC157`
- Build the Admin Dashboard screen from Figma frame `admin-dashboard` (node `704:348`, 1160x786).
- Flow: Login -> check role -> `ADMIN` account is redirected to the admin dashboard.

## Decisions

- Admin area lives at `/admin/*`, mirroring the Content Manager area at `/content/*`.
- Route guard (`AdminAreaLayout`) calls `/auth/me`, then: guest -> `/login?returnTo=...`, non-ADMIN -> "no access" screen.
- Login redirect by role:
  - `CONTENT_MANAGER` -> `/content/dashboard`
  - `ADMIN` -> `/admin/dashboard` (`returnTo` honoured only when it starts with `/admin`)
  - others -> `returnTo` or `/`
- `RoleHomeRoute` (`/`) also redirects `ADMIN` to `/admin/dashboard`.
- Backend already restricts `/api/admin/**` to `hasRole("ADMIN")` in `SecurityConfig`. No admin endpoints exist yet.
- Admin has its own colour tokens in `client/src/theme-admin.js` (`AD`), converted from the Figma RGB values. The MUI base theme still comes from `theme-content.js` (dark mode for menus/buttons).
- No chart library in the project, so the trend chart is hand-written SVG (`components/admin/ActivityTrendChart.jsx`). Avoided adding a dependency.
- Dashboard data is mock for now: `client/src/data/adminDashboardMock.js`.

## What the Figma contains

- Sidebar (253px): logo "CalisHealth", nav: Dashboard (active), Users, Notifications, Media storage & infrastructure, Create maintenance schedule.
- Top right: profile button (violet border) and logout button (red tone).
- Title "Dashboard", subtitle "System overview".
- 3 stat cards: Total Users 12,482 / Total Skill Exercises 86 / Total Health Exercises 100.
- Card "User Activity Trend" ("Total workout logs per week"): toggle 30 Days / 6 Months / 1 Year, line chart with tooltip "Oct 27, 2026 - 1,230 Workout Logs".
- The top part of the frame (traffic lights, URL bar `calishealth.app/admin/dashboard`) is a browser mockup, not part of the app UI.

## Files

- `client/src/App.jsx` - `/admin` routes (dashboard, users, notifications, storage, maintenance)
- `client/src/components/layout/AdminAreaLayout.jsx` - guard + sidebar + topbar
- `client/src/pages/AdminDashboard.jsx` - stat cards + trend card
- `client/src/pages/AdminSectionPage.jsx` - "Coming soon" placeholder for the other menu items
- `client/src/components/admin/ActivityTrendChart.jsx` - SVG line chart
- `client/src/theme-admin.js`, `client/src/data/adminDashboardMock.js`

## Done

- [x] Role redirect (`Login.jsx`, `RoleHomeRoute.jsx`)
- [x] Admin layout, dashboard UI, chart, range toggle (client build passes, no lint errors)

## TODO

- [ ] Visual check in the browser against the Figma (not done yet; only build + lint verified)
- [ ] Backend endpoint for dashboard data (totals + workout logs per week), then replace the mock
- [x] Shared ADMIN test account seeded by `V11__seed_admin_account.sql`: `admin@calishealth.com` / `Test@123`, full name "Admin", role `ADMIN`, enabled. Idempotent; if the email already exists it only sets role + enabled and keeps the existing password.
- `V12__admin_user_id_one.sql` makes the admin account `id = 1` and shifts every user with a lower id up by 1 (no swap, relative order kept), updating all 6 FK columns (`auth_tokens.user_id`, `exercises.created_by`, `media_files.uploaded_by`, `member_profiles.user_id`, `survey_sessions.user_id`, `workout_entries.created_by`). Any new table with an FK to `users` must be handled in a new migration if ids are ever renumbered again.
- RULE: every database change = a NEW Flyway version. Never edit an applied migration. V11 was chosen because other remote branches already use V8 (`SGC143-144`, `SGC5-110`) and V9/V10 (`SGC5-110`).
- [ ] Other admin screens (Users, Notifications, Storage, Maintenance) when designs arrive

## Figma frames received

- `admin-dashboard` (704:348): 30 Days view. Subtitle "Total workout logs per week", y axis 0-1500 (step 250), x labels Sep 29 .. Oct 27, tooltip "Oct 27, 2026 - 1,230 Workout Logs".
- `admin-dashboard-6months` (704:173): 6 Months view. Subtitle "Total workout logs per month", y axis 0-6000 (step 1000), x labels May..Oct, tooltip "Oct 2026 - 5,200 Workout Logs". Values read from point positions: May 3900, Jun 4600, Jul 4200, Aug 5100, Sep 5500, Oct 5200.
- `admin-dashboard-1year` (704:4): 1 Year view. Subtitle "Total workout logs per quarter", y axis 0-18000 (step 3000), 4 x labels "Nov–Jan", "Feb–Apr", "May–Jul", "Aug–Oct", tooltip "Aug–Oct 2026 - 16,200 Workout Logs". Values computed from point positions (plot 453..674 px = 18000..0): 11800, 13900, 14600, 16200.
- All 3 Figma frames are received. Chart values are computed as `(674 - pointCenterY) / 221 * axisMax`; for the 1 Year frame the highlighted point (center y 475.1) gives exactly 16,200, matching the tooltip.
- The y axis step is computed from the data (`pickStep`), and reproduces all three Figma axes.

## Admin shell = Content Manager shell (decision)

- The admin sidebar and topbar now reuse the Content Manager ones. They are exported from `ContentManagerLayout.jsx`: `SidebarBrand`, `drawerPaperSx`, `navItemSx`, `DRAWER_WIDTH`, `topbarSx`, `AccountMenu`, `LogoutButton`. `AdminAreaLayout.jsx` only supplies the admin links, the admin guard and the notification button target.
- Keep this shell for every `/admin/*` screen. Do not restyle it per screen; change `ContentManagerLayout.jsx` if the shell itself needs to change.
- `AD` tokens in `theme-admin.js` are still used by dashboard content (cards, chart), not by the shell.

## User Management (built)

- Backend (`/api/admin/**` is already ADMIN-only in `SecurityConfig`):
  - `GET /api/admin/users?q=&role=&status=ACTIVE|INACTIVE&joinedOn=yyyy-MM-dd&sort=newest|oldest|name_asc|name_desc&page=&size=` (default `size` 10, max 50; `joinedOn` matches users created on that whole day; INACTIVE = blocked or email not verified) returns `items`, paging fields and `summary` (`total`, `active`, `inactive`, `byRole`; the three stat cards All Users / Active / Inactive read from it). `q` matches name, email or user code (`USR-00124`, `00124`, `124`). `size` is capped at 50.
  - `POST /api/admin/users` creates an ADMIN or CONTENT_MANAGER account (enabled immediately, no email verification). MEMBER is rejected; duplicate email returns 409.
  - `PATCH /api/admin/users/status` with `{ids, active}` activates or deactivates users (maps to `users.enabled`). An admin cannot deactivate their own account.
  - Code: `AdminUserController`, `AdminUserService`, `AdminUserDtos`, `UserRepository` (now a `JpaSpecificationExecutor`). Tests: `AdminUserServiceTest`. No DB migration was needed.
- Blocking: migration `V13__user_blocked_flag.sql` adds `users.blocked`. `enabled` still means email verified; `blocked` means an admin deactivated the account. `User.isActive()` = `enabled && !blocked`. Login, forgot password and reset password return "Your account has been blocked" (403) for blocked users; `JwtAuthFilter` rejects their tokens.
- Bulk bar: two icon buttons, green Activate and pink Deactivate (no "Change Status" dropdown). Role filter shows plain "All Roles" without counts.
- Create staff account (Figma `create_staff_account_ui 1`, node 146:1395): page `pages/AdminCreateStaffPage.jsx` at `/admin/users/create` (`/admin/create` redirects there). The "+ Add admin/content manager" button on the users page now navigates here, and the old dialog was removed. Sections: account details, role cards (Admin / Content manager) and an info note about the initial password. There is no password input: every account created here gets the default password `Test@123` (`AdminUserService.DEFAULT_STAFF_PASSWORD`). `POST /api/admin/users` takes `{fullName, email, role}`; a 409 shows "Email is already registered" under the email field. On success it returns to `/admin/users` with a toast.
- First login: migration `V14__user_must_change_password.sql` adds `users.must_change_password`. Only CONTENT_MANAGER accounts are created with it set; ADMIN accounts keep the default password. While it is set, `JwtAuthFilter` returns 403 `PASSWORD_CHANGE_REQUIRED` for everything except `/api/auth/me` and `/api/auth/change-password`. `/auth/login` and `/auth/me` return `mustChangePassword`; `Login.jsx` and the axios interceptor send the user to `/change-password` (`pages/ChangePassword.jsx`). The new password must differ from the default; after changing it the flag clears and the user logs in again. Reset password also clears the flag.
- Frontend: `pages/AdminUsersPage.jsx`, `api/adminUsers.js`, route `/admin/users` in `App.jsx`.
- Deviations from the Figma frame:
  - The trash button deactivates the selected users instead of deleting them. Hard delete is blocked by foreign keys (exercises, media, survey sessions) and would lose history.
  - The row action is Activate/Deactivate instead of "Details" (no user detail screen exists yet).
  - "Last session Xd ago" is not shown (no backend source wired yet).
  - Role filter and sort dropdown include extra options (per-role counts, oldest first, name A-Z/Z-A).

## Figma frame `users-list 1` (710:520), reference

- Breadcrumb "Admin / Users"; title "User Management"; subtitle "View and manage registered CalisHealth athletes, coaches, account access tiers, and security statuses."
- Button "Add admin/content manager" (violet #6C2FD6), top right.
- Stat cards: All Users 1,248; Active 1,180 (green).
- Filters: search "Search by athlete name, email, or USR-ID..." (392px), "Role: All Roles (1,248)" (192px), "Joined: Newest first" (263px).
- Bulk bar when rows selected: "N Users selected across table", "Change Status" dropdown, trash button.
- Table: checkbox, USER / ATHLETE (initials avatar, name, USR-ID pill, optional "Last session 14d ago"), CONTACT EMAIL, ROLE pill (Member), STATUS pill (Active, green), JOINED DATE (08 Oct 2026), ACTIONS (Details button).
- Footer: "Showing 1-6 of 1,248 athletes", Previous, pages 1 2 3 ... 63, Next.
- The browser mockup chrome at the top of the frame is not part of the app UI.

## Open questions

- Real API: group by week for 30 Days, by month for 6 Months and by quarter for 1 Year (follows the Figma subtitles). Quarters here are rolling 3-month windows ending at the current month, not calendar quarters.
