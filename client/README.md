# CalisHealth

A modern calisthenic training web app built with React + Vite + Material UI.

## Stack
- **React 18** with hooks & functional components
- **Vite** (fast dev server + build)
- **Material UI (MUI v6)** for components and theming
- **React Router DOM** for client-side routing
- **Custom CSS** in `src/styles/global.css` for global utilities
- **dayjs** (MUI peer dependency)

## Getting Started

```bash
npm install
npm run dev
```

App runs at <http://localhost:5173>.

## Available Scripts

| Script           | Purpose                       |
| ---------------- | ----------------------------- |
| `npm run dev`    | Start Vite dev server         |
| `npm run build`  | Production build to `dist/`   |
| `npm run preview`| Preview the production build  |

## Project Structure

```
src/
├── components/
│   └── layout/        # Navbar, Footer
├── pages/             # Route pages (Home, Workouts, ...)
├── styles/
│   └── global.css     # Global CSS + utility classes
├── App.jsx            # Routes
├── main.jsx           # Entry: Theme + Router
└── theme.js           # MUI theme
```

## Routes
- `/` — Home (hero, features, CTA)
- `/workouts` — Browse + filter workouts
- `/programs` — Multi-week programs
- `/about` — About + team
- `/contact` — Contact form
- `*` — 404 page

## Notes
- All product/feature context lives in `context.md` at the repo root.
