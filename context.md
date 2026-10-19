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
│   │   │       ├── AdminLayout.jsx      # Sidebar + Topbar + main
│   │   │       ├── Sidebar.jsx
│   │   │       └── Topbar.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx            # Main overview page
│   │   │   └── PlaceholderPage.jsx      # For Library, Tracking (WIP)
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

The frontend uses an **admin panel** aesthetic (clean, light surfaces, deep red brand). Reference mockup: `assets/.../image-eb0ee597-*.png` (main dashboard).

### Color tokens
| Role | Token | Value | Use |
|------|-------|-------|-----|
| Primary | `primary.main` | `#B91C1C` (deep red) | Brand, active sidebar item, primary CTAs |
| Primary soft | `--color-primary-soft` | `#FEE2E2` (red-100) | Active item background |
| Secondary | `secondary.main` | `#0F766E` (teal) | Accent (calisthenic/health vibe), stat icons |
| Background (canvas) | `background.default` | `#F5F5F7` | Main page background |
| Surface | `background.paper` | `#FFFFFF` | Sidebar, header, cards |
| Border | `divider` | `#E5E7EB` | Hairline borders, card outlines |
| Text primary | `text.primary` | `#1F2937` (slate-900) | Headings, body |
| Text secondary | `text.secondary` | `#6B7280` (gray-500) | Captions, labels |
| Success | `success.main` | `#10B981` | Positive deltas, completion |
| Error | `error.main` | `#DC2626` | Destructive / warnings |

### Typography
- Font family: **Inter** → Roboto → Helvetica → Arial (sans-serif)
- H1: 36/700, H2: 30/700, H3: 24/600, H4: 20/600, H5: 18/600, H6: 16/600
- Body: 15px / line-height 1.55, small: 14px / 1.5
- Buttons: 600 weight, **no uppercase** (`textTransform: "none"`)
- Letter-spacing: tight on H1/H2 (`-0.02em` / `-0.01em`)

### Layout system
- Sidebar width: **256px** (CSS var `--sidebar-width`), fixed left
- Topbar height: **64px** (CSS var `--header-height`), fixed top, offset by sidebar
- Main content: `ml: 256px, pt: 88px (header+24px), px: 32px`
- Border radius: **10px** (cards, buttons), **8px** (buttons specifically)
- Paper: white, 1px border, **no shadow** by default
- AppBar: white, bottom hairline border, no shadow

### Sidebar navigation
Active state: red-100 background + deep-red text/icon. Inactive: gray icon + slate text. Rounded 8px.

### Component overrides
- `MuiButton.containedPrimary`: no shadow, subtle red shadow on hover
- `MuiListItemButton.selected`: red-100 bg, red text/icon
- `MuiPaper`: 1px border, 0 elevation
- `MuiAppBar`: white bg, bottom border, 0 elevation

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
- [x] Admin layout: Sidebar + Topbar + AdminLayout
- [x] Theme system (deep red brand, light surfaces)
- [x] Dashboard with stat cards + recent activity + goal progress
- [x] Placeholder pages for /library and /tracking
- [ ] Connect Dashboard stats to real API
- [ ] Library page (CRUD bài tập, video)
- [ ] Tracking health & progress page (charts, user data)
- [ ] Auth flow (login → admin panel)
- [ ] Additional sidebar items (Khảo sát, Quy tắc thăng tiến, Tiêu chí lên cấp)
