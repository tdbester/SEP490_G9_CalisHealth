/**
 * Builds the natural-language "Test Case Procedure" / "Expected Results" /
 * "Pre-conditions" cells of the Integration Test report.
 *
 * The wording follows the style of the SEP490 template: short, imperative steps
 * that describe what the tester does on the screen, and results phrased the way
 * the client displays them. The screen names, field labels and button labels
 * come from `catalog/_ui.js`, which mirrors the English translation keys of the
 * React client (client/src/i18n/locales/en/*.js).
 */
const { ROLE } = require('./_helpers');
const { specFor } = require('./_ui');

/** Human label for every request field that appears in the catalogue. */
const FIELD_LABELS = {
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  newPassword: 'New password',
  confirmNewPassword: 'Confirm new password',
  oldPassword: 'Current password',
  currentPassword: 'Current password',
  fullName: 'Full name',
  phone: 'Phone number',
  gender: 'Gender',
  dateOfBirth: 'Date of birth',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  note: 'Note',
  token: 'token',
  surveyCode: 'survey code',
  surveyVersion: 'survey version',
  stepCode: 'step code',
  stepId: 'step ID',
  sessionId: 'session ID',
  exerciseCode: 'exercise',
  exerciseCodes: 'exercises',
  questionCodes: 'question codes',
  stepIds: 'step IDs',
  workoutCode: 'workout code',
  templateCode: 'template code',
  code: 'code',
  name: 'Name',
  description: 'Description',
  title: 'Title',
  content: 'Content',
  category: 'Category',
  level: 'Level',
  levels: 'fitness levels',
  type: 'Type',
  status: 'Status',
  role: 'Role',
  active: 'Active',
  answers: 'Answers',
  entries: 'Entries',
  days: 'Days',
  items: 'Exercise items',
  ids: 'IDs',
  rules: 'Rules',
  action: 'Action',
  resolutionNote: 'Resolution note',
  rejectionReason: 'Rejection reason',
  area: 'Area',
  locked: 'Locked',
  reason: 'Reason',
  message: 'Message',
  startsAt: 'Start time',
  endsAt: 'End time',
  affectedAreas: 'Affected areas',
  notifyMembers: 'Notify members',
  reminderHours: 'Reminder hours',
  targetAudience: 'Target audience',
  sets: 'Sets',
  question: 'Message',
  page: 'Page',
  size: 'Page size',
  search: 'Search keyword',
  sort: 'Sort order',
  movementGroup: 'Movement group',
  data: 'exercise data',
  file: 'File',
  videoFile: 'Video file',
  maxVideoMb: 'Maximum video size (MB)',
  minAccuracy: 'Minimum accuracy (%)',
  requiredSets: 'Required sets',
  requiredReps: 'Required reps',
  requiredSeconds: 'Required seconds',
  prerequisiteCode: 'Prerequisite exercise',
  isSharedWithCommunity: 'Share with the community',
  daysPerWeek: 'Training days per week',
  days: 'Days',
  countBy: 'Count by',
  memberId: 'Member ID',
  levelId: 'Level ID',
  itemType: 'Item type',
  itemId: 'Item ID',
  serviceKey: 'Service key',
  month: 'Month',
  year: 'Year',
  targetMuscle: 'Target muscle',
  guideSteps: 'Guide steps',
  isActive: 'Active',
  value: 'Value',
  questionCode: 'Question code',
  goalPrimary: 'Primary goal',
  goalTimeline: 'Timeline goal',
  trainingDays: 'Training days per week',
  levelTest: 'Level test answers',
  mappings: 'Mappings',
};

/** Natural description of the collection variables of the Postman collection. */
const VAR_NAMES = {
  verifyToken: 'the token received in the verification email',
  resetToken: 'the token received in the password reset email',
  expiredResetToken: 'an expired token received in the password reset email',
  memberId: 'the selected member',
  scheduleEntryId: 'the selected schedule entry',
  aiSessionId: 'the selected AI session',
  otherMemberSessionId: 'a session of another member',
  otherMemberExerciseId: 'an exercise of another member',
  otherMemberWorkoutId: 'a workout of another member',
};

