/**
 * Feature: Tracking Health & Progress
 * Covers MemberTrackingController (/api/member/tracking/**) and
 * MemberProgressionController (/api/member/progression/results).
 */
const { E, ROLE, PRE_AUTH } = require('./_helpers');

const F = 'Tracking Health & Progress';

module.exports = [
  // ------------------------------------------- Tracking health & progress
  E('tracking-overview', 'GET', '/api/member/tracking/overview', {
    feature: F, section: 'Tracking health & progress', role: ROLE.MEMBER,
    desc: 'Open the Tracking Health & Progress overview screen',
    proc: [
      'Run request "GET /api/member/tracking/overview" from the Postman collection folder "Tracking > Tracking health & progress"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the current weight, height, BMI and the goal values',
      'Response body contains the progress summary versus the previous measurement',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('tracking-overview-unauthenticated', 'GET', '/api/member/tracking/overview', {
    feature: F, section: 'Tracking health & progress', role: ROLE.NONE,
    desc: 'Tracking overview rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/member/tracking/overview" from the Postman collection folder "Tracking > Tracking health & progress"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No measurement data is disclosed',
    ],
    pre: [...PRE_AUTH, '3. The Authorization header has been removed'],
    expect: [401],
  }),

  // ------------------------------------------- Update weight, height
  E('tracking-update-measurements', 'POST', '/api/member/tracking/measurements', {
    feature: F, section: 'Update weight, height', role: ROLE.MEMBER,
    desc: 'Update the current body weight and height of the member',
    proc: [
      'Run request "POST /api/member/tracking/measurements" from the Postman collection folder "Tracking > Update weight, height"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: weightKg = 72.5, heightCm = 175, note = "Weekly weigh-in"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the updated body metrics including the recomputed BMI',
      'The new values are visible in "GET /api/member/tracking/overview"',
    ],
    pre: [...PRE_AUTH],
    body: {
      weightKg: 72.5,
      heightCm: 175,
      note: 'Weekly weigh-in',
    },
    expect: [200],
  }),
  E('tracking-update-measurements-below-min', 'POST', '/api/member/tracking/measurements', {
    feature: F, section: 'Update weight, height', role: ROLE.MEMBER,
    desc: 'Weight update is rejected when the value is below the allowed minimum',
    proc: [
      'Run request "POST /api/member/tracking/measurements" from the Postman collection folder "Tracking > Update weight, height"',
      'Body: weightKg = 10 (minimum is 20.0 kg)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the minimum allowed weight is 20.0 kg',
      'The stored weight is unchanged',
    ],
    pre: [...PRE_AUTH],
    body: { weightKg: 10, heightCm: 175 },
    expect: [400],
  }),
  E('tracking-update-measurements-above-max', 'POST', '/api/member/tracking/measurements', {
    feature: F, section: 'Update weight, height', role: ROLE.MEMBER,
    desc: 'Height update is rejected when the value is above the allowed maximum',
    proc: [
      'Run request "POST /api/member/tracking/measurements" from the Postman collection folder "Tracking > Update weight, height"',
      'Body: heightCm = 300 (maximum is 250 cm)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the maximum allowed height is 250 cm',
      'The stored height is unchanged',
    ],
    pre: [...PRE_AUTH],
    body: { weightKg: 72.5, heightCm: 300 },
    expect: [400],
  }),
  E('tracking-update-measurements-missing-field', 'POST', '/api/member/tracking/measurements', {
    feature: F, section: 'Update weight, height', role: ROLE.MEMBER,
    desc: 'Measurement update is rejected when weight or height is missing',
    proc: [
      'Run request "POST /api/member/tracking/measurements" from the Postman collection folder "Tracking > Update weight, height"',
      'Body: only weightKg is provided, heightCm is removed',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports the missing height field',
      'No measurement is stored',
    ],
    pre: [...PRE_AUTH],
    body: { weightKg: 72.5 },
    expect: [400],
  }),

  // ------------------------------------------- Workout history
  E('tracking-workout-history', 'GET', '/api/member/tracking/workout-history', {
    feature: F, section: 'Workout history', role: ROLE.MEMBER,
    desc: 'View the list of past workout sessions of the member',
    proc: [
      'Run request "GET /api/member/tracking/workout-history" from the Postman collection folder "Tracking > Workout history"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout sessions with date, duration and the number of completed sets',
      'The sessions are ordered from the most recent to the oldest',
    ],
    pre: [...PRE_AUTH, '3. The member has completed at least one workout'],
    expect: [200],
  }),
  E('tracking-workout-session-detail', 'GET', '/api/member/tracking/workout-sessions/{sessionId}', {
    feature: F, section: 'Workout history', role: ROLE.MEMBER,
    desc: 'Open the detail of a logged workout session',
    proc: [
      'Run request "GET /api/member/tracking/workout-sessions/{sessionId}" from the Postman collection folder "Tracking > Workout history"',
      'Path variable: sessionId = the id of a session returned by the history endpoint',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout name, the total duration and the per-exercise set results',
      'Each set shows the repetitions and the accuracy recorded by the client',
    ],
    pre: [...PRE_AUTH, '3. A workout session of the member exists'],
    expect: [200],    pathValues: { sessionId: '{{workoutSessionId}}' },
}),
  E('tracking-workout-session-other-member', 'GET', '/api/member/tracking/workout-sessions/{sessionId}', {
    feature: F, section: 'Workout history', role: ROLE.MEMBER,
    desc: 'A member cannot open a workout session owned by another member',
    proc: [
      'Run request "GET /api/member/tracking/workout-sessions/{sessionId}" from the Postman collection folder "Tracking > Workout history"',
      'Path variable: sessionId = a session id belonging to a different member',
    ],
    exp: [
      'HTTP 403 Forbidden (or 404 Not Found) is returned',
      'The response does not disclose the other member\'s workout data',
    ],
    pre: [...PRE_AUTH, '3. A workout session owned by another member exists'],
    expect: [403, 404],    pathValues: { sessionId: '{{otherMemberSessionId}}' },
}),

  // ------------------------------------------- Log workout
  E('tracking-submit-workout-result', 'POST', '/api/member/progression/results', {
    feature: F, section: 'Log workout', role: ROLE.MEMBER,
    desc: 'Log the result of a performed exercise set (the client counts the repetitions)',
    proc: [
      'Run request "POST /api/member/progression/results" from the Postman collection folder "Tracking > Log workout"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: exerciseCode and sets[] with totalReps / cleanReps / totalSeconds',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise result with the accuracy the backend recalculated from the raw counters',
      'The workout session appears in the workout history',
    ],
    pre: [...PRE_AUTH, '3. The exercise code exists and is unlocked for the member'],
    body: {
      exerciseCode: 'PULL_UP',
      sets: [
        { totalReps: 10, cleanReps: 8, totalSeconds: 45 },
        { totalReps: 8, cleanReps: 7, totalSeconds: 38 },
      ],
      source: 'DAILY_PLAN',
    },
    expect: [200],
  }),
  E('tracking-submit-workout-result-empty-sets', 'POST', '/api/member/progression/results', {
    feature: F, section: 'Log workout', role: ROLE.MEMBER,
    desc: 'Submitting a workout result is rejected when the sets array is empty',
    proc: [
      'Run request "POST /api/member/progression/results" from the Postman collection folder "Tracking > Log workout"',
      'Body: exerciseCode = "PULL_UP", sets = []',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that at least one set is required',
      'No workout session is created',
    ],
    pre: [...PRE_AUTH],
    body: { exerciseCode: 'PULL_UP', sets: [] },
    expect: [400],
  }),
  E('tracking-submit-workout-result-unknown-exercise', 'POST', '/api/member/progression/results', {
    feature: F, section: 'Log workout', role: ROLE.MEMBER,
    desc: 'Submitting a workout result is rejected for an unknown exercise code',
    proc: [
      'Run request "POST /api/member/progression/results" from the Postman collection folder "Tracking > Log workout"',
      'Body: exerciseCode = "NO_SUCH_EXERCISE", sets = [{ totalReps: 5, cleanReps: 5, totalSeconds: 20 }]',
    ],
    exp: [
      'HTTP 400 Bad Request (or 404 Not Found) is returned',
      'Response body explains that the exercise does not exist',
      'No workout session is created',
    ],
    pre: [...PRE_AUTH],
    body: {
      exerciseCode: 'NO_SUCH_EXERCISE',
      sets: [{ totalReps: 5, cleanReps: 5, totalSeconds: 20 }],
    },
    expect: [400, 404],
  }),

  // ------------------------------------------- Performance analytics
  E('tracking-analytics', 'GET', '/api/member/tracking/analytics', {
    feature: F, section: 'Performance analytics', role: ROLE.MEMBER,
    desc: 'View the performance analytics: progress charts for strength, consistency and volume',
    proc: [
      'Run request "GET /api/member/tracking/analytics" from the Postman collection folder "Tracking > Performance analytics"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the aggregated series used by the charts (volume, session count, best set per exercise)',
      'The data covers the requested period',
    ],
    pre: [...PRE_AUTH, '3. The member has completed at least one workout'],
    expect: [200],
  }),
  E('tracking-analytics-empty-history', 'GET', '/api/member/tracking/analytics', {
    feature: F, section: 'Performance analytics', role: ROLE.MEMBER,
    desc: 'Analytics of a member without any workout returns empty data instead of an error',
    proc: [
      'Use the token of a freshly registered member that has not trained yet',
      'Run request "GET /api/member/tracking/analytics" from the Postman collection folder "Tracking > Performance analytics"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The response body contains zero-valued counters and empty series',
      'No error is raised',
    ],
    pre: [...PRE_AUTH, '3. The member has no completed workout yet'],
    expect: [200],
  }),
  E('tracking-analytics-unauthenticated', 'GET', '/api/member/tracking/analytics', {
    feature: F, section: 'Performance analytics', role: ROLE.NONE,
    desc: 'Performance analytics rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/member/tracking/analytics" from the Postman collection folder "Tracking > Performance analytics"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No analytics data is returned',
    ],
    pre: [...PRE_AUTH, '3. The Authorization header has been removed'],
    expect: [401],
  }),
];
