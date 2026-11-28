/**
 * Shared helpers for the CalisHealth integration-test catalogue.
 *
 * A single catalogue entry describes one HTTP endpoint. The same entry is used to
 * generate:
 *   1. the Postman collection  (postman/build-collection.js)
 *   2. the Integration Test Excel report (postman/build-report.js)
 *
 * Keeping both artefacts derived from one source prevents the report and the
 * runnable requests from drifting apart.
 */

/** Roles used by the application's SecurityConfig. */
const ROLE = {
  NONE: 'none',
  MEMBER: 'member',
  ADMIN: 'admin',
  CONTENT: 'content',
  MEMBER_OR_CONTENT: 'memberOrContent',
};

/** Collection variables that hold the JWT of each role. */
const TOKEN_VAR = {
  member: 'memberToken',
  admin: 'adminToken',
  content: 'contentToken',
  memberOrContent: 'memberToken',
};

const PUBLIC = ROLE.NONE;

/**
 * Create a catalogue entry.
 *
 * @param {string} id            unique id, kebab-case
 * @param {string} method        HTTP verb
 * @param {string} path          path template, may contain {placeholders}
 * @param {object} opts
 * @param {string} opts.feature  feature sheet name (must match the Excel sheet)
 * @param {string} opts.section  function/section name inside the feature sheet
 * @param {string} opts.desc     test case description (column B)
 * @param {string[]} opts.proc   test case procedure steps (column C)
 * @param {string[]} opts.exp    expected results (column D)
 * @param {string[]} opts.pre    pre-conditions (column E)
 * @param {string} opts.role     role required by the endpoint
 * @param {object} opts.body     JSON body
 * @param {object} opts.query    query string parameters
 * @param {object} opts.form     multipart/form-data fields (file -> value)
 * @param {number[]} opts.expect expected HTTP status codes
 * @param {string[]} opts.tests  extra pm.test assertions
 */
function E(id, method, path, opts) {
  const o = opts || {};
  return {
    id,
    method,
    path,
    feature: o.feature,
    section: o.section,
    desc: o.desc,
    proc: o.proc || [],
    exp: o.exp || [],
    pre: o.pre || [],
    role: o.role || ROLE.MEMBER,
    body: o.body,
    query: o.query,
    form: o.form,
    expect: o.expect || [200],
    tests: o.tests || [],
    tcId: o.tcId, // optional explicit test-case id override
    // --- details used to expand the report cells ---------------------------
    extraSteps: o.extraSteps || [], // manual steps performed before sending
    extraPre: o.extraPre || [], // additional pre-conditions
    pathValues: o.pathValues || null, // concrete values for the path variables
    results: o.results || null, // full override of the Expected Results cell
  };
}

/** Standard pre-condition list used by most member-facing cases. */
const PRE_AUTH = [
  '1. CalisHealth server is running and reachable at {{baseUrl}}',
  '2. A MEMBER account exists, is email-verified and has an active session token',
];
const PRE_ADMIN = [
  '1. CalisHealth server is running and reachable at {{baseUrl}}',
  '2. An ADMIN account exists and has an active session token',
];
const PRE_CONTENT = [
  '1. CalisHealth server is running and reachable at {{baseUrl}}',
  '2. A CONTENT_MANAGER account exists and has an active session token',
];
const PRE_GUEST = [
  '1. CalisHealth server is running and reachable at {{baseUrl}}',
  '2. The request is sent without an Authorization header (guest role)',
];

/** Build a readable "Test Case Procedure" cell. */
function procText(steps) {
  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/** Build a readable "Expected Results" cell. */
function expText(items) {
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/**
 * Build a readable "Pre-conditions" cell.
 *
 * The catalogue stores the pre-conditions with their own "1." / "2." markers,
 * so the numbers are stripped here and re-applied to keep the list tidy.
 */
function preText(items) {
  return items
    .map((s) => String(s).replace(/^\s*\d+[.)]\s*/, ''))
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');
}

/** Escape a value for use inside a Postman raw JSON body. */
function j(v) {
  return JSON.stringify(v, null, 2);
}

module.exports = { E, ROLE, TOKEN_VAR, PUBLIC, PRE_AUTH, PRE_ADMIN, PRE_CONTENT, PRE_GUEST, procText, expText, preText, j };