/** Natural label of a query string parameter. */
const QUERY_LABELS = {
  page: 'page number',
  size: 'page size',
  search: 'search keyword',
  sort: 'sort order',
  role: 'role',
  status: 'status',
  type: 'type',
  category: 'category',
  level: 'level',
  levelId: 'level',
  month: 'month',
  year: 'year',
  memberId: 'member',
  exerciseCode: 'exercise',
  surveyCode: 'survey',
  movementGroup: 'movement group',
  serviceKey: 'service',
  token: 'token',
};

/** Natural label of a field inside a JSON body. */
const JSON_LABELS = {
  questionCode: 'the question',
  questionType: 'the question type',
  value: 'the value',
  date: 'the date',
  dayIndex: 'the day',
  workoutCode: 'the workout',
  exerciseCode: 'the exercise',
  code: 'the code',
  title: 'the title',
  name: 'the name',
  description: 'the description',
  level: 'the level',
  type: 'the type',
  muscleGroup: 'the muscle group',
  targetMuscle: 'the target muscle',
  equipment: 'the equipment',
  itemType: 'the item type',
  id: 'the id',
  status: 'the status',
};

/** Natural phrasing of a numeric field inside a JSON body. */
const JSON_NUMBERS = {
  sets: (v) => `${v} sets`,
  reps: (v) => `${v} repetitions`,
  restSeconds: (v) => `${v} seconds of rest`,
  totalReps: (v) => `${v} repetitions in total`,
  cleanReps: (v) => `${v} clean repetitions`,
  totalSeconds: (v) => `${v} seconds in total`,
  dayIndex: (v) => `day ${v}`,
  score: (v) => `a score of ${v}`,
  defaultSets: (v) => `${v} sets by default`,
  defaultReps: (v) => `${v} repetitions by default`,
  requiredSets: (v) => `${v} required sets`,
  requiredReps: (v) => `${v} required repetitions`,
  requiredSeconds: (v) => `${v} required seconds`,
};

/** Screens that differ from the one of the section they belong to. */
const PATH_UI = {
  '/api/auth/me': { action: 'Open the Profile screen' },
  '/api/profile': { action: 'Navigate to the Profile screen' },
  '/api/dashboard': { action: 'Log in and land on the Dashboard screen' },
  '/api/survey-sessions/{sessionId}/result': { action: 'Open the survey result screen' },
  '/api/member/schedule/plan-info': { action: 'Open the active training plan screen' },
  '/api/member/schedule/today': { action: 'Open the workout of the day on the Dashboard screen' },
  '/api/member/schedule/week-rule': { action: 'Open the weekly schedule rule on the Workout schedule screen' },
  '/api/member/schedule/workouts': { action: 'Open the list of schedulable workouts on the Workout schedule screen' },
  '/api/notifications': { action: 'Open the notification list screen' },
  '/api/v1/library/exercises/{id}': { action: 'Open the exercise detail screen' },
};

/** Format a single field value for the report. */
function formatValue(key, value) {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value === '') return '"" (empty)';
    if (value.startsWith('{{')) return value;
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[] (empty)';
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

