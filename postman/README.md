# CalisHealth Integration Test — Postman artefacts

Everything in this folder is **generated** from a single source of truth: the
endpoint catalogue in `postman/catalog/`. The Postman collection and the
Excel Integration Test report are therefore always in sync.

```
postman/
├── catalog/                     # one entry per REST endpoint
│   ├── _helpers.js              # catalogue entry factory + shared pre-conditions
│   ├── _detail.js               # expands an entry into the detailed report cells
│   ├── 01-authentication.js
│   ├── 02-onboarding-survey.js
│   ├── 03-dashboard-routine.js
│   ├── 04-tracking-progress.js
│   ├── 05-pose-ai-support.js
│   ├── 06-library.js
│   ├── 07-admin.js
│   └── 08-content-management.js
├── build-collection.js          # catalogue -> Postman collection
├── build-report.js              # catalogue -> Excel Integration Test report
├── collections/
│   └── CalisHealth Integration Test.postman_collection.json
└── environments/
    └── CalisHealth Local.postman_environment.json
```

## How the report cells are written

The catalogue stores each endpoint compactly. `catalog/_ui.js` binds every
section to the screen of the React client that exercises it (screen name, field
labels and button labels taken from the English translation keys of
`client/src/i18n/locales/en/*.js`). `catalog/_detail.js` then expands the entry
into the report cells:

| Column | Content |
|---|---|
| **Test Case Procedure** | `Navigate to the <screen>` → one step per input field → `Click the "<button>" button` |
| **Expected Results** | The outcome the user sees: `Display success message: "..."`, `Display error message: "..."`, `Redirect to the <screen>` |
| **Pre-conditions** | `Access to CalisHealth via link` + the account of the required role + the data the scenario needs |
| **Note** | The path of the Postman file and the exact folder + request to re-run |

The wording deliberately stays free of HTTP and Postman terminology, so the
report reads like the SEP490 template. The executable Postman collection is
generated from the same catalogue and therefore always stays in sync.

```
postman/
├── catalog/                     # one entry per REST endpoint
│   ├── _helpers.js              # catalogue entry factory + shared pre-conditions
│   ├── _ui.js                   # screen / field / button specification
│   ├── _detail.js               # expands an entry into the report cells
│   ├── 01-authentication.js
│   ├── 02-onboarding-survey.js
│   ├── 03-dashboard-routine.js
│   ├── 04-tracking-progress.js
│   ├── 05-pose-ai-support.js
│   ├── 06-library.js
│   ├── 07-admin.js
│   └── 08-content-management.js
├── build-collection.js          # catalogue -> Postman collection
├── build-report.js              # catalogue -> Excel Integration Test report
├── collections/
│   └── CalisHealth Integration Test.postman_collection.json
└── environments/
    └── CalisHealth Local.postman_environment.json
```

## Regenerating

```bash
npm install exceljs          # only needed for build-report.js
node postman/build-collection.js
node postman/build-report.js "E:/Report-5.2_Integration Test.xlsx"
```

> If the workbook is open in Excel, the script writes the result to a temporary
> file (`E:\.Report-5.2_Integration Test.xlsx.tmp`) and asks you to copy it over.

## Running the collection

1. Import `postman/collections/CalisHealth Integration Test.postman_collection.json`
   and `postman/environments/CalisHealth Local.postman_environment.json` into Postman.
2. Start the backend (`server/` module, Spring Boot on port 8080) with MySQL 8
   and the Flyway migrations applied.
3. Pick the **CalisHealth Local** environment and make sure `baseUrl` points to
   your server.
4. Log in as each role and copy the returned `token` into the collection
   variables `memberToken`, `adminToken` and `contentToken`:
   - `POST /api/auth/login` (member) → `memberToken`
   - `POST /api/auth/login` (admin) → `adminToken`
   - `POST /api/auth/login` (content manager) → `contentToken`
5. Run the collection with the Postman runner (Runner → Run) to execute every
   integration test case.

Each request carries its own `pm.test` assertions (HTTP status, JSON content
type and feature-specific body checks), so the run report shows exactly which
behaviour each test case establishes.

## Catalogue entry shape

```js
E('auth-login', 'POST', '/api/auth/login', {
  feature: 'Authentication',
  section: 'Login',
  desc: 'Login successfully with valid email and password of a verified member',
  proc: ['Run request "POST /api/auth/login" ...'],
  exp: ['HTTP 200 OK is returned', 'Response body contains "token"'],
  pre: PRE_GUEST,
  role: ROLE.NONE,
  body: { email: '{{memberEmail}}', password: '{{memberPassword}}' },
  expect: [200],
});
```

## Coverage

309 requests covering all 193 REST endpoints of the backend (public, member,
content-manager and admin areas), organised in the same 8 feature sheets as the
Excel report.
