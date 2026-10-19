# CalisHealth - Project Context

## Project Overview

**CalisHealth** is a web application that provides users with calisthenic (bodyweight) training resources. The platform helps users learn, plan, and perform calisthenic workouts, with an **admin/manager backend** to curate content, manage progression rules, level criteria, surveys, and track user health & progress.

## Repo Layout (Monorepo)

```
SEP490_G9_CalisHealth/
├── client/                  # React + Vite + Material UI frontend (Admin panel)
│   ├── src/
│   │   ├── App.jsx, main.jsx
│   │   ├── theme.js                     # MUI theme (deep red brand)
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── AdminLayout.jsx      # White canvas + red sidebar + white topbar
│   │   │       ├── Sidebar.jsx          # DEEP RED bg, white text, active=white pill
│   │   │       └── Topbar.jsx           # Search bar + bell + admin avatar
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx            # Default: health/progress table view
│   │   │   └── PlaceholderPage.jsx      # For Library (WIP)
│   │   └── styles/global.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                  # Java Spring Boot backend
│   ├── src/main/java/com/calishealth/
│   ├── src/main/resources/  # application.yml, application.properties
│   ├── src/test/...
│   ├── pom.xml
│   └── mvnw, mvnw.cmd, .mvn/
├── postman/                 # Postman collection (Auth API tests)
├── context.md               # This file (project context)
├── README.md
└── .gitignore               # Root ignore (covers both client + server)
```

## Tech Stack

- **Frontend (client/)**: React 18 + Vite + Material UI v6 + React Router v6 + custom CSS
- **Backend (server/)**: Java Spring Boot (Maven) — see `server/pom.xml` for modules
- **Package Manager**: npm (client), Maven (server)

## Design System / Theme

The frontend uses an **admin panel** aesthetic — direct port of the Content Manager mockup at `assets/.../image-eb0ee597-*.png`.

### Brand color: **DEEP PURPLE** (`#5B21B6`)

### Color tokens
| Role | Token | Value | Use |
|------|-------|-------|-----|
| Sidebar background | `primary.main` | `#5B21B6` (deep purple/violet) | Full sidebar — white text on purple |
| Sidebar hover | (theme override) | `#4C1D95` (purple-900) | Item hover state |
| Active item bg | (theme override) | `#EDE9FE` (violet-100) | Light purple pill behind active menu |
| Active item text/icon | (theme override) | `#5B21B6` (violet-800) | Purple text on light purple pill |
| Primary CTA | `primary.main` | `#5B21B6` | Buttons, progress bar, badges |
| Status: Đang tập | (inline) | `#DBEAFE` / `#1E40AF` | Light blue chip |
| Status: Hoàn thành | (inline) | `#D1FAE5` / `#065F46` | Light green chip |
| Status: Chờ duyệt | (inline) | `#FEF3C7` / `#92400E` | Light amber chip |
| Status: Tạm dừng | (inline) | `#FEE2E2` / `#991B1B` | Light red chip |
| Canvas | `background.default` | `#F9FAFB` (gray-50) | Main page background |
| Surface | `background.paper` | `#FFFFFF` | Cards, topbar |
| Border | `divider` | `#E5E7EB` | Hairline borders, table dividers |
| Text primary | `text.primary` | `#111827` | Headings, body |
| Text secondary | `text.secondary` | `#6B7280` | Captions, labels, table head |

### Typography
- Font family: **Inter** → Roboto → Helvetica → Arial (sans-serif)
- H1: 36/700, H2: 30/700, H3: 24/600, H4: 20/600, H5: 18/600, H6: 16/600
- Body: 15px / line-height 1.55, small: 14px / 1.5
- Buttons: 600 weight, **no uppercase** (`textTransform: "none"`)
- Letter-spacing: tight on H1/H2 (`-0.02em` / `-0.01em`)

### Layout system
- Sidebar width: **256px** (CSS var `--sidebar-width`), fixed left, **deep purple background**
- Topbar height: **64px** (CSS var `--header-height`), fixed top, **white background**, offset by sidebar
- Main canvas: `ml: 256px, pt: 92px (header+28px), px: 32px`, background **#F9FAFB**
- Border radius: **8px** (cards, buttons, active sidebar pill)
- Paper: white, very subtle shadow (no border)
- AppBar: white, hairline bottom border

### Sidebar navigation
- Background: **deep purple**, text: **white**
- Inactive item: transparent, white icon + white text
- Hover: darker purple (`#4C1D95`)
- Active item: **light-purple pill** with deep purple text + icon (per mockup)

### Component overrides
- `MuiButton.outlined`: gray border, hover turns red border + red-50 bg
- `MuiListItemButton`: default = white text, selected = white pill with red text
- `MuiAppBar`: white, hairline border + tiny shadow
- `MuiPaper`: no border, no shadow

## Navigation / Routes

| Path | Component | Status |
|------|-----------|--------|
| `/` | `Dashboard` (Tổng quan) | ✅ Implemented |
| `/library` | `PlaceholderPage` | 🚧 WIP — Quản lý bài tập, video, tài liệu |
| `/tracking` | `PlaceholderPage` | 🚧 WIP — Theo dõi sức khỏe & tiến trình |
| `*` | redirect to `/` | — |

The reference mockup shows additional sections (Khảo sát, Quy tắc thăng tiến, Tiêu chí lên cấp) — these will be added to the sidebar in a later phase.

## Conventions

- **Layout components** live in `client/src/components/layout/`
- **Pages** live in `client/src/pages/`
- One component per file, named export, default export for page
- Shared CSS variables in `client/src/styles/global.css`
- MUI theme tokens via `theme.js` — never hardcode colors in components
- All project context, decisions, and notes are stored in this `context.md` file.

## Status

- [x] Monorepo layout (client/ + server/)
- [x] Admin layout: red Sidebar + white Topbar + white canvas
- [x] Theme system (deep red sidebar, white active pill, white canvas)
- [x] Default page: data table (search, level filter, status chips, progress bar, pagination)
- [x] Placeholder page for /library
- [ ] Connect table to real API
- [ ] Library page (CRUD bài tập, video)
- [ ] Auth flow (login → admin panel)
- [ ] Additional sidebar items (Khảo sát, Quy tắc thăng tiến, Tiêu chí lên cấp)