/** Label of a field, falling back to a readable form of the raw key. */
function label(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Name of the collection variable a value refers to, or null. */
function templateVar(value) {
  const m = String(value).match(/^\{\{([A-Za-z0-9_]+)\}\}$/);
  return m ? m[1] : null;
}

/** Describe one field of a JSON object in plain language. */
function describeField(key, value) {
  if (value === null || value === undefined) return `${JSON_LABELS[key] || 'the ' + label(key).toLowerCase()} is empty`;
  if (Array.isArray(value)) {
    const joined = value.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ');
    return `${JSON_LABELS[key] || 'the ' + label(key).toLowerCase()} "${joined}"`;
  }
  if (typeof value === 'number') {
    if (JSON_NUMBERS[key]) return JSON_NUMBERS[key](value);
    return `${JSON_LABELS[key] || 'the ' + label(key).toLowerCase()} ${value}`;
  }
  if (typeof value === 'boolean') {
    return `${JSON_LABELS[key] || 'the ' + label(key).toLowerCase()} ${value ? 'yes' : 'no'}`;
  }
  return `${JSON_LABELS[key] || 'the ' + label(key).toLowerCase()} "${value}"`;
}

/** Describe a JSON object in plain language. */
function describeObject(obj) {
  const parts = Object.keys(obj).map((k) => describeField(k, obj[k]));
  if (parts.length === 0) return 'an empty set of values';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Describe a JSON array in plain language. */
function describeArray(arr) {
  if (arr.length === 0) return 'no entry';
  if (arr.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
    return arr.map((v) => describeObject(v)).join('; ');
  }
  if (arr.every((v) => typeof v === 'string')) {
    return arr.map((v) => `"${v}"`).join(', ');
  }
  return arr.map((v) => describeField('value', v)).join(', ');
}

/** Describe the value of a request field in plain language. */
function describeBodyValue(key, value) {
  if (typeof value === 'string') {
    const varName = templateVar(value);
    if (varName) return VAR_NAMES[varName] || `the ${label(key).toLowerCase()}`;
    if (value === '') return '"" (empty)';
    return `"${value}"`;
  }
  if (Array.isArray(value)) return describeArray(value);
  if (value && typeof value === 'object') return describeObject(value);
  return formatValue(key, value);
}

/**
 * Extract the concrete value of a path variable from the catalogue notes.
 */
function extractPathValues(entry) {
  const values = {};
  for (const note of entry.proc || []) {
    const match = String(note).match(/^Path variables?: (.*)$/);
    if (!match) continue;
    for (const part of match[1].split(/,\s*(?=[a-zA-Z]+ =)/)) {
      const kv = part.match(/^\s*([a-zA-Z]+)\s*=\s*(.*)$/);
      if (kv) values[kv[1]] = kv[2].trim();
    }
  }
  return Object.keys(values).length ? values : null;
}

/**
 * Describe a path-variable value in a human readable way.
 *
 * `{{systemExerciseId}}` becomes "the selected exercise", so the procedure
 * reads like the sample instead of exposing a template variable.
 */
function describePathValue(key, value) {
  const raw = String(value).trim();
  const inner = raw.replace(/^"|"$/g, '');

  // Template variables are described by the record they point at.
  const NAMES = {
    sessionId: 'the active session',
    otherMemberSessionId: 'a session of another member',
    workoutSessionId: 'the selected workout session',
    systemExerciseId: 'the selected system exercise',
    systemWorkoutId: 'the selected system workout',
    memberExerciseId: 'the selected member exercise',
    rejectedExerciseId: 'the selected rejected exercise',
    otherMemberExerciseId: 'an exercise of another member',
    communityWorkoutId: 'the selected community workout',
    myWorkoutId: 'the selected personal workout',
    otherMemberWorkoutId: 'a workout of another member',
    notificationId: 'the selected notification',
    feedbackId: 'the selected feedback ticket',
    stepId: 'the selected survey step',
    ruleId: 'the selected progression rule',
    templateCode: 'the selected template',
    exerciseCode: 'the selected exercise',
    workoutCode: 'the selected workout',
    demoVideoFileName: 'the demo video of the exercise',
    anatomyImageFileName: 'the anatomy image of the exercise',
    memberId: 'the selected member',
  };

  if (inner.startsWith('{{')) {
    const name = inner.replace(/[{}]/g, '');
    const described = VAR_NAMES[name] || NAMES[name] || `the ${label(key).toLowerCase()}`;
    // "Select the selected exercise" reads badly -> "Select the exercise".
    return described.replace(/^the selected /, 'the ');
  }

  // A literal value stays as it is, quoted when it is a code-like token.
  const literal = /^[A-Z0-9_]+$/.test(inner) ? `"${inner}"` : raw;
  return literal;
}

/** Phrase a query string parameter as an action on the screen. */
function queryStep(key, value) {
  const varName = templateVar(value);
  const text = varName ? VAR_NAMES[varName] : formatValue(key, value);

  if (key === 'search') return `Search for ${text}`;
  if (key === 'page') return `Go to page ${String(value)}`;
  if (key === 'size') return `Set the page size to ${String(value)}`;
  if (key === 'sort') return `Sort by ${text}`;
  if (key === 'token') return `Use ${text}`;
  if (varName) return `Filter the list by the ${QUERY_LABELS[key] || label(key).toLowerCase()} ${text}`;
  return `Set the "${QUERY_LABELS[key] || label(key).toLowerCase()}" filter to ${text}`;
}

/**
 * Build the steps that fill in the request, phrased as UI actions.
 */
function fieldSteps(entry, ui) {
  const steps = [];

  const pathVars = entry.path.match(/\{[^}]+\}/g) || [];
  const pathValues = entry.pathValues || extractPathValues(entry);
  for (const raw of pathVars) {
    const key = raw.slice(1, -1);
    const value = pathValues && pathValues[key];
    if (value) {
      steps.push(`Select ${describePathValue(key, value)}`);
    }
  }

  if (entry.query) {
    for (const [key, value] of Object.entries(entry.query)) {
      steps.push(queryStep(key, value));
    }
  }

  if (entry.form) {
    for (const [key, value] of Object.entries(entry.form)) {
      const v = String(value);
      if (v.startsWith('@')) {
        steps.push(`Choose the local file "${v.slice(1)}" for the "${label(key)}" field`);
      } else {
        // The multipart "data" part carries a JSON document; describe it in
        // plain language instead of dumping the raw payload.
        let described = describeBodyValue(key, value);
        if (key === 'data') {
          try {
            described = describeObject(JSON.parse(v));
          } catch (err) {
            /* keep the raw description when the payload is not valid JSON */
          }
        }
        steps.push(`Fill in the "${label(key)}" field with ${described}`);
      }
    }
  }

  if (entry.body && !entry.form) {
    for (const key of Object.keys(entry.body)) {
      const value = entry.body[key];
      if (value === undefined) continue;
      const fieldLabel = (ui.fields && ui.fields[key]) || label(key);
      steps.push(`Enter the "${fieldLabel}" field with ${describeBodyValue(key, value)}`);
    }
  }

  return steps;
}

/** Words that carry no meaning when two expected results are compared. */
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'from', 'are', 'for', 'its', 'has',
  'have', 'not', 'but', 'all', 'any', 'can', 'was', 'will', 'into', 'per',
  'their', 'them', 'they', 'then', 'than', 'each', 'other', 'such', 'when',
  'where', 'which', 'while', 'shown', 'show', 'shows', 'displayed', 'display',
  'returns', 'return', 'contain', 'contains', 'includes', 'include',
]);

