/**
 * Builds the CalisHealth Postman collection (v2.1 schema) from the catalogue.
 *
 * Usage:
 *   node postman/build-collection.js
 *
 * Output:
 *   postman/collections/CalisHealth Integration Test.postman_collection.json
 */
const fs = require('fs');
const path = require('path');
const { all } = require('./catalog');
const { ROLE, TOKEN_VAR } = require('./catalog/_helpers');
const {
  buildProcedure,
  buildPreConditions,
  buildExpected,
} = require('./catalog/_detail');

const OUT_DIR = path.join(__dirname, 'collections');
const OUT_FILE = path.join(OUT_DIR, 'CalisHealth Integration Test.postman_collection.json');

/** Collection-level variables shared by every request. */
const collectionVariables = [
  { key: 'baseUrl', value: 'http://localhost:8080', type: 'string' },
  { key: 'apiUrl', value: '{{baseUrl}}/api', type: 'string' },
  { key: 'memberToken', value: '', type: 'string' },
  { key: 'adminToken', value: '', type: 'string' },
  { key: 'contentToken', value: '', type: 'string' },
  { key: 'memberEmail', value: 'member.calishealth@gmail.com', type: 'string' },
  { key: 'memberPassword', value: 'P@ssword1', type: 'string' },
  { key: 'adminEmail', value: 'admin@calishealth.local', type: 'string' },
  { key: 'adminPassword', value: 'P@ssword1', type: 'string' },
  { key: 'contentEmail', value: 'content.manager@calishealth.local', type: 'string' },
  { key: 'contentPassword', value: 'P@ssword1', type: 'string' },
  { key: 'memberId', value: '', type: 'string' },
  { key: 'verifyToken', value: '', type: 'string' },
  { key: 'resetToken', value: '', type: 'string' },
  { key: 'expiredResetToken', value: '', type: 'string' },
  { key: 'aiSessionId', value: '', type: 'string' },
  { key: 'scheduleEntryId', value: '', type: 'string' },
  { key: 'sessionId', value: '', type: 'string' },
  { key: 'otherMemberSessionId', value: '', type: 'string' },
  { key: 'workoutSessionId', value: '', type: 'string' },
  { key: 'systemExerciseId', value: '', type: 'string' },
  { key: 'systemWorkoutId', value: '', type: 'string' },
  { key: 'memberExerciseId', value: '', type: 'string' },
  { key: 'rejectedExerciseId', value: '', type: 'string' },
  { key: 'otherMemberExerciseId', value: '', type: 'string' },
  { key: 'communityWorkoutId', value: '', type: 'string' },
  { key: 'myWorkoutId', value: '', type: 'string' },
  { key: 'otherMemberWorkoutId', value: '', type: 'string' },
  { key: 'notificationId', value: '', type: 'string' },
  { key: 'feedbackId', value: '', type: 'string' },
  { key: 'stepId', value: '', type: 'string' },
  { key: 'ruleId', value: '', type: 'string' },
  { key: 'templateCode', value: '', type: 'string' },
  { key: 'exerciseCode', value: 'PULL_UP', type: 'string' },
  { key: 'workoutCode', value: '', type: 'string' },
  { key: 'demoVideoFileName', value: '', type: 'string' },
  { key: 'anatomyImageFileName', value: '', type: 'string' },
];

/** Build the request URL object (path + query + host). */
function buildUrl(entry) {
  const raw = `{{apiUrl}}${entry.path}`;
  const segments = raw.split('/').filter((s) => s !== '');
  const host = ['{{apiUrl}}'];
  const pathParts = segments.slice(1); // drop the "api" segment, the base already ends with /api
  return {
    raw,
    host,
    path: pathParts.map((p) => (p.startsWith('{') ? p : p)),
  };
}

/** Build the query array of a request. */
function buildQuery(entry) {
  if (!entry.query) return [];
  return Object.entries(entry.query).map(([key, value]) => ({
    key,
    value: String(value),
    disabled: false,
  }));
}

/** Build the header array of a request. */
function buildHeaders(entry) {
  const headers = [
    { key: 'Accept', value: 'application/json', disabled: false },
  ];

  if (entry.role !== ROLE.NONE) {
    const tokenVar = TOKEN_VAR[entry.role] || 'memberToken';
    headers.push({
      key: 'Authorization',
      value: `Bearer {{${tokenVar}}}`,
      disabled: false,
      description: 'JWT of the role that owns this endpoint. Replace the collection variable with the token returned by the login request.',
    });
  } else {
    headers.push({
      key: 'Authorization',
      value: '',
      disabled: true,
      description: 'This endpoint is public — no Authorization header is sent.',
    });
  }

  if (entry.body && !entry.form) {
    headers.push({ key: 'Content-Type', value: 'application/json', disabled: false });
  }

  return headers;
}

