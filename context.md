# CalisHealth - Project Context

## Project Overview

**CalisHealth** is a web application that provides users with calisthenic (bodyweight) training resources. The platform is designed to help users learn, plan, and perform calisthenic workouts and programs.

## Repo Layout (Monorepo)

```
SEP490_G9_CalisHealth/
├── client/                  # React + Vite + Material UI frontend
│   ├── src/                 # pages, components, styles
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

- **Frontend (client/)**: React 18 + Vite + Material UI v6 + React Router + custom CSS
- **Backend (server/)**: Java Spring Boot (Maven) — see `server/pom.xml` for modules
- **Package Manager**: npm (client), Maven (server)

## Brand / Theme

- Domain: Calisthenic / bodyweight fitness
- Tone: Energetic, health-focused, accessible
- Recommended palette (subject to designer input):
  - Primary: energetic accent (e.g. cyan/teal)
  - Secondary: warm orange/red for energy
  - Background: light/dark mode via MUI Theme

## Conventions

- Component folder per feature under `client/src/components/<Feature>/`
- Pages live in `client/src/pages/`
- Shared layout (Navbar, Footer) in `client/src/components/layout/`
- Reusable styles in `client/src/styles/`
- All project context, decisions, and notes are stored in this `context.md` file.

## Status

- [x] Project scaffolded with Vite + React
- [x] MaterialUI integrated
- [x] Theme + responsive Navbar/Footer
- [x] Routing with placeholder Home / Workouts / Programs / About / Contact pages
- [x] Monorepo layout (client/ + server/)
- [ ] API integration (TBD)
- [ ] Authentication UI (TBD)
- [ ] Workout tracking features (TBD)