/**
 * Build the natural-language procedure of a test case.
 */
function buildProcedure(entry) {
  const ui = specFor(entry.section);
  const override = PATH_UI[entry.path];
  const steps = [];

  // The first step must match the role the case runs with: an administrator
  // opens the admin screens, a content manager the content screens and a
  // member the member screens.
  let action = (override && override.action) || ui.action;
  const screenMatch = action.match(/ and open the (.+) screen$/);
  const screen = screenMatch ? screenMatch[1] : null;

  if (screen) {
    if (entry.role === ROLE.NONE) {
      // A guest opens the screen without signing in.
      action = `Open the ${screen} screen without signing in`;
    } else if (entry.role === ROLE.ADMIN) {
      action = `Log in with an ADMIN account and open the ${screen} screen`;
    } else if (entry.role === ROLE.CONTENT) {
      action = `Log in with a CONTENT_MANAGER account and open the ${screen} screen`;
    } else if (entry.role === ROLE.MEMBER) {
      action = `Log in with a MEMBER account and open the ${screen} screen`;
    }
  }
  steps.push(action);

  const fields = fieldSteps(entry, ui);
  if (fields.length) {
    steps.push(...fields);
  }

  // Only a request that carries data has a button to press; a read-only
  // screen or a link opened from an email simply has to be opened.
  if (ui.submit && (entry.body || entry.form)) {
    steps.push(`Click the "${ui.submit}" button`);
  }

  return steps;
}

/**
 * Build the natural-language pre-conditions of a test case.
 */
