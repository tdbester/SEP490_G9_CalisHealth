# CalisHealth - Project Context

## Project Overview

**CalisHealth** is a web application that provides users with calisthenic (bodyweight) training resources. The platform is designed to help users learn, plan, and perform calisthenic workouts and programs.

## Tech Stack

- **Framework**: ReactJS (Standard) + Vite
- **Language**: JavaScript / JSX
- **UI Library**: Material UI (MUI v5+)
- **Styling**: CSS (custom) + MUI's `sx` prop / styled API
- **Routing**: React Router (planned)
- **Date utility**: dayjs (MUI peer dep)
- **Build Tool**: Vite
- **Package Manager**: npm

## Brand / Theme

- Domain: Calisthenic / bodyweight fitness
- Tone: Energetic, health-focused, accessible
- Recommended palette (subject to designer input):
  - Primary: energetic accent (e.g. cyan/teal)
  - Secondary: warm orange/red for energy
  - Background: light/dark mode via MUI Theme

## Conventions

- Component folder per feature under `src/components/<Feature>/`
- Pages live in `src/pages/`
- Shared layout (Navbar, Footer) in `src/components/layout/`
- Reusable styles in `src/styles/`
- All project context, decisions, and notes are stored in this `context.md` file.

## Status

- [x] Project scaffolded with Vite + React
- [x] MaterialUI integrated
- [x] Theme + responsive Navbar/Footer
- [x] Routing with placeholder Home / Workouts / Programs / About / Contact pages
- [ ] API integration (TBD)
- [ ] Authentication (TBD)
- [ ] Workout tracking features (TBD)
