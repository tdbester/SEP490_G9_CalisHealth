/**
 * Feature: Content Management System
 * Covers the /api/content/** family managed by CONTENT_MANAGER and ADMIN:
 * exercises, workouts, daily plan templates, progression rules, level
 * benchmarks, feedback handling and the content dashboard.
 */
const { E, ROLE, PRE_AUTH, PRE_CONTENT, PRE_GUEST } = require('./_helpers');

const F = 'Content Management System';

module.exports = [
  // ------------------------------------------- Content manager dashboard
  E('content-dashboard-member-levels', 'GET', '/api/content/dashboard/member-levels', {
    feature: F, section: 'Content manager dashboard', role: ROLE.CONTENT,
    desc: 'Open the content manager dashboard with the member level distribution',
    proc: [
      'Run request "GET /api/content/dashboard/member-levels" from the Postman collection folder "Content > Content manager dashboard"',
      'Header: Authorization = "Bearer {{contentToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of members per fitness level',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-dashboard-member-forbidden', 'GET', '/api/content/dashboard/member-levels', {
    feature: F, section: 'Content manager dashboard', role: ROLE.MEMBER,
    desc: 'A regular member cannot open the content manager dashboard',
    proc: [
      'Run request "GET /api/content/dashboard/member-levels" from the Postman collection folder "Content > Content manager dashboard"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'No level distribution is disclosed',
    ],
    pre: [...PRE_AUTH],
    expect: [403],
  }),

  // ------------------------------------------- Feedbacks & complaints management
  E('content-feedback-list', 'GET', '/api/content/feedback', {
    feature: F, section: 'Feedbacks & complaints management', role: ROLE.CONTENT,
    desc: 'List the feedback about the exercise and workout content',
    proc: [
      'Run request "GET /api/content/feedback" from the Postman collection folder "Content > Feedbacks & complaints management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the feedback list with title, category and status',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Feedback & complaint details
  E('content-feedback-detail', 'GET', '/api/content/feedback/{id}', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.CONTENT,
    desc: 'Open the detail of a content feedback',
    proc: [
      'Run request "GET /api/content/feedback/{id}" from the Postman collection folder "Content > Feedback & complaint details"',
      'Path variable: id = the id of the feedback',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the title, content, category and the member who submitted it',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-feedback-take', 'PATCH', '/api/content/feedback/{id}/take', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.CONTENT,
    desc: 'Take a feedback into processing so that it is assigned to the current content manager',
    proc: [
      'Run request "PATCH /api/content/feedback/{id}/take" from the Postman collection folder "Content > Feedback & complaint details"',
      'Path variable: id = the id of an unassigned feedback',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the feedback assigned to the current content manager',
      'The feedback no longer appears in the unassigned queue',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-feedback-handle', 'PATCH', '/api/content/feedback/{id}/handle', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.CONTENT,
    desc: 'Handle a content feedback by resolving or rejecting it',
    proc: [
      'Run request "PATCH /api/content/feedback/{id}/handle" from the Postman collection folder "Content > Feedback & complaint details"',
      'Body: action and resolutionNote',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the updated status of the feedback',
      'The resolution note is stored and shown in the detail view',
    ],
    pre: PRE_CONTENT,
    body: {
      action: 'RESOLVE',
      resolutionNote: 'The guide steps have been corrected.',
    },
    expect: [200],    pathValues: { id: '{{feedbackId}}' },
}),
  E('content-feedback-handle-invalid-action', 'PATCH', '/api/content/feedback/{id}/handle', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.CONTENT,
    desc: 'Handling a content feedback is rejected when the action is not allowed',
    proc: [
      'Run request "PATCH /api/content/feedback/{id}/handle" from the Postman collection folder "Content > Feedback & complaint details"',
      'Body: action = "IGNORE"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body lists the allowed actions',
      'The feedback status is unchanged',
    ],
    pre: PRE_CONTENT,
    body: {
      action: 'IGNORE',
      resolutionNote: 'Trying to use an unsupported action.',
    },
    expect: [400],    pathValues: { id: '{{feedbackId}}' },
}),

  // ------------------------------------------- Daily training plan templates
  E('daily-plan-templates-list', 'GET', '/api/content/daily-plan-templates', {
    feature: F, section: 'Daily training plan templates', role: ROLE.CONTENT,
    desc: 'List the daily training plan templates',
    proc: [
      'Run request "GET /api/content/daily-plan-templates" from the Postman collection folder "Content > Daily training plan templates"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of templates with the code, name, level and days per week',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Daily training plan template builder
  E('daily-plan-templates-create', 'POST', '/api/content/daily-plan-templates', {
    feature: F, section: 'Daily training plan template builder', role: ROLE.CONTENT,
    desc: 'Create a daily training plan template with its day by day structure',
    proc: [
      'Run request "POST /api/content/daily-plan-templates" from the Postman collection folder "Content > Daily training plan template builder"',
      'Body: name, description, level, daysPerWeek, active and days[]',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created template with its code and the configured days',
      'The template appears in the template list',
    ],
    pre: PRE_CONTENT,
    body: {
      name: 'Beginner 3 day plan',
      description: 'A three day full body routine for beginners.',
      level: 'BEGINNER',
      daysPerWeek: 3,
      active: true,
      days: [
        { dayIndex: 1, workoutCode: 'PUSH_UPPER' },
        { dayIndex: 2, workoutCode: 'PULL_BASIC' },
        { dayIndex: 3, workoutCode: 'LEG_BASIC' },
      ],
    },
    expect: [200, 201],
  }),
  E('daily-plan-templates-create-invalid-level', 'POST', '/api/content/daily-plan-templates', {
    feature: F, section: 'Daily training plan template builder', role: ROLE.CONTENT,
    desc: 'Creating a plan template is rejected when the level is not configured',
    proc: [
      'Run request "POST /api/content/daily-plan-templates" from the Postman collection folder "Content > Daily training plan template builder"',
      'Body: level = "NO_SUCH_LEVEL"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the level is not valid',
      'No template is created',
    ],
    pre: PRE_CONTENT,
    body: {
      name: 'Invalid level plan',
      description: 'A plan that refers to a level which does not exist.',
      level: 'NO_SUCH_LEVEL',
      daysPerWeek: 3,
      active: true,
      days: [],
    },
    expect: [400],
  }),

  // ------------------------------------------- Plan Preview
  E('daily-plan-templates-preview', 'GET', '/api/content/daily-plan-templates/{code}', {
    feature: F, section: 'Plan Preview', role: ROLE.CONTENT,
    desc: 'Preview the structure of a daily training plan template',
    proc: [
      'Run request "GET /api/content/daily-plan-templates/{code}" from the Postman collection folder "Content > Plan Preview"',
      'Path variable: code = the code of the template',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the template name, level and the ordered list of days with their workouts',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Daily training plan template details
  E('daily-plan-templates-detail', 'GET', '/api/content/daily-plan-templates/{code}', {
    feature: F, section: 'Daily training plan template details', role: ROLE.CONTENT,
    desc: 'Open the detail of a daily training plan template',
    proc: [
      'Run request "GET /api/content/daily-plan-templates/{code}" from the Postman collection folder "Content > Daily training plan template details"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the code, name, description, level, days per week and the active flag',
    ],
    pre: PRE_CONTENT,
    expect: [200],    pathValues: { code: '{{templateCode}}' },
}),
  E('daily-plan-templates-detail-not-found', 'GET', '/api/content/daily-plan-templates/{code}', {
    feature: F, section: 'Daily training plan template details', role: ROLE.CONTENT,
    desc: 'Opening an unknown plan template returns a not-found error',
    proc: [
      'Run request "GET /api/content/daily-plan-templates/{code}" from the Postman collection folder "Content > Daily training plan template details"',
      'Path variable: code = "NO_SUCH_TEMPLATE"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the template was not found',
    ],
    pre: PRE_CONTENT,
    expect: [404],
  }),

  // ------------------------------------------- Update daily training plan template
  E('daily-plan-templates-update', 'PUT', '/api/content/daily-plan-templates/{code}', {
    feature: F, section: 'Update daily training plan template', role: ROLE.CONTENT,
    desc: 'Update a daily training plan template',
    proc: [
      'Run request "PUT /api/content/daily-plan-templates/{code}" from the Postman collection folder "Content > Update daily training plan template"',
      'Path variable: code = the code of the template',
      'Body: name, description, level, daysPerWeek, active and days[]',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated template values',
      'The change is visible in the template list',
    ],
    pre: PRE_CONTENT,
    body: {
      name: 'Beginner 3 day plan (updated)',
      description: 'A three day full body routine for beginners.',
      level: 'BEGINNER',
      daysPerWeek: 3,
      active: true,
      days: [
        { dayIndex: 1, workoutCode: 'PUSH_UPPER' },
        { dayIndex: 2, workoutCode: 'PULL_BASIC' },
        { dayIndex: 3, workoutCode: 'LEG_BASIC' },
      ],
    },
    expect: [200],
  }),
  E('daily-plan-templates-update-status', 'PATCH', '/api/content/daily-plan-templates/{code}/status', {
    feature: F, section: 'Update daily training plan template', role: ROLE.CONTENT,
    desc: 'Activate or deactivate a daily training plan template',
    proc: [
      'Run request "PATCH /api/content/daily-plan-templates/{code}/status" from the Postman collection folder "Content > Update daily training plan template"',
      'Body: active',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new active state of the template',
      'An inactive template is not offered to the members',
    ],
    pre: PRE_CONTENT,
    body: { active: false },
    expect: [200],    pathValues: { code: '{{templateCode}}' },
}),
  E('daily-plan-templates-delete', 'DELETE', '/api/content/daily-plan-templates/{code}', {
    feature: F, section: 'Update daily training plan template', role: ROLE.CONTENT,
    desc: 'Delete a daily training plan template',
    proc: [
      'Run request "DELETE /api/content/daily-plan-templates/{code}" from the Postman collection folder "Content > Update daily training plan template"',
      'Path variable: code = the code of the template',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The template no longer appears in the template list',
    ],
    pre: PRE_CONTENT,
    expect: [200, 204],
  }),

  // ------------------------------------------- Workout Detail
  E('content-workouts-list', 'GET', '/api/content/workouts', {
    feature: F, section: 'Workout Detail', role: ROLE.CONTENT,
    desc: 'List the workouts managed by the content team',
    proc: [
      'Run request "GET /api/content/workouts" from the Postman collection folder "Content > Workout Detail"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of workouts with code, name, type, level and status',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-workout-detail', 'GET', '/api/content/workouts/{code}', {
    feature: F, section: 'Workout Detail', role: ROLE.CONTENT,
    desc: 'Open the detail of a workout in the content management area',
    proc: [
      'Run request "GET /api/content/workouts/{code}" from the Postman collection folder "Content > Workout Detail"',
      'Path variable: code = the code of the workout',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout name, description, type, level and the exercise items',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-workout-detail-not-found', 'GET', '/api/content/workouts/{code}', {
    feature: F, section: 'Workout Detail', role: ROLE.CONTENT,
    desc: 'Opening an unknown workout returns a not-found error',
    proc: [
      'Run request "GET /api/content/workouts/{code}" from the Postman collection folder "Content > Workout Detail"',
      'Path variable: code = "NO_SUCH_WORKOUT"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the workout was not found',
    ],
    pre: PRE_CONTENT,
    expect: [404],
  }),

  // ------------------------------------------- Exercise & workout management
  E('content-exercises-list', 'GET', '/api/content/exercises', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'List the system exercises managed by the content team',
    proc: [
      'Run request "GET /api/content/exercises" from the Postman collection folder "Content > Exercise & workout management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of exercises with code, name, muscle group, level and status',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-exercise-detail', 'GET', '/api/content/exercises/{code}', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Open the detail of a system exercise in the content management area',
    proc: [
      'Run request "GET /api/content/exercises/{code}" from the Postman collection folder "Content > Exercise & workout management"',
      'Path variable: code = the code of the exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise name, description, target muscle, level and guide steps',
      'Response body contains the demo video URL and the anatomy image URL',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-exercise-create', 'POST', '/api/content/exercises', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Create a new system exercise with its demo video and anatomy image',
    proc: [
      'Run request "POST /api/content/exercises" from the Postman collection folder "Content > Exercise & workout management"',
      'Body: form-data — part "data" = the exercise JSON, parts "demoVideo" and "anatomyImage" = the media files',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created exercise with its generated code',
      'The exercise appears in the exercise list with the status ACTIVE',
    ],
    pre: [
      ...PRE_CONTENT,
      '3. The exercise name is not used by any existing exercise or workout',
    ],
    form: {
      data: JSON.stringify({
        name: 'Pistol Squat',
        description: 'A single leg squat progression.',
        type: 'SKILL',
        muscleGroup: 'LEGS',
        level: 'ADVANCED',
        guideSteps: ['Stand on one leg', 'Sit down on the other leg', 'Stand back up'],
        equipment: 'NONE',
      }),
      demoVideo: '@C:/calishealth-testdata/pistol-squat.mp4',
      anatomyImage: '@C:/calishealth-testdata/pistol-squat.png',
    },
    expect: [200, 201],
  }),
  E('content-exercise-create-duplicate-name', 'POST', '/api/content/exercises', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Creating an exercise is rejected when the name is already used',
    proc: [
      'Run request "POST /api/content/exercises" from the Postman collection folder "Content > Exercise & workout management"',
      'Body: part "data" uses the name of an existing exercise',
    ],
    exp: [
      'HTTP 400 Bad Request (or 409 Conflict) is returned',
      'Response body explains that the name is already used',
      'No exercise is created',
    ],
    pre: PRE_CONTENT,
    form: {
      data: JSON.stringify({
        name: 'Pull-up',
        description: 'A duplicate name attempt.',
        type: 'SKILL',
        muscleGroup: 'BACK',
        level: 'BEGINNER',
        guideSteps: ['Hang from the bar', 'Pull up'],
      }),
    },
    expect: [400, 409],
  }),
  E('content-exercise-update', 'PUT', '/api/content/exercises/{code}', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Update a system exercise and optionally replace its media',
    proc: [
      'Run request "PUT /api/content/exercises/{code}" from the Postman collection folder "Content > Exercise & workout management"',
      'Path variable: code = the code of the exercise',
      'Body: form-data — part "data" = the updated exercise JSON',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated exercise values',
      'The change is visible in the exercise detail endpoint',
    ],
    pre: PRE_CONTENT,
    form: {
      data: JSON.stringify({
        name: 'Pistol Squat',
        description: 'A single leg squat progression (updated description).',
        type: 'SKILL',
        muscleGroup: 'LEGS',
        level: 'ADVANCED',
        guideSteps: ['Stand on one leg', 'Sit down on the other leg', 'Stand back up'],
        equipment: 'NONE',
      }),
    },
    expect: [200],
  }),
  E('content-exercise-delete', 'DELETE', '/api/content/exercises/{code}', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Delete a system exercise that is not referenced by an active workout',
    proc: [
      'Run request "DELETE /api/content/exercises/{code}" from the Postman collection folder "Content > Exercise & workout management"',
      'Path variable: code = the code of the exercise',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The exercise no longer appears in the exercise list',
    ],
    pre: PRE_CONTENT,
    expect: [200, 204],
  }),
  E('content-exercise-update-status', 'PATCH', '/api/content/exercises/{code}/status', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Activate or deactivate a system exercise',
    proc: [
      'Run request "PATCH /api/content/exercises/{code}/status" from the Postman collection folder "Content > Exercise & workout management"',
      'Body: active and rejectionReason',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new status of the exercise',
      'A deactivated exercise is no longer offered to the members',
    ],
    pre: PRE_CONTENT,
    body: { active: false, rejectionReason: 'Temporary suspension of the exercise' },
    expect: [200],    pathValues: { code: '{{exerciseCode}}' },
}),

  // ------------------------------------------- Pending exercise moderation list
  E('content-exercises-pending-moderation', 'GET', '/api/content/exercises/pending-moderation', {
    feature: F, section: 'Pending exercise moderation list', role: ROLE.CONTENT,
    desc: 'List the member exercises waiting for the content moderation',
    proc: [
      'Run request "GET /api/content/exercises/pending-moderation" from the Postman collection folder "Content > Pending exercise moderation list"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of submitted exercises with their author and submission date',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Exercise approval history
  E('content-exercises-approval-history', 'GET', '/api/content/exercises/approval-history', {
    feature: F, section: 'Exercise approval history', role: ROLE.CONTENT,
    desc: 'List the moderation history of the submitted exercises',
    proc: [
      'Run request "GET /api/content/exercises/approval-history" from the Postman collection folder "Content > Exercise approval history"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the moderation records with the decision, the reason and the moderator',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Exercise moderation detail
  E('content-exercise-moderation-detail', 'GET', '/api/content/exercises/{code}', {
    feature: F, section: 'Exercise moderation detail', role: ROLE.CONTENT,
    desc: 'Open a submitted exercise to review it before deciding',
    proc: [
      'Run request "GET /api/content/exercises/{code}" from the Postman collection folder "Content > Exercise moderation detail"',
      'Path variable: code = the code of the submitted exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the submitted title, description, guide steps and the demo video URL',
      'Response body contains the current moderation status',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Rejection details
  E('content-exercise-rejection-detail', 'GET', '/api/content/exercises/approval-history', {
    feature: F, section: 'Rejection details', role: ROLE.CONTENT,
    desc: 'Read the rejection reason recorded in the moderation history',
    proc: [
      'Run request "GET /api/content/exercises/approval-history" from the Postman collection folder "Content > Rejection details"',
      'Look for the entry whose status is REJECTED',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The rejected entry contains the rejection reason and the moderator who rejected it',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Exercise detail
  E('content-exercise-detail-read', 'GET', '/api/content/exercises/{code}', {
    feature: F, section: 'Exercise detail', role: ROLE.CONTENT,
    desc: 'Read the full configuration of a system exercise',
    proc: [
      'Run request "GET /api/content/exercises/{code}" from the Postman collection folder "Content > Exercise detail"',
      'Path variable: code = the code of the exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise configuration together with its physiology profile',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Workout detail
  E('content-workout-detail-read', 'GET', '/api/content/workouts/{code}', {
    feature: F, section: 'Workout detail', role: ROLE.CONTENT,
    desc: 'Read the full configuration of a system workout',
    proc: [
      'Run request "GET /api/content/workouts/{code}" from the Postman collection folder "Content > Workout detail"',
      'Path variable: code = the code of the workout',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout configuration together with the exercise items and their configuration',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Create system exercise & workout
  E('content-workout-create', 'POST', '/api/content/workouts', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Create a new system workout',
    proc: [
      'Run request "POST /api/content/workouts" from the Postman collection folder "Content > Create system exercise & workout"',
      'Body: name, description, type, level, exerciseCodes / items and the plan configuration',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created workout with its generated code',
      'The workout appears in the workout list with the status ACTIVE',
    ],
    pre: [
      ...PRE_CONTENT,
      '3. The workout name is not used by any existing workout or exercise',
    ],
    body: {
      name: 'Beginner Push Upper',
      description: 'A push-up focused routine for beginners.',
      type: 'HEALTH',
      level: 'BEGINNER',
      daysPerWeek: 3,
      daySequence: 1,
      templateStatus: 'ACTIVE',
      exerciseCodes: ['PUSH_UP', 'PIKE_PUSH_UP'],
      items: [
        { exerciseCode: 'PUSH_UP', sets: 3, reps: 12, restSeconds: 60 },
        { exerciseCode: 'PIKE_PUSH_UP', sets: 3, reps: 8, restSeconds: 90 },
      ],
    },
    expect: [200, 201],
  }),
  E('content-workout-create-duplicate-name', 'POST', '/api/content/workouts', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Creating a workout is rejected when the name is already used',
    proc: [
      'Run request "POST /api/content/workouts" from the Postman collection folder "Content > Create system exercise & workout"',
      'Body: name = "Beginner Push Upper" (an existing workout name)',
    ],
    exp: [
      'HTTP 400 Bad Request (or 409 Conflict) is returned',
      'Response body explains that the name is already used',
      'No workout is created',
    ],
    pre: PRE_CONTENT,
    body: {
      name: 'Beginner Push Upper',
      description: 'A duplicate name attempt.',
      type: 'HEALTH',
      level: 'BEGINNER',
      exerciseCodes: ['PUSH_UP'],
    },
    expect: [400, 409],
  }),
  E('content-workout-update', 'PUT', '/api/content/workouts/{code}', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Update a system workout',
    proc: [
      'Run request "PUT /api/content/workouts/{code}" from the Postman collection folder "Content > Create system exercise & workout"',
      'Path variable: code = the code of the workout',
      'Body: name, description, type, level and items[]',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated workout values',
    ],
    pre: PRE_CONTENT,
    body: {
      name: 'Beginner Push Upper (updated)',
      description: 'A push-up focused routine for beginners.',
      type: 'HEALTH',
      level: 'BEGINNER',
      daysPerWeek: 3,
      daySequence: 1,
      templateStatus: 'ACTIVE',
      items: [
        { exerciseCode: 'PUSH_UP', sets: 4, reps: 10, restSeconds: 60 },
      ],
    },
    expect: [200],
  }),
  E('content-workout-clone', 'POST', '/api/content/workouts/{code}/clone', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Clone an existing workout into a new draft',
    proc: [
      'Run request "POST /api/content/workouts/{code}/clone" from the Postman collection folder "Content > Create system exercise & workout"',
      'Path variable: code = the code of the workout to clone',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the cloned workout with a new code',
      'The clone keeps the exercise items of the source workout',
    ],
    pre: PRE_CONTENT,
    expect: [200, 201],
  }),
  E('content-workout-quick-update', 'PATCH', '/api/content/workouts/{code}/quick-update', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Quickly adjust the sets, reps or duration of a workout',
    proc: [
      'Run request "PATCH /api/content/workouts/{code}/quick-update" from the Postman collection folder "Content > Create system exercise & workout"',
      'Body: setsDelta, repsDelta and durationDelta',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the workout with the adjusted values',
      'The adjustment is persisted',
    ],
    pre: PRE_CONTENT,
    body: { setsDelta: 1, repsDelta: -2, durationDelta: 0 },
    expect: [200],    pathValues: { code: '{{workoutCode}}' },
}),
  E('content-workout-update-status', 'PATCH', '/api/content/workouts/{code}/status', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Activate or deactivate a system workout',
    proc: [
      'Run request "PATCH /api/content/workouts/{code}/status" from the Postman collection folder "Content > Create system exercise & workout"',
      'Body: active and rejectionReason',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new status of the workout',
    ],
    pre: PRE_CONTENT,
    body: { active: false, rejectionReason: 'Rebalancing the training weeks' },
    expect: [200],    pathValues: { code: '{{workoutCode}}' },
}),
  E('content-workout-delete', 'DELETE', '/api/content/workouts/{code}', {
    feature: F, section: 'Create system exercise & workout', role: ROLE.CONTENT,
    desc: 'Delete a system workout',
    proc: [
      'Run request "DELETE /api/content/workouts/{code}" from the Postman collection folder "Content > Create system exercise & workout"',
      'Path variable: code = the code of the workout',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The workout no longer appears in the workout list',
    ],
    pre: PRE_CONTENT,
    expect: [200, 204],
  }),

  // ------------------------------------------- Progression rule configurations
  E('progression-rules-list', 'GET', '/api/content/progression-rules', {
    feature: F, section: 'Progression rule configurations', role: ROLE.CONTENT,
    desc: 'List the progression rules that define how an exercise unlocks the next one',
    proc: [
      'Run request "GET /api/content/progression-rules" from the Postman collection folder "Content > Progression rule configurations"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the rules with the prerequisite, required sets, reps and minimum accuracy',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('progression-rules-tree', 'GET', '/api/content/progression-rules/tree', {
    feature: F, section: 'Progression rule configurations', role: ROLE.CONTENT,
    desc: 'Load the progression rules as a tree of exercise dependencies',
    proc: [
      'Run request "GET /api/content/progression-rules/tree" from the Postman collection folder "Content > Progression rule configurations"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the root node with the child nodes of the progression tree',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Create progression rule
  E('progression-rule-create', 'POST', '/api/content/progression-rules', {
    feature: F, section: 'Create progression rule', role: ROLE.CONTENT,
    desc: 'Create a progression rule between two exercises',
    proc: [
      'Run request "POST /api/content/progression-rules" from the Postman collection folder "Content > Create progression rule"',
      'Body: exerciseCode, prerequisiteCode, requiredSets, requiredReps, requiredSeconds, minAccuracy and status',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created rule with its id',
      'The rule appears in the rule list and in the progression tree',
    ],
    pre: PRE_CONTENT,
    body: {
      exerciseCode: 'CHEST_TO_BAR',
      prerequisiteCode: 'PULL_UP',
      requiredSets: 3,
      requiredReps: 8,
      requiredSeconds: null,
      minAccuracy: 80,
      status: 'ACTIVE',
    },
    expect: [200, 201],
  }),
  E('progression-rule-create-invalid-accuracy', 'POST', '/api/content/progression-rules', {
    feature: F, section: 'Create progression rule', role: ROLE.CONTENT,
    desc: 'Creating a progression rule is rejected when the accuracy threshold is out of range',
    proc: [
      'Run request "POST /api/content/progression-rules" from the Postman collection folder "Content > Create progression rule"',
      'Body: minAccuracy = 150 (allowed range is 1 to 100)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the accuracy must be between 1 and 100',
      'No rule is created',
    ],
    pre: PRE_CONTENT,
    body: {
      exerciseCode: 'CHEST_TO_BAR',
      prerequisiteCode: 'PULL_UP',
      requiredSets: 3,
      requiredReps: 8,
      minAccuracy: 150,
      status: 'ACTIVE',
    },
    expect: [400],
  }),

  // ------------------------------------------- Progression rule detail
  E('progression-rule-detail', 'GET', '/api/content/progression-rules/{id}', {
    feature: F, section: 'Progression rule detail', role: ROLE.CONTENT,
    desc: 'Open the detail of a progression rule',
    proc: [
      'Run request "GET /api/content/progression-rules/{id}" from the Postman collection folder "Content > Progression rule detail"',
      'Path variable: id = the id of the rule',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise pair, the thresholds and the status of the rule',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('progression-rule-detail-not-found', 'GET', '/api/content/progression-rules/{id}', {
    feature: F, section: 'Progression rule detail', role: ROLE.CONTENT,
    desc: 'Opening an unknown progression rule returns a not-found error',
    proc: [
      'Run request "GET /api/content/progression-rules/{id}" from the Postman collection folder "Content > Progression rule detail"',
      'Path variable: id = 999999',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the rule was not found',
    ],
    pre: PRE_CONTENT,
    expect: [404],
  }),

  // ------------------------------------------- Update progression rule
  E('progression-rule-update', 'PUT', '/api/content/progression-rules/{id}', {
    feature: F, section: 'Update progression rule', role: ROLE.CONTENT,
    desc: 'Update the thresholds of an existing progression rule',
    proc: [
      'Run request "PUT /api/content/progression-rules/{id}" from the Postman collection folder "Content > Update progression rule"',
      'Path variable: id = the id of the rule',
      'Body: requiredSets, requiredReps, requiredSeconds, minAccuracy and status',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated thresholds',
      'The change is visible in the rule list',
    ],
    pre: PRE_CONTENT,
    body: {
      requiredSets: 4,
      requiredReps: 10,
      requiredSeconds: null,
      minAccuracy: 85,
      status: 'ACTIVE',
    },
    expect: [200],
  }),
  E('progression-rule-update-status', 'PATCH', '/api/content/progression-rules/{id}/status', {
    feature: F, section: 'Update progression rule', role: ROLE.CONTENT,
    desc: 'Activate or deactivate a progression rule',
    proc: [
      'Run request "PATCH /api/content/progression-rules/{id}/status" from the Postman collection folder "Content > Update progression rule"',
      'Query param: status = "ACTIVE"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new status of the rule',
      'A deactivated rule no longer unlocks the dependent exercise',
    ],
    pre: PRE_CONTENT,
    query: { status: 'ACTIVE' },
    expect: [200],    pathValues: { id: '{{ruleId}}' },
}),
  E('progression-rule-delete', 'DELETE', '/api/content/progression-rules/{id}', {
    feature: F, section: 'Update progression rule', role: ROLE.CONTENT,
    desc: 'Delete a progression rule',
    proc: [
      'Run request "DELETE /api/content/progression-rules/{id}" from the Postman collection folder "Content > Update progression rule"',
      'Path variable: id = the id of the rule',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The rule no longer appears in the rule list',
    ],
    pre: PRE_CONTENT,
    expect: [200, 204],
  }),

  // ------------------------------------------- Calisthenic level benchmark criteria
  E('level-benchmarks-get', 'GET', '/api/content/level-benchmarks', {
    feature: F, section: 'Calisthenic level benchmark criteria', role: ROLE.CONTENT,
    desc: 'Read the level benchmark configuration used to score the level test',
    proc: [
      'Run request "GET /api/content/level-benchmarks" from the Postman collection folder "Content > Calisthenic level benchmark criteria"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the list of levels and, for each level, the benchmark exercises and their thresholds',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Update level & benchmark criteria
  E('level-benchmarks-create-level', 'POST', '/api/content/level-benchmarks', {
    feature: F, section: 'Update level & benchmark criteria', role: ROLE.CONTENT,
    desc: 'Create a new fitness level in the benchmark configuration',
    proc: [
      'Run request "POST /api/content/level-benchmarks" from the Postman collection folder "Content > Update level & benchmark criteria"',
      'Body: name and status',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the benchmark configuration with the new level',
    ],
    pre: PRE_CONTENT,
    body: { name: 'EXPERT', status: 'ACTIVE' },
    expect: [200],
  }),
  E('level-benchmarks-update', 'PUT', '/api/content/level-benchmarks', {
    feature: F, section: 'Update level & benchmark criteria', role: ROLE.CONTENT,
    desc: 'Update the benchmark exercises and the levels of the configuration',
    proc: [
      'Run request "PUT /api/content/level-benchmarks" from the Postman collection folder "Content > Update level & benchmark criteria"',
      'Body: exercises[] and levels[]',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated benchmark configuration',
      'The updated thresholds are used by the next level test scoring',
    ],
    pre: PRE_CONTENT,
    body: {
      exercises: [
        { exerciseCode: 'PULL_UP', reps: 12, score: 3 },
      ],
      levels: [
        { name: 'BEGINNER', status: 'ACTIVE' },
      ],
    },
    expect: [200],
  }),
  E('level-benchmarks-delete-level', 'DELETE', '/api/content/level-benchmarks/levels/{id}', {
    feature: F, section: 'Update level & benchmark criteria', role: ROLE.CONTENT,
    desc: 'Delete a fitness level from the benchmark configuration',
    proc: [
      'Run request "DELETE /api/content/level-benchmarks/levels/{id}" from the Postman collection folder "Content > Update level & benchmark criteria"',
      'Path variable: id = the id of the level',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the benchmark configuration without the deleted level',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('level-benchmarks-update-level-status', 'PATCH', '/api/content/level-benchmarks/levels/{level}/status', {
    feature: F, section: 'Update level & benchmark criteria', role: ROLE.CONTENT,
    desc: 'Activate or deactivate a fitness level',
    proc: [
      'Run request "PATCH /api/content/level-benchmarks/levels/{level}/status" from the Postman collection folder "Content > Update level & benchmark criteria"',
      'Path variable: level = the name of the level; Query param: status = "ACTIVE"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new status of the level',
      'An inactive level is not offered to the members',
    ],
    pre: PRE_CONTENT,
    query: { status: 'ACTIVE' },
    expect: [200],
  }),

  // ------------------------------------------- Benchmark level detail
  E('level-benchmarks-level-detail', 'GET', '/api/content/level-benchmarks', {
    feature: F, section: 'Benchmark level detail', role: ROLE.CONTENT,
    desc: 'Read the benchmark criteria of a single fitness level',
    proc: [
      'Run request "GET /api/content/level-benchmarks" from the Postman collection folder "Content > Benchmark level detail"',
      'Look for the level entry in the returned configuration',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The configuration contains the benchmark exercises of the level with their reps thresholds and scores',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),

  // ------------------------------------------- Exercise form rules (content area)
  E('content-exercise-form-rules-get', 'GET', '/api/content/exercises/{exerciseCode}/form-rules', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Read the form scoring thresholds configured for an exercise',
    proc: [
      'Run request "GET /api/content/exercises/{exerciseCode}/form-rules" from the Postman collection folder "Content > Exercise & workout management"',
      'Path variable: exerciseCode = the code of the exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the joint thresholds (angle, ROM depth, weight) of the exercise',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('content-exercise-form-rules-replace', 'PUT', '/api/content/exercises/{exerciseCode}/form-rules', {
    feature: F, section: 'Exercise & workout management', role: ROLE.CONTENT,
    desc: 'Replace the form scoring thresholds of an exercise',
    proc: [
      'Run request "PUT /api/content/exercises/{exerciseCode}/form-rules" from the Postman collection folder "Content > Exercise & workout management"',
      'Body: rules[] with the joint thresholds',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the stored thresholds',
      'The new thresholds are used by the next form assessment of that exercise',
    ],
    pre: PRE_CONTENT,
    body: {
      rules: [
        {
          joint: 'ELBOW',
          angleThreshold: 90,
          romDepth: 70,
          minAngle: 40,
          maxAngle: 110,
          weight: 1,
        },
      ],
    },
    expect: [200],    pathValues: { exerciseCode: 'PULL_UP' },
}),

  // ------------------------------------------- Form rule presets (member readable)
  E('form-rule-presets-list', 'GET', '/api/member/form-rules/presets', {
    feature: F, section: 'Exercise & workout management', role: ROLE.MEMBER,
    desc: 'List the form rule presets that the content team can apply to an exercise',
    proc: [
      'Run request "GET /api/member/form-rules/presets" from the Postman collection folder "Content > Exercise & workout management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the presets with their movement group and category',
    ],
    pre: PRE_CONTENT,
    expect: [200],
  }),
  E('form-rule-presets-by-group', 'GET', '/api/member/form-rules/presets/by-group', {
    feature: F, section: 'Exercise & workout management', role: ROLE.MEMBER,
    desc: 'List the form rule presets of a movement group',
    proc: [
      'Run request "GET /api/member/form-rules/presets/by-group" from the Postman collection folder "Content > Exercise & workout management"',
      'Query params: movementGroup = "PUSH", category = "JOINT"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Only the presets of the requested movement group and category are returned',
    ],
    pre: PRE_CONTENT,
    query: { movementGroup: 'PUSH', category: 'JOINT' },
    expect: [200],
  }),
  E('form-rule-suggestions', 'GET', '/api/member/form-rules/suggestions', {
    feature: F, section: 'Exercise & workout management', role: ROLE.MEMBER,
    desc: 'Suggest form rule presets for a movement group',
    proc: [
      'Run request "GET /api/member/form-rules/suggestions" from the Postman collection folder "Content > Exercise & workout management"',
      'Query param: movementGroup = "PUSH"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the suggested presets for the movement group',
    ],
    pre: PRE_CONTENT,
    query: { movementGroup: 'PUSH' },
    expect: [200],
  }),

  // ------------------------------------------- Access control
  E('content-exercises-member-forbidden', 'GET', '/api/content/exercises', {
    feature: F, section: 'Exercise & workout management', role: ROLE.MEMBER,
    desc: 'A regular member cannot open the content management endpoints',
    proc: [
      'Run request "GET /api/content/exercises" from the Postman collection folder "Content > Exercise & workout management"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'The content management payload is not returned',
    ],
    pre: [...PRE_AUTH],
    expect: [403],
  }),
  E('content-exercises-unauthenticated', 'GET', '/api/content/exercises', {
    feature: F, section: 'Exercise & workout management', role: ROLE.NONE,
    desc: 'The content management endpoints reject unauthenticated requests',
    proc: [
      'Run request "GET /api/content/exercises" from the Postman collection folder "Content > Exercise & workout management"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No content management data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),
];