/** Build the body of a request (raw JSON or multipart form-data). */
function buildBody(entry) {
  if (entry.form) {
    return {
      mode: 'formdata',
      formdata: Object.entries(entry.form).map(([key, value]) => ({
        key,
        type: String(value).startsWith('@') ? 'file' : 'text',
        value: String(value),
        ...(String(value).startsWith('@')
          ? { src: String(value).slice(1) }
          : { contentType: 'application/json' }),
        disabled: false,
      })),
    };
  }

  if (entry.body) {
    return {
      mode: 'raw',
      raw: JSON.stringify(entry.body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return undefined;
}

/** Build the test script of a request. */
function buildTests(entry) {
  const expected = entry.expect.map((s) => `pm.response.code === ${s}`).join(' || ');
  const lines = [
    `pm.test('Status code is ${entry.expect.join(' or ')}', function () {`,
    `    pm.expect(${expected}).to.be.true;`,
    '});',
  ];

  if (entry.role !== ROLE.NONE) {
    lines.push(
      "pm.test('Response is JSON', function () {",
      "    pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json');",
      '});',
    );
  }

  for (const t of entry.tests) {
    lines.push(
      `pm.test(${JSON.stringify(t)}, function () {`,
      `    ${t};`,
      '});',
    );
  }

  return lines.join('\n');
}

/** Build one request item. */
function buildItem(entry) {
  const url = buildUrl(entry);
  const method = entry.method.toLowerCase();

  return {
    name: `${entry.method} ${entry.path}`,
    request: {
      method: entry.method,
      header: buildHeaders(entry),
      body: buildBody(entry),
      url,
      description: [
        entry.desc,
        '',
        'Pre-conditions:',
        ...buildPreConditions(entry).map((p) => `  ${p}`),
        '',
        'Test procedure:',
        ...buildProcedure(entry).map((p) => `  ${p}`),
        '',
        'Expected results:',
        ...buildExpected(entry).map((e) => `  ${e}`),
      ].join('\n'),
    },
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: buildTests(entry).split('\n'),
        },
      },
    ],
    response: [],
  };
}

/** Group the entries by feature and by section, preserving the catalogue order. */
function group() {
  const features = [];
  for (const entry of all) {
    let feature = features.find((f) => f.name === entry.feature);
    if (!feature) {
      feature = { name: entry.feature, sections: [] };
      features.push(feature);
    }
    let section = feature.sections.find((s) => s.name === entry.section);
    if (!section) {
      section = { name: entry.section, entries: [] };
      feature.sections.push(section);
    }
    section.entries.push(entry);
  }
  return features;
}

function build() {
  const features = group().map((feature) => ({
    name: feature.name,
    item: feature.sections.map((section) => ({
      name: section.name,
      item: section.entries.map(buildItem),
    })),
  }));

  const collection = {
    info: {
      name: 'CalisHealth Integration Test',
      _postman_id: 'calishealth-integration-test',
      description:
        'Integration test collection for the CalisHealth platform (SEP490_G9).\n\n' +
        'It covers every REST endpoint exposed by the Spring Boot backend, grouped by the ' +
        'feature sheets of the "Report-5.2_Integration Test.xlsx" document.\n\n' +
        'How to use:\n' +
        '1. Set the collection variable "baseUrl" to the address of the running server (default http://localhost:8080).\n' +
        '2. Run "Authentication > Login > Login successfully with valid email and password" and copy the ' +
        '"token" value of the response into the collection variable "memberToken".\n' +
        '3. Repeat the step for an ADMIN and a CONTENT_MANAGER account to fill "adminToken" and "contentToken".\n' +
        '4. Run the whole collection (or a single folder) to execute the integration tests.\n\n' +
        'Every request carries its own assertions so the run report shows exactly which ' +
        'behaviour each test case establishes.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: features,
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{memberToken}}', type: 'string' }],
    },
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            '// Keep the member token in sync so the requests of the next folders can reuse it.',
            "if (pm.response.code === 200 && pm.response.json() && pm.response.json().token) {",
            "    pm.collectionVariables.set('memberToken', pm.response.json().token);",
            '}',
          ],
        },
      },
    ],
    variable: collectionVariables,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(collection, null, 2), 'utf8');

  const count = all.length;
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  features : ${features.length}`);
  features.forEach((f) => {
    const n = f.item.reduce((acc, s) => acc + s.item.length, 0);
    console.log(`    - ${f.name} (${n} requests, ${f.item.length} sections)`);
  });
  console.log(`  requests : ${count}`);
}

build();