function buildPreConditions(entry) {
  const steps = [];

  steps.push('Access to CalisHealth via link');

  if (entry.role === ROLE.ADMIN) {
    steps.push('Login with an ADMIN account');
  } else if (entry.role === ROLE.CONTENT) {
    steps.push('Login with a CONTENT_MANAGER account');
  } else if (entry.role !== ROLE.NONE) {
    steps.push('Login with a MEMBER account');
  }

  // The catalogue pre-conditions that describe the data under test.
  const scenario = (entry.pre || [])
    .map((p) => String(p).replace(/^\s*\d+[.)]\s*/, ''))
    .filter(
      (p) =>
        !/^CalisHealth server is running/.test(p) &&
        !/^The request is sent without an Authorization header/.test(p) &&
        !/^(A|An) (MEMBER|ADMIN|CONTENT_MANAGER) account exists/.test(p),
    );

  for (const extra of entry.extraPre || []) {
    steps.push(extra);
  }
  for (const s of scenario) {
    steps.push(polish(s));
  }

  return steps;
}

/**
 * Build the natural-language expected results of a test case.
 */
function buildExpected(entry) {
  const ui = specFor(entry.section);
  const steps = [];

  // An entry may override the result wording entirely (used when the generic
  // rewrite would not read naturally for that scenario).
  if (entry.results) {
    return entry.results;
  }

  for (const e of entry.exp) {
    steps.push(rewriteExpectation(e, ui));
  }

  // The generic success line often repeats the detail line of the same case.
  const seen = [];
  return steps.filter((s) => {
    const words = new Set(
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    );
    // Drop a line when an earlier line already says the same thing.
    for (const previous of seen) {
      let shared = 0;
      for (const w of words) if (previous.has(w)) shared++;
      if (shared > 0 && shared >= words.size * 0.8) return false;
    }
    seen.push(words);
    return true;
  });
}

/**
 * Clean up the rewritten expectation so it reads like the template.
 *
 * - closes the quote that the "Display error message: \"" rewrite opened
 * - replaces the remaining technical wording by its user-facing equivalent
 */
