/**
 * Feature: Main Dashboard & Routine Management
 * Covers DashboardController (/api/dashboard), LeaderboardController
 * (/api/leaderboard/**), MemberScheduleController (/api/member/schedule/**),
 * DayStreakController (/api/member/day-streak, /api/member/day-report),
 * MemberNotificationController (/api/notifications/**) and the member feedback
 * endpoints.
 */
const { E, ROLE, PRE_AUTH, PRE_GUEST } = require('./_helpers');

const F = 'Main Dashboard & Routine Manage';

module.exports = [
  // ------------------------------------------- Main dashboard
  E('dashboard-get', 'GET', '/api/dashboard', {
    feature: F, section: 'Main dashboard', role: ROLE.NONE,
    desc: 'Load the main dashboard summary shown after login',
    proc: [
      'Run request "GET /api/dashboard" from the Postman collection folder "Main Dashboard > Main dashboard"',
      'Send it without an Authorization header (the endpoint is public)',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the daily summary: current streak, the workout of the day and the progress counters',
      'The response is JSON, not an HTML login page',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('dashboard-get-invalid-method', 'GET', '/api/dashboard', {
    feature: F, section: 'Main dashboard', role: ROLE.NONE,
    desc: 'Dashboard returns a JSON error payload instead of an HTML error page',
    proc: [
      'Run request "GET /api/dashboard" from the Postman collection folder "Main Dashboard > Main dashboard"',
      'Inspect the "Content-Type" response header',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Content-Type header is "application/json"',
      'The body can be parsed as JSON without an HTML error page',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
    tests: ['Response "Content-Type" header contains "application/json"'],
  }),

  // ------------------------------------------- Leaderboard
  E('leaderboard-current-week', 'GET', '/api/leaderboard/week/current', {
    feature: F, section: 'Leaderboard', role: ROLE.MEMBER,
    desc: 'View the leaderboard of the current week',
    proc: [
      'Run request "GET /api/leaderboard/week/current" from the Postman collection folder "Main Dashboard > Leaderboard"',
      'Query param: levelId = 1 (optional filter by fitness level)',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the ranked members with their weekly score',
      'The list is ordered by score descending',
    ],
    pre: [...PRE_AUTH],
    query: { levelId: '1' },
    expect: [200],
  }),
  E('leaderboard-week-history', 'GET', '/api/leaderboard/week/history', {
    feature: F, section: 'Leaderboard', role: ROLE.MEMBER,
    desc: 'View the weekly leaderboard history of a member',
    proc: [
      'Run request "GET /api/leaderboard/week/history" from the Postman collection folder "Main Dashboard > Leaderboard"',
      'Query param: memberId = the id of the member whose history is requested',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the per-week score entries ordered by week',
    ],
    pre: [...PRE_AUTH, '3. The member has leaderboard entries from previous weeks'],
    query: { memberId: '{{memberId}}' },
    expect: [200],
  }),
  E('leaderboard-score-breakdown', 'GET', '/api/leaderboard/week/breakdown', {
    feature: F, section: 'Leaderboard', role: ROLE.MEMBER,
    desc: 'See how the weekly score of a member is broken down',
    proc: [
      'Run request "GET /api/leaderboard/week/breakdown" from the Postman collection folder "Main Dashboard > Leaderboard"',
      'Query param: memberId = the id of the member',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists each scoring component (completed workouts, accuracy, consistency) and its contribution',
      'The components add up to the total weekly score',
    ],
    pre: [...PRE_AUTH, '3. The member has scored at least one workout in the current week'],
    query: { memberId: '{{memberId}}' },
    expect: [200],
  }),
  E('leaderboard-admin-compute', 'POST', '/api/leaderboard/admin/compute', {
    feature: F, section: 'Leaderboard', role: ROLE.ADMIN,
    desc: 'Trigger the weekly leaderboard score computation',
    proc: [
      'Run request "POST /api/leaderboard/admin/compute" from the Postman collection folder "Main Dashboard > Leaderboard"',
      'Header: Authorization = "Bearer {{adminToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the result message of the computation',
      'The weekly scores of the members are (re)calculated',
    ],
    pre: [
      '1. CalisHealth server is running and reachable at {{baseUrl}}',
      '2. An ADMIN account exists and has an active session token',
    ],
    expect: [200],
  }),
  E('leaderboard-current-week-forbidden', 'GET', '/api/leaderboard/week/current', {
    feature: F, section: 'Leaderboard', role: ROLE.NONE,
    desc: 'Leaderboard endpoints reject unauthenticated requests',
    proc: [
      'Run request "GET /api/leaderboard/week/current" from the Postman collection folder "Main Dashboard > Leaderboard"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No ranking data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ------------------------------------------- Workout schedule
  E('schedule-get-by-month', 'GET', '/api/member/schedule', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'View the monthly workout schedule calendar of the member',
    proc: [
      'Run request "GET /api/member/schedule" from the Postman collection folder "Main Dashboard > Workout schedule"',
      'Query param: month = the first day of the month, format "YYYY-MM-DD"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the schedule entries with their date, workout code and workout name',
      'The entries fall inside the requested month',
    ],
    pre: [...PRE_AUTH],
    query: { month: '2026-11-01' },
    expect: [200],
  }),
  E('schedule-save', 'POST', '/api/member/schedule', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'Save the workouts planned for the member in a month',
    proc: [
      'Run request "POST /api/member/schedule" from the Postman collection folder "Main Dashboard > Workout schedule"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: month, templateCode and entries[] with date and workoutCode',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the saved monthly schedule',
      'Re-reading "GET /api/member/schedule" returns the same entries',
    ],
    pre: [...PRE_AUTH, '3. The referenced workout code exists in the library'],
    body: {
      month: '2026-11-01',
      templateCode: 'BEGINNER_3DAY',
      entries: [
        { date: '2026-11-02', workoutCode: 'PUSH_UPPER' },
        { date: '2026-11-03', workoutCode: 'PULL_BASIC' },
        { date: '2026-11-04', workoutCode: 'LEG_BASIC' },
      ],
    },
    expect: [200],
  }),
  E('schedule-save-invalid-workout-code', 'POST', '/api/member/schedule', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'Saving the schedule is rejected when an entry references an unknown workout',
    proc: [
      'Run request "POST /api/member/schedule" from the Postman collection folder "Main Dashboard > Workout schedule"',
      'Body: entries[] contains workoutCode = "NO_SUCH_WORKOUT"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that the workout code does not exist',
      'No schedule entry is saved',
    ],
    pre: [...PRE_AUTH],
    body: {
      month: '2026-11-01',
      entries: [{ date: '2026-11-02', workoutCode: 'NO_SUCH_WORKOUT' }],
    },
    expect: [400],
  }),
  E('schedule-get-all', 'GET', '/api/member/schedule/all', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'List every schedule entry of the member across all months',
    proc: [
      'Run request "GET /api/member/schedule/all" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of schedule entries ordered by date',
      'Only the logged-in member\'s entries are returned',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-current', 'GET', '/api/member/schedule/current', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'View the currently active training plan of the member',
    proc: [
      'Run request "GET /api/member/schedule/current" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the active template code and the current week entries',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-today', 'GET', '/api/member/schedule/today', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'View the workout scheduled for today',
    proc: [
      'Run request "GET /api/member/schedule/today" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout of the current day with its exercise list, or an empty list when nothing is scheduled',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-plan-info', 'GET', '/api/member/schedule/plan-info', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'View the meta information of the active plan (days per week, level, template name)',
    proc: [
      'Run request "GET /api/member/schedule/plan-info" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the plan name, the number of training days per week and the target level',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-week-rule', 'GET', '/api/member/schedule/week-rule', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'View the rule that decides which workout falls on which day of the week',
    proc: [
      'Run request "GET /api/member/schedule/week-rule" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the weekly pattern (day of week mapped to workout code)',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-save-week', 'POST', '/api/member/schedule/week', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'Save the workout plan of the current week',
    proc: [
      'Run request "POST /api/member/schedule/week" from the Postman collection folder "Main Dashboard > Workout schedule"',
      'Body: templateCode and entries[] with date and workoutCode',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the saved week plan',
      'The week plan is reflected by "GET /api/member/schedule/today"',
    ],
    pre: [...PRE_AUTH],
    body: {
      templateCode: 'BEGINNER_3DAY',
      entries: [
        { date: '2026-11-02', workoutCode: 'PUSH_UPPER' },
        { date: '2026-11-04', workoutCode: 'LEG_BASIC' },
      ],
    },
    expect: [200],
  }),
  E('schedule-available-workouts', 'GET', '/api/member/schedule/workouts', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'List the workouts that can be scheduled',
    proc: [
      'Run request "GET /api/member/schedule/workouts" from the Postman collection folder "Main Dashboard > Workout schedule"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of available workouts with code, name and level',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('schedule-update-status', 'PATCH', '/api/member/schedule/status', {
    feature: F, section: 'Workout schedule', role: ROLE.MEMBER,
    desc: 'Update the status of a scheduled workout (for example mark it as skipped)',
    proc: [
      'Run request "PATCH /api/member/schedule/status" from the Postman collection folder "Main Dashboard > Workout schedule"',
      'Body: the id of the schedule entry and the new status',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the updated schedule entry with the new status',
      'The status change is persisted',
    ],
    pre: [...PRE_AUTH, '3. A schedule entry exists for the member'],
    body: { id: '{{scheduleEntryId}}', status: 'SKIPPED' },
    expect: [200],
  }),

  // ------------------------------------------- Preview workout plan
  E('schedule-preview-plan', 'GET', '/api/member/schedule/plan-info', {
    feature: F, section: 'Preview workout plan', role: ROLE.MEMBER,
    desc: 'Preview the detail of the recommended workout plan before starting it',
    proc: [
      'Run request "GET /api/member/schedule/plan-info" from the Postman collection folder "Main Dashboard > Preview workout plan"',
      'Then read "GET /api/member/schedule/week-rule" to see the day-by-day pattern',
    ],
    exp: [
      'HTTP 200 OK is returned for both requests',
      'The plan info contains the template code and the number of training days',
      'The week rule lists the workout scheduled for each weekday',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),

  // ------------------------------------------- Today's workout
  E('today-workout-list', 'GET', '/api/member/schedule/today', {
    feature: F, section: "Today's workout", role: ROLE.MEMBER,
    desc: 'List the exercises of the workout scheduled for today',
    proc: [
      'Run request "GET /api/member/schedule/today" from the Postman collection folder "Main Dashboard > Today\'s workout"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Each returned item contains the exercise code, name, target muscle and the set/rep or duration configuration',
      'The exercise order matches the configured workout order',
    ],
    pre: [...PRE_AUTH, '3. A workout is scheduled for today'],
    expect: [200],
  }),
  E('today-workout-empty-day', 'GET', '/api/member/schedule/today', {
    feature: F, section: "Today's workout", role: ROLE.MEMBER,
    desc: 'A rest day returns an empty list instead of an error',
    proc: [
      'Run request "GET /api/member/schedule/today" from the Postman collection folder "Main Dashboard > Today\'s workout"',
      'Choose a member whose plan has no workout scheduled for the current date',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The response body is an empty array',
      'No error is raised for the rest day',
    ],
    pre: [...PRE_AUTH, '3. No workout is scheduled for the member on the current date'],
    expect: [200],
  }),

  // ------------------------------------------- Exercise detail & preview
  E('exercise-detail-system', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'Exercise detail & preview', role: ROLE.MEMBER,
    desc: 'Open the detail page of a system exercise from the today\'s workout screen',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Main Dashboard > Exercise detail & preview"',
      'Path variable: id = the numeric id of a system exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise name, description, target muscle, level and guide steps',
      'Response body contains the demo video URL and the anatomy image URL',
    ],
    pre: [...PRE_AUTH, '3. A system exercise exists'],
    expect: [200],    pathValues: { id: '{{systemExerciseId}}' },
}),
  E('exercise-detail-not-found', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'Exercise detail & preview', role: ROLE.MEMBER,
    desc: 'Opening a non-existent exercise returns a not-found error',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Main Dashboard > Exercise detail & preview"',
      'Path variable: id = 999999',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the exercise was not found',
    ],
    pre: [...PRE_AUTH],
    expect: [404],    pathValues: { id: '999999' },
}),

  // ------------------------------------------- Day streak
  E('day-streak-get', 'GET', '/api/member/day-streak', {
    feature: F, section: 'Day streak', role: ROLE.MEMBER,
    desc: 'View the current training day streak of the member',
    proc: [
      'Run request "GET /api/member/day-streak" from the Postman collection folder "Main Dashboard > Day streak"',
      'Query params: year and month (optional, defaults to the current month)',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the current streak length and the list of active days',
    ],
    pre: [...PRE_AUTH],
    query: { year: '2026', month: '11' },
    expect: [200],
  }),
  E('day-streak-invalid-month', 'GET', '/api/member/day-streak', {
    feature: F, section: 'Day streak', role: ROLE.MEMBER,
    desc: 'Day streak rejects an out-of-range month parameter',
    proc: [
      'Run request "GET /api/member/day-streak" from the Postman collection folder "Main Dashboard > Day streak"',
      'Query params: year = 2026, month = 13',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the month parameter is invalid',
    ],
    pre: [...PRE_AUTH],
    query: { year: '2026', month: '13' },
    expect: [400],
  }),

  // ------------------------------------------- Day report
  E('day-report-get', 'GET', '/api/member/day-report', {
    feature: F, section: 'Day report', role: ROLE.MEMBER,
    desc: 'View the daily training report of the member',
    proc: [
      'Run request "GET /api/member/day-report" from the Postman collection folder "Main Dashboard > Day report"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body summarises the workouts completed, the sets performed and the time trained of the day',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('day-report-unauthenticated', 'GET', '/api/member/day-report', {
    feature: F, section: 'Day report', role: ROLE.NONE,
    desc: 'Day report rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/member/day-report" from the Postman collection folder "Main Dashboard > Day report"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No report data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ------------------------------------------- Feedback
  E('member-feedback-list', 'GET', '/api/v1/library/feedback', {
    feature: F, section: 'Feedback', role: ROLE.MEMBER,
    desc: 'List the feedback submitted by the logged-in member',
    proc: [
      'Run request "GET /api/v1/library/feedback" from the Postman collection folder "Main Dashboard > Feedback"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of feedback entries with title, category and status',
      'Only feedback of the logged-in member is returned',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('member-feedback-create', 'POST', '/api/v1/library/feedback', {
    feature: F, section: 'Feedback', role: ROLE.MEMBER,
    desc: 'Submit new feedback or a complaint about the exercise and workout content',
    proc: [
      'Run request "POST /api/v1/library/feedback" from the Postman collection folder "Main Dashboard > Feedback"',
      'Body: title, content and category as shown in the request',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created feedback with its id and status "PENDING"',
      'The feedback appears in the member feedback list',
    ],
    pre: [...PRE_AUTH],
    body: {
      title: 'Wrong description on the pull-up exercise',
      content: 'The demo video does not match the described grip position. Please review it.',
      category: 'EXERCISE_CONTENT',
    },
    expect: [200, 201],
  }),
  E('member-feedback-create-invalid-category', 'POST', '/api/v1/library/feedback', {
    feature: F, section: 'Feedback', role: ROLE.MEMBER,
    desc: 'Feedback submission is rejected when the category is not an allowed value',
    proc: [
      'Run request "POST /api/v1/library/feedback" from the Postman collection folder "Main Dashboard > Feedback"',
      'Body: category = "UNKNOWN_CATEGORY"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body lists the allowed categories',
      'No feedback is created',
    ],
    pre: [...PRE_AUTH],
    body: {
      title: 'Invalid category feedback',
      content: 'This feedback uses a category that does not exist.',
      category: 'UNKNOWN_CATEGORY',
    },
    expect: [400],
  }),

  // ------------------------------------------- Member notifications
  E('member-notification-list', 'GET', '/api/notifications', {
    feature: F, section: 'Feedback', role: ROLE.MEMBER,
    desc: 'List the notifications addressed to the logged-in member',
    proc: [
      'Run request "GET /api/notifications" from the Postman collection folder "Main Dashboard > Feedback"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the notification list and the unread counter',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('member-notification-mark-read', 'POST', '/api/notifications/{id}/read', {
    feature: F, section: 'Feedback', role: ROLE.MEMBER,
    desc: 'Mark a member notification as read',
    proc: [
      'Run request "POST /api/notifications/{id}/read" from the Postman collection folder "Main Dashboard > Feedback"',
      'Path variable: id = the id of an unread notification',
    ],
    exp: [
      'HTTP 200 OK (or 204 No Content) is returned',
      'The notification no longer counts as unread in "GET /api/notifications"',
    ],
    pre: [...PRE_AUTH, '3. An unread notification exists for the member'],
    expect: [200, 204],    pathValues: { id: '{{notificationId}}' },
}),
];
