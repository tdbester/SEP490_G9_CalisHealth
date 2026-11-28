/**
 * Feature: User Onboarding & Physical Fitness Profiling
 * Covers SurveyController (/api/surveys/**), SurveySessionController
 * (/api/survey-sessions/**), MemberFormCorrectionController
 * (/api/member/form-correction) and the plan preview flow.
 */
const { E, ROLE, PRE_AUTH, PRE_GUEST } = require('./_helpers');

const F = 'User Oboarding & Physical Fitne';

const PRE_SURVEY = [
  '1. CalisHealth server is running and reachable at {{baseUrl}}',
  '2. A MEMBER account exists, is email-verified and has an active session token',
  '3. The onboarding survey "CALISHEALTH_ONBOARDING" is seeded and ACTIVE',
];

module.exports = [
  // ------------------------------------------- Survey - Body information
  E('survey-get-definition', 'GET', '/api/surveys/{surveyCode}', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'Load the onboarding survey definition (steps and questions) before showing the first screen',
    proc: [
      'Run request "GET /api/surveys/{surveyCode}" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Path variable: surveyCode = "CALISHEALTH_ONBOARDING"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the survey code, version and the ordered list of steps',
      'Each step exposes its questions with question code, type and whether it is required',
    ],
    pre: PRE_SURVEY,
    expect: [200],
    tests: ['Response body has a "surveyCode" property'],
  }),
  E('survey-get-definition-invalid-code', 'GET', '/api/surveys/{surveyCode}', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'Loading a survey definition with an unknown survey code fails',
    proc: [
      'Run request "GET /api/surveys/{surveyCode}" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Path variable: surveyCode = "UNKNOWN_SURVEY"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the survey was not found',
    ],
    pre: PRE_SURVEY,
    expect: [404],
  }),
  E('survey-session-start', 'POST', '/api/survey-sessions', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'Start a new onboarding survey session and receive the first step',
    proc: [
      'Run request "POST /api/survey-sessions" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: surveyCode = "CALISHEALTH_ONBOARDING"',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the session id, the survey code and the current step',
      'A new session row is created for the member',
    ],
    pre: PRE_SURVEY,
    body: { surveyCode: 'CALISHEALTH_ONBOARDING' },
    expect: [200, 201],
    tests: ['Response body has a non-empty session id property'],
  }),
  E('survey-session-start-missing-code', 'POST', '/api/survey-sessions', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'Starting a survey session is rejected when surveyCode is missing',
    proc: [
      'Run request "POST /api/survey-sessions" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: {} (surveyCode removed)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that surveyCode is required',
      'No session is created',
    ],
    pre: PRE_SURVEY,
    body: {},
    expect: [400],
  }),
  E('survey-session-get', 'GET', '/api/survey-sessions/{sessionId}', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'Reopen an in-progress survey session and read the current step and saved answers',
    proc: [
      'Run request "GET /api/survey-sessions/{sessionId}" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Path variable: sessionId = the id returned by "POST /api/survey-sessions"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the current step code and the answers already saved',
      'The previously saved answers are preserved',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-list', 'GET', '/api/survey-sessions', {
    feature: F, section: 'Survey - Body information', role: ROLE.MEMBER,
    desc: 'List the survey sessions of the logged-in member',
    proc: [
      'Run request "GET /api/survey-sessions" from the Postman collection folder "User Onboarding > Survey - Body information"',
      'Query param: surveyCode = "CALISHEALTH_ONBOARDING"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of session summaries with session id, status and updated time',
      'Only sessions belonging to the logged-in member are returned',
    ],
    pre: PRE_SURVEY,
    query: { surveyCode: 'CALISHEALTH_ONBOARDING' },
    expect: [200],
  }),

  // ------------------------------------------- Survey - Goals and motivation
  E('survey-save-answers-goals', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Goals and motivation', role: ROLE.MEMBER,
    desc: 'Save the answers of the "Goals and motivation" step',
    proc: [
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" from the Postman collection folder "User Onboarding > Survey - Goals and motivation"',
      'Path variables: sessionId = the active session, stepCode = the goal step code',
      'Body: surveyVersion + answers[] with questionCode and value pairs',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the updated session with the current step',
      'The saved answers are returned when the session is read again',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    body: {
      surveyVersion: 1,
      answers: [
        { questionCode: 'GOAL_PRIMARY', value: 'BUILD_STRENGTH' },
        { questionCode: 'GOAL_TIMELINE', value: '6_MONTHS' },
      ],
    },
    expect: [200],
  }),
  E('survey-save-answers-empty-list', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Goals and motivation', role: ROLE.MEMBER,
    desc: 'Saving answers is rejected when the answers array is empty',
    proc: [
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" from the Postman collection folder "User Onboarding > Survey - Goals and motivation"',
      'Body: surveyVersion = 1, answers = []',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that answers must contain 1 to 100 items',
      'No answers are stored for the step',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    body: { surveyVersion: 1, answers: [] },
    expect: [400],    pathValues: { sessionId: '{{sessionId}}', stepCode: 'GOALS' },
}),
  E('survey-save-answers-unknown-field', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Goals and motivation', role: ROLE.MEMBER,
    desc: 'Saving answers is rejected when the payload carries an unknown field',
    proc: [
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" from the Postman collection folder "User Onboarding > Survey - Goals and motivation"',
      'Body: answers[] item contains an extra field "questionType" next to questionCode and value',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports the UNKNOWN_FIELD error',
      'The backend does not trust the question configuration sent by the client',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    body: {
      surveyVersion: 1,
      answers: [{ questionCode: 'GOAL_PRIMARY', value: 'BUILD_STRENGTH', questionType: 'TEXT' }],
    },
    expect: [400],    pathValues: { sessionId: '{{sessionId}}', stepCode: 'GOALS' },
}),
  E('survey-save-answers-version-conflict', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Goals and motivation', role: ROLE.MEMBER,
    desc: 'Saving answers is rejected when the client sends a stale survey version',
    proc: [
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" from the Postman collection folder "User Onboarding > Survey - Goals and motivation"',
      'Body: surveyVersion = 999 (does not match the session version)',
    ],
    exp: [
      'HTTP 409 Conflict is returned',
      'Response body explains the survey version mismatch',
      'The answers are not overwritten',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    body: {
      surveyVersion: 999,
      answers: [{ questionCode: 'GOAL_PRIMARY', value: 'BUILD_STRENGTH' }],
    },
    expect: [409],    pathValues: { sessionId: '{{sessionId}}', stepCode: 'GOALS' },
}),
  E('survey-save-answers-null-value-clears', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Goals and motivation', role: ROLE.MEMBER,
    desc: 'Sending a null value deletes a previously saved answer',
    proc: [
      'Save an answer for question GOAL_PRIMARY first',
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" again',
      'Body: answers[] item with "value": null for the same questionCode',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The answer for GOAL_PRIMARY is removed from the session',
      'Other answers of the step are untouched',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists and already holds an answer for GOAL_PRIMARY'],
    body: {
      surveyVersion: 1,
      answers: [{ questionCode: 'GOAL_PRIMARY', value: null }],
    },
    expect: [200],    pathValues: { sessionId: '{{sessionId}}', stepCode: 'GOALS' },
}),

  // ------------------------------------------- Survey - Current training routine
  E('survey-save-answers-routine', 'PUT', '/api/survey-sessions/{sessionId}/steps/{stepCode}/answers', {
    feature: F, section: 'Survey - Current training routine', role: ROLE.MEMBER,
    desc: 'Save the answers of the "Current training routine" step (training days, level and equipment)',
    proc: [
      'Run request "PUT /api/survey-sessions/{sessionId}/steps/{stepCode}/answers" from the Postman collection folder "User Onboarding > Survey - Current training routine"',
      'Body: answers[] with the routine question codes and their values',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body returns the session with the routine answers stored',
      'The routine answers are synchronised to the member profile after completion',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists for the member'],
    body: {
      surveyVersion: 1,
      answers: [
        { questionCode: 'TRAINING_DAYS_PER_WEEK', value: 3 },
        { questionCode: 'CURRENT_LEVEL', value: 'BEGINNER' },
        { questionCode: 'EQUIPMENT', value: 'BODYWEIGHT' },
      ],
    },
    expect: [200],    pathValues: { sessionId: '{{sessionId}}', stepCode: 'CURRENT_ROUTINE' },
}),
  E('survey-session-skip', 'POST', '/api/survey-sessions/{sessionId}/skip', {
    feature: F, section: 'Survey - Current training routine', role: ROLE.MEMBER,
    desc: 'Skip the current optional step of the onboarding survey',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/skip" from the Postman collection folder "User Onboarding > Survey - Current training routine"',
      'Path variable: sessionId = the active session',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the session moved to the next step',
      'The skipped step is recorded as skipped and does not block completion',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session exists and the current step is optional'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-skip-required-step', 'POST', '/api/survey-sessions/{sessionId}/skip', {
    feature: F, section: 'Survey - Current training routine', role: ROLE.MEMBER,
    desc: 'A required step cannot be skipped',
    proc: [
      'Advance the session to a required step',
      'Run request "POST /api/survey-sessions/{sessionId}/skip" from the Postman collection folder "User Onboarding > Survey - Current training routine"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that the required step must be answered',
      'The session stays on the same step',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress session whose current step is required'],
    expect: [400],    pathValues: { sessionId: '{{sessionId}}' },
}),

  // ------------------------------------------- Survey - Level test
  E('survey-session-resume', 'POST', '/api/survey-sessions/{sessionId}/resume', {
    feature: F, section: 'Survey - Level test', role: ROLE.MEMBER,
    desc: 'Resume a paused survey session from the step where it was left',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/resume" from the Postman collection folder "User Onboarding > Survey - Level test"',
      'Path variable: sessionId = the paused session',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the session with the step the member left off at',
      'The previously saved answers are still present',
    ],
    pre: [...PRE_SURVEY, '4. A paused survey session exists for the member'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-reopen', 'POST', '/api/survey-sessions/{sessionId}/reopen', {
    feature: F, section: 'Survey - Level test', role: ROLE.MEMBER,
    desc: 'Reopen a completed survey session so the member can correct the answers',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/reopen" from the Postman collection folder "User Onboarding > Survey - Level test"',
      'Path variable: sessionId = the completed session',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the session status changed back to in-progress',
      'The member can navigate to the step that needs correction',
    ],
    pre: [...PRE_SURVEY, '4. A completed survey session exists for the member'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-reopen-in-progress', 'POST', '/api/survey-sessions/{sessionId}/reopen', {
    feature: F, section: 'Survey - Level test', role: ROLE.MEMBER,
    desc: 'Reopening a session that is still in progress is rejected',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/reopen" from the Postman collection folder "User Onboarding > Survey - Level test"',
      'Path variable: sessionId = a session that is still in progress',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that only a completed session can be reopened',
      'The session status is unchanged',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress survey session exists for the member'],
    expect: [400],    pathValues: { sessionId: '{{sessionId}}' },
}),

  // ------------------------------------------- Survey - Result and recommended plan
  E('survey-session-complete', 'POST', '/api/survey-sessions/{sessionId}/complete', {
    feature: F, section: 'Survey - Result and recommended plan', role: ROLE.MEMBER,
    desc: 'Complete the onboarding survey once all required steps are answered',
    proc: [
      'Answer every required step of the active session',
      'Run request "POST /api/survey-sessions/{sessionId}/complete" from the Postman collection folder "User Onboarding > Survey - Result and recommended plan"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the session status as completed',
      'The member fitness level is derived from the level test answers',
    ],
    pre: [...PRE_SURVEY, '4. All required steps of the session have been answered'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-complete-missing-required', 'POST', '/api/survey-sessions/{sessionId}/complete', {
    feature: F, section: 'Survey - Result and recommended plan', role: ROLE.MEMBER,
    desc: 'Completing the survey is rejected while a required step is still unanswered',
    proc: [
      'Start a session and answer only the first step',
      'Run request "POST /api/survey-sessions/{sessionId}/complete" from the Postman collection folder "User Onboarding > Survey - Result and recommended plan"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body names the steps that still have to be answered',
      'The session remains in progress',
    ],
    pre: [...PRE_SURVEY, '4. A session exists with at least one unanswered required step'],
    expect: [400],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-result', 'GET', '/api/survey-sessions/{sessionId}/result', {
    feature: F, section: 'Survey - Result and recommended plan', role: ROLE.MEMBER,
    desc: 'Read the survey result: assessed level and the recommended training plan',
    proc: [
      'Run request "GET /api/survey-sessions/{sessionId}/result" from the Postman collection folder "User Onboarding > Survey - Result and recommended plan"',
      'Path variable: sessionId = the completed session',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the benchmark scores and the recommended fitness level',
      'Response body contains the recommended daily plan template code',
    ],
    pre: [...PRE_SURVEY, '4. A completed survey session exists for the member'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-result-not-completed', 'GET', '/api/survey-sessions/{sessionId}/result', {
    feature: F, section: 'Survey - Result and recommended plan', role: ROLE.MEMBER,
    desc: 'The result endpoint rejects a session that has not been completed',
    proc: [
      'Run request "GET /api/survey-sessions/{sessionId}/result" from the Postman collection folder "User Onboarding > Survey - Result and recommended plan"',
      'Path variable: sessionId = an in-progress session',
    ],
    exp: [
      'HTTP 400 Bad Request (or 409 Conflict) is returned',
      'Response body explains that the survey has not been completed yet',
      'No result payload is returned',
    ],
    pre: [...PRE_SURVEY, '4. An in-progress survey session exists for the member'],
    expect: [400, 409],    pathValues: { sessionId: '{{sessionId}}' },
}),

  // ------------------------------------------- Preview training plan
  E('survey-session-start-plan', 'POST', '/api/survey-sessions/{sessionId}/start-plan', {
    feature: F, section: 'Preview training plan', role: ROLE.MEMBER,
    desc: 'Start the recommended training plan derived from the onboarding result',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/start-plan" from the Postman collection folder "User Onboarding > Preview training plan"',
      'Path variable: sessionId = the completed session',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the plan template code and the weekly training days that were created',
      'The member schedule is populated from the recommended template',
    ],
    pre: [...PRE_SURVEY, '4. A completed survey session with a recommended plan exists'],
    expect: [200],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-start-plan-already-started', 'POST', '/api/survey-sessions/{sessionId}/start-plan', {
    feature: F, section: 'Preview training plan', role: ROLE.MEMBER,
    desc: 'Starting the plan twice for the same session is rejected',
    proc: [
      'Run request "POST /api/survey-sessions/{sessionId}/start-plan" once so the plan is created',
      'Run the same request again with the same sessionId',
    ],
    exp: [
      'HTTP 400 Bad Request (or 409 Conflict) is returned',
      'Response body explains the plan has already been started for this session',
      'No duplicated schedule entries are created',
    ],
    pre: [...PRE_SURVEY, '4. A completed session whose plan has already been started'],
    expect: [400, 409],    pathValues: { sessionId: '{{sessionId}}' },
}),
  E('survey-session-other-member', 'GET', '/api/survey-sessions/{sessionId}', {
    feature: F, section: 'Preview training plan', role: ROLE.MEMBER,
    desc: 'A member cannot read a survey session that belongs to another member',
    proc: [
      'Run request "GET /api/survey-sessions/{sessionId}" from the Postman collection folder "User Onboarding > Preview training plan"',
      'Path variable: sessionId = a session id owned by a different member',
    ],
    exp: [
      'HTTP 403 Forbidden (or 404 Not Found) is returned',
      'Response body does not disclose the answers of the other member',
    ],
    pre: [...PRE_AUTH, '3. A survey session owned by another member exists'],
    expect: [403, 404],    pathValues: { sessionId: '{{otherMemberSessionId}}' },
}),
  E('survey-session-unauthenticated', 'GET', '/api/survey-sessions', {
    feature: F, section: 'Preview training plan', role: ROLE.NONE,
    desc: 'Survey session endpoints reject unauthenticated requests',
    proc: [
      'Run request "GET /api/survey-sessions" from the Postman collection folder "User Onboarding > Preview training plan"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No session data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),
];