function polish(text) {
  let out = String(text);

  // The error message itself must not repeat the technical prefix.
  if (/^Display error message: "/.test(out)) {
    const first = out.indexOf('"');
    let rest = out.slice(first + 1);
    rest = rest
      .replace(/^The screen (reports|states|explains) /, '')
      .replace(/^the screen (reports|states|explains) /, '');
    out = out.slice(0, first + 1) + rest;
    if (!out.slice(first + 1).includes('"')) {
      out = out.replace(/[.,;:]\s*$/, '') + '"';
    }
  }

  // A success message must always be closed.
  if (/^Display (success )?message: "/.test(out)) {
    const first = out.indexOf('"');
    if (!out.slice(first + 1).includes('"')) {
      out = out.replace(/[.,;:]\s*$/, '') + '"';
    }
  }

  // Wording that is still too technical for the report.
  out = out
    .replace(/^The file is served with the content type an image type such as image\/png or image\/jpeg$/,
      'The image is displayed in the browser')
    .replace(/^The file is served with the content type "application\/json"$/,
      'The screen reads the data as a JSON document')
    .replace(/^The screen carries the video content and supports range requests for seeking$/,
      'The video can be played and the progress can be seeked')
    .replace(/^The screen does not contain any video content$/, 'No video is displayed')
    .replace(/^The screen does not contain any image content$/, 'No image is displayed')
    .replace(/^The body can be parsed as JSON without an HTML error page$/,
      'The screen shows the data instead of the error page')
    .replace(/^The response is JSON, not an HTML login page$/,
      'The screen shows the data instead of the login page')
    .replace(/^Display the items array with /g, 'Display the list of ')
    .replace(/^Display the paging metadata \(page, size, total elements\)$/,
      'Display the paging information (page, size and total number of items)');

  // User-facing replacements for the remaining technical wording.
  out = out
    .replace(/^Display array of /, 'Display a list of ')
    .replace(/^Display an array of /, 'Display a list of ')
    .replace(/^The session token property is null \(the endpoint does not re-issue a token\)$/,
      'No new session token is issued')
    .replace(/^Display success message: "The registration succeeded and asks the user to check email"$/,
      'Display message: "Please check your email to verify your account"')
    .replace(/^Display success message: "The verification link is valid"$/,
      'Display message: "The verification link is valid"')
    .replace(/^Display success message: "The email was verified and the user can now log in"$/,
      'Display success message: "The email was verified, you can now log in"')
    .replace(/^Display success message: "The password reset token is valid"$/,
      'Display message: "The password reset link is valid"')
    .replace(/^Display success message: "The password was reset and the user must log in again"$/,
      'Display success message: "The password was reset, please log in again"')
    .replace(/^Display success message: "The password was changed"$/,
      'Display success message: "The password was changed"')
    .replace(/Content-Type header matches the media type of the file \(for example video\/mp4\)/g,
      'The video is played in the browser')
    .replace(/Content-Type header is an image type such as image\/png or image\/jpeg/g,
      'The image is displayed in the browser')
    .replace(/Content-Type header is "application\/json"/g,
      'The screen reads the data as a JSON document')
    .replace(/Logging in with the new password succeeds and returns a JWT/g,
      'Log in with the new password succeeds')
    .replace(/The account becomes enabled, so a subsequent login returns HTTP 200/g,
      'The account is activated, so the member can log in right away')
    .replace(/The Authorization header carries a valid JWT of that member/g,
      'The member is signed in with a valid session')
    .replace(/The Authorization header has been removed/g,
      'The member is not signed in')
    .replace(/"token" \(JWT\), "email", "fullName", "role" = "MEMBER" and "mustChangePassword" = false/g,
      'the signed-in member information (email, full name, role and the password-change flag)')
    .replace(/No "token" property is present in the response body/g, 'No session token is issued')
    .replace(/The screen shows no (.+?) property is present in the screen/g, 'No $1 is issued')
    .replace(/The screen shows no (.+?) is (created|saved|disclosed|returned|stored|removed|issued|queued|sent)$/g,
      'No $1 is $2')
    .replace(/The screen shows no (.+?) row is created/g, 'No new $1 is created')
    .replace(/is disclosed in the screen/g, 'is displayed on the screen')
    .replace(/^A new (\w+) row is created for the member$/, 'A new $1 is created for the member')
    .replace(/"GET ([^"]+)"/g, (m, p) => `the ${p.split('/').pop().replace(/[{}]/g, '')} screen`)
    .replace(/the detail endpoint/g, 'the detail screen')
    .replace(/the exercise detail endpoint/g, 'the exercise detail screen')
    .replace(/the affected endpoints/g, 'the affected screens')
    .replace(/No user data is disclosed on the screen/g, 'No user data is displayed on the screen')
    .replace(/No (\w[\w\s]*?) is displayed on the screen/g, 'No $1 is displayed on the screen')
    .replace(/The screen shows no (.+?) (leaks|is disclosed) into the response/g, 'No $1 leaks into the response')
    .replace(/The screen shows no (.+?) is disclosed in the screen/g, 'No $1 is disclosed')
    .replace(/The screen shows no (.+?) is returned/g, 'No $1 is returned')
    .replace(/The screen shows no (.+?) is disclosed/g, 'No $1 is disclosed')
    .replace(/The screen shows no (.+?) is created/g, 'No $1 is created')
    .replace(/The screen shows no (.+?) is saved/g, 'No $1 is saved')
    .replace(/The screen shows no (.+?) is stored/g, 'No $1 is stored')
    .replace(/The screen shows no (.+?) is removed/g, 'No $1 is removed')
    .replace(/The screen shows no (.+?) is issued/g, 'No $1 is issued')
    .replace(/The screen shows no (.+?) is queued/g, 'No $1 is queued')
    .replace(/The screen shows no (.+?) is sent/g, 'No $1 is sent')
    .replace(/"token"/g, 'session token')
    .replace(/is not present in the response body/g, 'is issued')
    .replace(/the response body/g, 'the screen')
    .replace(/Response body/g, 'The screen')
    .replace(/the plain-text password/g, 'the password')
    .replace(/a "message" describing that /g, 'the message ')
    .replace(/The screen does not show the password/g, 'The password is never displayed')
    .replace(/Display error message: "the email has already been registered/g,
      'Display error message: "Email is already registered"')
    .replace(/Display error message: "that the password does not satisfy the strong-password requirement/g,
      'Display error message: "Password must be at least 8 characters and include uppercase, lowercase, a digit and a special character"')
    .replace(/Display error message: "that answers must contain 1 to 100 items/g,
      'Display error message: "The answers must contain 1 to 100 items"')
    .replace(/Display error message: "that the template was not found/g,
      'Display error message: "The requested data was not found"')
    .replace(/Display error message: "the name is already used/g,
      'Display error message: "The name is already in use"')
    .replace(/Display error message: ", if the email exists, a reset link has been sent/g,
      'Display message: "If the email exists, we have sent a reset link. Please check your inbox."')
    .replace(/Display error message: "that, if the email exists, a reset link has been sent/g,
      'Display message: "If the email exists, we have sent a reset link. Please check your inbox."')
    .replace(/Display error message: "The screen explains /g, 'Display error message: "')
    .replace(/Display error message: "the /g, 'Display error message: "The ')
    .replace(/Display error message: "a /g, 'Display error message: "A ')
    .replace(/Display error message: "only /g, 'Display error message: "Only ')
    .replace(/Display error message: "at least /g, 'Display error message: "At least ')
    .replace(/Display error message: "answers /g, 'Display error message: "Answers ')
    .replace(/Display error message: "maxVideoMb is required/g,
      'Display error message: "The maximum video size is required"')
    .replace(/Display error message: "surveyCode is required/g,
      'Display error message: "The survey code is required"')
    .replace(/Display error message: "the UNKNOWN_FIELD error/g,
      'Display error message: "The field is not allowed"');

  // Capitalise the first letter of a quoted error message.
  out = out.replace(/Display error message: "([a-z])/g, 'Display error message: "');

  // Fix the messages that lost their first letter.
  out = out
    .replace(/Display error message: "hether the text is acceptable/g,
      'Display error message: "Whether the text is acceptable')
    .replace(/Display error message: "A validation error for "([a-zA-Z]+)"/g,
      'Display error message: "Invalid data for the $1 field"')
    .replace(/Display error message: "A validation error for the "([a-zA-Z]+)" field"/g,
      'Display error message: "Invalid data for the $1 field"')
    .replace(/Display error message: "The new favourite state as (true|false)/g,
      'Display error message: "Invalid data"')
    .replace(/Display error message: "The allowed notification types/g,
      'Display error message: "Invalid data"')
    .replace(/Display error message: "The UNKNOWN_FIELD error/g,
      'Display error message: "The field is not allowed"')
    .replace(/Display error message: "The missing height field/g,
      'Display error message: "Invalid data"')
    .replace(/Display error message: "The submission as not acceptable and names the flagged words/g,
      'Display error message: "The submission is not acceptable"')
    .replace(/Display error message: "The validation result and lists the invalid answers with their reason/g,
      'Display error message: "Invalid data"')
    .replace(/Display error message: "The survey version mismatch/g,
      'Display error message: "The survey version does not match"');

  // A message that already ends with a quote must not get a second one.
  out = out.replace(/""$/, '"');

  return out;
}

/**
 * Rewrite a catalogue expectation into the phrasing of the template.
 *
 * `HTTP 200 OK is returned` becomes the outcome the user actually sees.
 */
function rewriteExpectation(expectation, ui) {
  const text = String(expectation).trim();
  return polish(rewrite(text, ui));
}

/**
 * Turn a catalogue expectation into the phrasing of the template.
 */
function rewrite(text, ui) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // --- success ------------------------------------------------------------
  if (/^HTTP 200 OK \(or 204 No Content\) is returned$/.test(text)) {
    return ui.results.success || 'Display the expected data on the screen';
  }
  if (/^HTTP 200 OK is returned for both requests$/.test(text)) {
    return ui.results.success || 'Display the expected data on the screen';
  }
  if (/^HTTP 200 OK( \(or 201 Created\))? is returned$/.test(text)) {
    return ui.results.success || 'Display the expected data on the screen';
  }
  if (/^HTTP 201 Created is returned$/.test(text)) {
    return ui.results.created || ui.results.success || 'Display the created record';
  }
  if (/^HTTP 204 No Content( \(or 200 OK\))? is returned$/.test(text)) {
    return ui.results.success || 'Display the expected data on the screen';
  }

  // --- client side errors -------------------------------------------------
  if (/^HTTP 400 Bad Request is returned$/.test(text)) {
    return ui.results.invalid || 'Display error message: "Invalid data"';
  }
  if (/^HTTP 400 Bad Request \(or 404 Not Found\) is returned$/.test(text)) {
    return ui.results.notFound || ui.results.invalid || 'Display error message: "Invalid data"';
  }
  if (/^HTTP 400 Bad Request \(or 409 Conflict\) is returned$/.test(text)) {
    return ui.results.conflict || ui.results.invalid || 'Display error message: "Invalid data"';
  }
  if (/^HTTP 400 Bad Request is returned \(or 401 when the session is invalid\)$/.test(text)) {
    return ui.results.invalid || 'Display error message: "Invalid data"';
  }
  if (/^HTTP 401 Unauthorized is returned$/.test(text)) {
    return ui.results.unauthorized || 'Display error message: "Please log in to continue"';
  }
  if (/^HTTP 403 Forbidden( \(or 404 Not Found\))? is returned$/.test(text)) {
    return ui.results.forbidden || 'Display error message: "You do not have access to this area"';
  }
  if (/^HTTP 404 Not Found is returned( \(or 200 with an empty array\))?$/.test(text)) {
    return ui.results.notFound || 'Display error message: "The requested data was not found"';
  }
  if (/^HTTP 409 Conflict is returned$/.test(text)) {
    return ui.results.conflict || 'Display error message: "Invalid data"';
  }
  if (/^HTTP 429 Too Many Requests is returned$/.test(text)) {
    return ui.results.rateLimit || 'Display error message: "Too many requests, please try again later"';
  }

  // --- assertions about the payload --------------------------------------
  if (/^No /.test(text)) {
    return text.replace(/^No /, 'The screen shows no ');
  }
  if (/^Response body (does not|does NOT) contain /.test(text)) {
    return text.replace(/^Response body (does not|does NOT) contain /, 'The screen does not show ');
  }
  if (/^Response body "?message"? confirms (.*)$/.test(text)) {
    return `Display success message: "${cap(text.replace(/^Response body "?message"? confirms /, ''))}"`;
  }
  if (/^Response body confirms (.*)$/.test(text)) {
    return `Display success message: "${cap(text.replace(/^Response body confirms /, ''))}"`;
  }
  if (/^Response body message states (.*)$/.test(text)) {
    return `Display message: "${cap(text.replace(/^Response body message states /, ''))}"`;
  }
  if (/^Response body contains /.test(text)) {
    return text.replace(/^Response body contains /, 'Display ');
  }
  if (/^Response body is an? /.test(text)) {
    return text.replace(/^Response body is an? /, 'Display ');
  }
  if (/^Response body (reports|states|explains) /.test(text)) {
    // "reports that X" -> 'Display error message: "X"'
    let body = text.replace(/^Response body (reports|states|explains) that /, '');
    body = body.replace(/^Response body (reports|states|explains) /, '');
    return `Display error message: "${body}"`;
  }
  if (/^Response body reflects /.test(text)) {
    return text.replace(/^Response body reflects /, 'Display the updated ');
  }
  if (/^Response body shows /.test(text)) {
    return text.replace(/^Response body shows /, 'Display ');
  }
  if (/^Response body summarises /.test(text)) {
    return text.replace(/^Response body summarises /, 'Display ');
  }
  if (/^Content-Type header is /.test(text)) {
    return text.replace(/^Content-Type header is /, 'The file is served with the content type ');
  }
  if (/^The response (body|message|is|does)/.test(text)) {
    return text.replace(/^The response body /, 'The screen ');
  }

  // Everything else is already phrased as an observation; keep it.
  return text;
}

module.exports = {
  buildProcedure,
  buildPreConditions,
  buildExpected,
  extractPathValues,
  formatValue,
  label,
};
