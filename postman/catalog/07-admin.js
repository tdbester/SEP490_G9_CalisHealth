/**
 * Feature: Admin System
 * Covers the /api/admin/** family: dashboard, users, notifications, storage,
 * maintenance schedules and feedback handling.
 */
const { E, ROLE, PRE_ADMIN, PRE_AUTH, PRE_GUEST } = require('./_helpers');

const F = 'Admin System';

module.exports = [
  // ------------------------------------------- Admin dashboard
  E('admin-dashboard-overview', 'GET', '/api/admin/dashboard/overview', {
    feature: F, section: 'Admin dashboard', role: ROLE.ADMIN,
    desc: 'Open the admin dashboard with the system-wide counters',
    proc: [
      'Run request "GET /api/admin/dashboard/overview" from the Postman collection folder "Admin > Admin dashboard"',
      'Header: Authorization = "Bearer {{adminToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the total counts of users, exercises, workouts and media',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-dashboard-forbidden-for-member', 'GET', '/api/admin/dashboard/overview', {
    feature: F, section: 'Admin dashboard', role: ROLE.MEMBER,
    desc: 'A regular member cannot open the admin dashboard',
    proc: [
      'Run request "GET /api/admin/dashboard/overview" from the Postman collection folder "Admin > Admin dashboard"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'No system-wide counter is disclosed',
    ],
    pre: [...PRE_AUTH],
    expect: [403],
  }),
  E('admin-dashboard-unauthenticated', 'GET', '/api/admin/dashboard/overview', {
    feature: F, section: 'Admin dashboard', role: ROLE.NONE,
    desc: 'The admin dashboard rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/admin/dashboard/overview" from the Postman collection folder "Admin > Admin dashboard"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No dashboard data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ------------------------------------------- Survey questions management
  E('admin-content-surveys-list-steps', 'GET', '/api/content/surveys/{surveyCode}/steps', {
    feature: F, section: 'Survey questions management', role: ROLE.ADMIN,
    desc: 'List the steps of the onboarding survey in the admin area',
    proc: [
      'Run request "GET /api/content/surveys/{surveyCode}/steps" from the Postman collection folder "Admin > Survey questions management"',
      'Path variable: surveyCode = "CALISHEALTH_ONBOARDING"',
      'Header: Authorization = "Bearer {{adminToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the ordered list of steps with their code, title and status',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),
  E('admin-content-surveys-available-questions', 'GET', '/api/content/surveys/{surveyCode}/steps/available-questions', {
    feature: F, section: 'Survey questions management', role: ROLE.ADMIN,
    desc: 'List the questions that can still be assigned to a new step',
    proc: [
      'Run request "GET /api/content/surveys/{surveyCode}/steps/available-questions" from the Postman collection folder "Admin > Survey questions management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists the questions that are not used by any step yet',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),
  E('admin-content-surveys-member-forbidden', 'GET', '/api/content/surveys/{surveyCode}/steps', {
    feature: F, section: 'Survey questions management', role: ROLE.MEMBER,
    desc: 'A member cannot manage the survey steps',
    proc: [
      'Run request "GET /api/content/surveys/{surveyCode}/steps" from the Postman collection folder "Admin > Survey questions management"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'No survey step data is returned',
    ],
    pre: [...PRE_AUTH],
    expect: [403],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),

  // ------------------------------------------- Create step
  E('admin-content-surveys-create-step', 'POST', '/api/content/surveys/{surveyCode}/steps', {
    feature: F, section: 'Create step', role: ROLE.ADMIN,
    desc: 'Create a new step in the onboarding survey',
    proc: [
      'Run request "POST /api/content/surveys/{surveyCode}/steps" from the Postman collection folder "Admin > Create step"',
      'Path variable: surveyCode = "CALISHEALTH_ONBOARDING"',
      'Body: step code, title, type and the list of question codes',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created step with its id and code',
      'The step appears at the end of the step list',
    ],
    pre: PRE_ADMIN,
    body: {
      code: 'RECOVERY_CHECK',
      title: 'Recovery check',
      type: 'SINGLE_CHOICE',
      questionCodes: ['RECOVERY_SLEEP'],
    },
    expect: [200, 201],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),
  E('admin-content-surveys-create-step-duplicate-code', 'POST', '/api/content/surveys/{surveyCode}/steps', {
    feature: F, section: 'Create step', role: ROLE.ADMIN,
    desc: 'Creating a step is rejected when the step code already exists',
    proc: [
      'Run request "POST /api/content/surveys/{surveyCode}/steps" from the Postman collection folder "Admin > Create step"',
      'Body: code = "BODY_INFO" (a code that is already used by another step)',
    ],
    exp: [
      'HTTP 400 Bad Request (or 409 Conflict) is returned',
      'Response body explains that the step code is already in use',
      'No duplicate step is created',
    ],
    pre: PRE_ADMIN,
    body: {
      code: 'BODY_INFO',
      title: 'Duplicate body info step',
      type: 'SINGLE_CHOICE',
      questionCodes: [],
    },
    expect: [400, 409],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),

  // ------------------------------------------- Preview step
  E('admin-content-surveys-preview-step', 'GET', '/api/content/surveys/{surveyCode}/steps/{stepId}/preview', {
    feature: F, section: 'Preview step', role: ROLE.ADMIN,
    desc: 'Preview a survey step exactly as the member will see it',
    proc: [
      'Run request "GET /api/content/surveys/{surveyCode}/steps/{stepId}/preview" from the Postman collection folder "Admin > Preview step"',
      'Path variables: surveyCode = "CALISHEALTH_ONBOARDING", stepId = the id of the step',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the rendered questions with their options and the required flag',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),
  E('admin-content-surveys-preview-check', 'POST', '/api/content/surveys/{surveyCode}/steps/{stepId}/preview/check', {
    feature: F, section: 'Preview step', role: ROLE.ADMIN,
    desc: 'Run the validation rules of a survey step against a sample answer set',
    proc: [
      'Run request "POST /api/content/surveys/{surveyCode}/steps/{stepId}/preview/check" from the Postman collection folder "Admin > Preview step"',
      'Body: the sample answers to validate',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reports the validation result and lists the invalid answers with their reason',
    ],
    pre: PRE_ADMIN,
    body: {
      answers: [{ questionCode: 'RECOVERY_SLEEP', value: '7-8' }],
    },
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),

  // ------------------------------------------- Update step
  E('admin-content-surveys-update-step', 'PUT', '/api/content/surveys/{surveyCode}/steps/{stepId}', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Update the title and the question list of a survey step',
    proc: [
      'Run request "PUT /api/content/surveys/{surveyCode}/steps/{stepId}" from the Postman collection folder "Admin > Update step"',
      'Body: title, type and the list of question codes',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated step values',
      'The change is visible in the step list',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),
  E('admin-content-surveys-update-step-status', 'PUT', '/api/content/surveys/{surveyCode}/steps/{stepId}/status', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Activate or deactivate a survey step',
    proc: [
      'Run request "PUT /api/content/surveys/{surveyCode}/steps/{stepId}/status" from the Postman collection folder "Admin > Update step"',
      'Body: status = "ACTIVE" or "INACTIVE"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the new status of the step',
      'An inactive step is skipped by the member survey flow',
    ],
    pre: PRE_ADMIN,
    body: { status: 'ACTIVE' },
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),
  E('admin-content-surveys-reorder-steps', 'PUT', '/api/content/surveys/{surveyCode}/steps/order', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Reorder the steps of the onboarding survey',
    proc: [
      'Run request "PUT /api/content/surveys/{surveyCode}/steps/order" from the Postman collection folder "Admin > Update step"',
      'Body: the ordered array of step ids',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the step list in the new order',
    ],
    pre: PRE_ADMIN,
    body: { stepIds: [1, 2, 3, 4, 5] },
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING' },
}),
  E('admin-content-surveys-delete-step', 'DELETE', '/api/content/surveys/{surveyCode}/steps/{stepId}', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Delete a survey step that is not yet used by a running session',
    proc: [
      'Run request "DELETE /api/content/surveys/{surveyCode}/steps/{stepId}" from the Postman collection folder "Admin > Update step"',
      'Path variable: stepId = the id of the step to delete',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The step no longer appears in the step list',
    ],
    pre: PRE_ADMIN,
    expect: [200, 204],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),
  E('admin-content-surveys-step-result-config', 'GET', '/api/content/surveys/{surveyCode}/steps/{stepId}/result-config', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Read the result mapping configured for a survey step',
    proc: [
      'Run request "GET /api/content/surveys/{surveyCode}/steps/{stepId}/result-config" from the Postman collection folder "Admin > Update step"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the mapping between the question answers and the result values',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),
  E('admin-content-surveys-update-result-config', 'PUT', '/api/content/surveys/{surveyCode}/steps/{stepId}/result-config', {
    feature: F, section: 'Update step', role: ROLE.ADMIN,
    desc: 'Update the result mapping of a survey step',
    proc: [
      'Run request "PUT /api/content/surveys/{surveyCode}/steps/{stepId}/result-config" from the Postman collection folder "Admin > Update step"',
      'Body: the new mapping of question codes to result values',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated mapping',
    ],
    pre: PRE_ADMIN,
    body: {
      mappings: [
        { questionCode: 'RECOVERY_SLEEP', value: '7-8', score: 3 },
      ],
    },
    expect: [200],    pathValues: { surveyCode: 'CALISHEALTH_ONBOARDING', stepId: '{{stepId}}' },
}),

  // ------------------------------------------- User management
  E('admin-users-list', 'GET', '/api/admin/users', {
    feature: F, section: 'User management', role: ROLE.ADMIN,
    desc: 'List the users of the system with paging and filters',
    proc: [
      'Run request "GET /api/admin/users" from the Postman collection folder "Admin > User management"',
      'Query params: page = 0, size = 20',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged list of users with their email, role and active state',
    ],
    pre: PRE_ADMIN,
    query: { page: '0', size: '20' },
    expect: [200],
  }),
  E('admin-users-list-filter-role', 'GET', '/api/admin/users', {
    feature: F, section: 'User management', role: ROLE.ADMIN,
    desc: 'Filter the user list by role',
    proc: [
      'Run request "GET /api/admin/users" from the Postman collection folder "Admin > User management"',
      'Query param: role = "CONTENT_MANAGER"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Only users with the CONTENT_MANAGER role are returned',
    ],
    pre: PRE_ADMIN,
    query: { role: 'CONTENT_MANAGER' },
    expect: [200],
  }),
  E('admin-users-list-filter-status', 'GET', '/api/admin/users', {
    feature: F, section: 'User management', role: ROLE.ADMIN,
    desc: 'Filter the user list by role and by account status',
    proc: [
      'Run request "GET /api/admin/users" from the Postman collection folder "Admin > User management"',
      'Query params: role = "ADMIN", status = "ACTIVE", sort = "newest"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Only the active administrators are returned',
      'The result is ordered by the requested sort key',
    ],
    pre: PRE_ADMIN,
    query: { role: 'ADMIN', status: 'ACTIVE', sort: 'newest' },
    expect: [200],
  }),

  // ------------------------------------------- Create other admin / content manager account
  E('admin-users-create', 'POST', '/api/admin/users', {
    feature: F, section: 'Create other admin/ content manager account', role: ROLE.ADMIN,
    desc: 'Create a staff account with the ADMIN or CONTENT_MANAGER role',
    proc: [
      'Run request "POST /api/admin/users" from the Postman collection folder "Admin > Create other admin/ content manager account"',
      'Body: fullName, email and role',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created user with its id and role',
      'The account receives a temporary password that forces a password change on the first login',
    ],
    pre: PRE_ADMIN,
    body: {
      fullName: 'Content Manager One',
      email: 'content.manager@calishealth.local',
      role: 'CONTENT_MANAGER',
    },
    expect: [200, 201],
  }),
  E('admin-users-create-duplicate-email', 'POST', '/api/admin/users', {
    feature: F, section: 'Create other admin/ content manager account', role: ROLE.ADMIN,
    desc: 'Creating a staff account is rejected when the email is already registered',
    proc: [
      'Run request "POST /api/admin/users" from the Postman collection folder "Admin > Create other admin/ content manager account"',
      'Body: email = "admin@calishealth.local" (already exists)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the email has already been registered',
      'No account is created',
    ],
    pre: PRE_ADMIN,
    body: {
      fullName: 'Duplicate Admin',
      email: 'admin@calishealth.local',
      role: 'ADMIN',
    },
    expect: [400],
  }),
  E('admin-users-create-invalid-role', 'POST', '/api/admin/users', {
    feature: F, section: 'Create other admin/ content manager account', role: ROLE.ADMIN,
    desc: 'Creating a staff account is rejected when the role is not a valid one',
    proc: [
      'Run request "POST /api/admin/users" from the Postman collection folder "Admin > Create other admin/ content manager account"',
      'Body: role = "SUPER_ADMIN"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the role is not valid',
      'No account is created',
    ],
    pre: PRE_ADMIN,
    body: {
      fullName: 'Invalid Role',
      email: 'invalid.role@calishealth.local',
      role: 'SUPER_ADMIN',
    },
    expect: [400],
  }),

  // ------------------------------------------- User details & activity log
  E('admin-users-detail', 'GET', '/api/admin/users/{id}', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'Open the detail of a user account',
    proc: [
      'Run request "GET /api/admin/users/{id}" from the Postman collection folder "Admin > User details & activity log"',
      'Path variable: id = the numeric id of the user',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the email, full name, role, active state and registration date',
      'The response does not expose the password hash',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-users-workout-activity', 'GET', '/api/admin/users/{id}/workout-activity', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'View the workout activity log of a user',
    proc: [
      'Run request "GET /api/admin/users/{id}/workout-activity" from the Postman collection folder "Admin > User details & activity log"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged workout activity entries with their status',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { id: '{{memberId}}' },
}),
  E('admin-users-system-logs', 'GET', '/api/admin/users/{id}/system-logs', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'View the system logs of a user account',
    proc: [
      'Run request "GET /api/admin/users/{id}/system-logs" from the Postman collection folder "Admin > User details & activity log"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the log entries with the action, the timestamp and the actor',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { id: '{{memberId}}' },
}),
  E('admin-users-admin-actions', 'GET', '/api/admin/users/{id}/admin-actions', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'View the administrative actions performed on a user account',
    proc: [
      'Run request "GET /api/admin/users/{id}/admin-actions" from the Postman collection folder "Admin > User details & activity log"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists the admin actions with the action type and the administrator who performed them',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { id: '{{memberId}}' },
}),
  E('admin-users-content-activity', 'GET', '/api/admin/users/{id}/content-activity', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'View the content activity of a user (submitted exercises and workouts)',
    proc: [
      'Run request "GET /api/admin/users/{id}/content-activity" from the Postman collection folder "Admin > User details & activity log"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists the content items submitted by the user with their moderation status',
    ],
    pre: PRE_ADMIN,
    expect: [200],    pathValues: { id: '{{memberId}}' },
}),
  E('admin-users-update-status', 'PATCH', '/api/admin/users/status', {
    feature: F, section: 'User details & activity log', role: ROLE.ADMIN,
    desc: 'Activate or block several user accounts in bulk',
    proc: [
      'Run request "PATCH /api/admin/users/status" from the Postman collection folder "Admin > User details & activity log"',
      'Body: ids[] and active',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of affected accounts',
      'A blocked account can no longer log in',
    ],
    pre: PRE_ADMIN,
    body: { ids: [2, 3], active: false },
    expect: [200],
  }),

  // ------------------------------------------- Notification management
  E('admin-notifications-list', 'GET', '/api/admin/notifications', {
    feature: F, section: 'Notification management', role: ROLE.ADMIN,
    desc: 'List the notifications created by the administrators',
    proc: [
      'Run request "GET /api/admin/notifications" from the Postman collection folder "Admin > Notification management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the notification list with title, type, status and target audience',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Notification detail
  E('admin-notifications-detail', 'GET', '/api/admin/notifications/{id}', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Open the detail of a notification',
    proc: [
      'Run request "GET /api/admin/notifications/{id}" from the Postman collection folder "Admin > Notification detail"',
      'Path variable: id = the id of the notification',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the title, message, type, status and target audience of the notification',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-notifications-detail-not-found', 'GET', '/api/admin/notifications/{id}', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Opening an unknown notification returns a not-found error',
    proc: [
      'Run request "GET /api/admin/notifications/{id}" from the Postman collection folder "Admin > Notification detail"',
      'Path variable: id = 999999',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the notification was not found',
    ],
    pre: PRE_ADMIN,
    expect: [404],
  }),
  E('admin-notifications-update', 'PUT', '/api/admin/notifications/{id}', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Update the content of a notification',
    proc: [
      'Run request "PUT /api/admin/notifications/{id}" from the Postman collection folder "Admin > Notification detail"',
      'Body: title, message, type and status',
    ],
    exp: [
      'HTTP 200 OK (or 204 No Content) is returned',
      'The updated notification is returned by the detail endpoint',
    ],
    pre: PRE_ADMIN,
    body: {
      title: 'Scheduled maintenance on Sunday',
      message: 'The member app will be unavailable on Sunday from 02:00 to 04:00.',
      type: 'MAINTENANCE',
      status: 'PUBLISHED',
      targetAudience: 'MEMBER',
    },
    expect: [200, 204],    pathValues: { id: '{{notificationId}}' },
}),
  E('admin-notifications-delete', 'DELETE', '/api/admin/notifications/{id}', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Delete a single notification',
    proc: [
      'Run request "DELETE /api/admin/notifications/{id}" from the Postman collection folder "Admin > Notification detail"',
      'Path variable: id = the id of the notification to delete',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'The notification no longer appears in the notification list',
    ],
    pre: PRE_ADMIN,
    expect: [200, 204],
  }),
  E('admin-notifications-delete-batch', 'DELETE', '/api/admin/notifications/batch', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Delete several notifications in one operation',
    proc: [
      'Run request "DELETE /api/admin/notifications/batch" from the Postman collection folder "Admin > Notification detail"',
      'Body: ids[] = the notification ids to delete',
    ],
    exp: [
      'HTTP 204 No Content (or 200 OK) is returned',
      'All the listed notifications are removed from the list',
    ],
    pre: PRE_ADMIN,
    body: { ids: [1, 2] },
    expect: [200, 204],
  }),
  E('admin-notifications-delete-batch-empty', 'DELETE', '/api/admin/notifications/batch', {
    feature: F, section: 'Notification detail', role: ROLE.ADMIN,
    desc: 'Batch delete is rejected when the id list is empty',
    proc: [
      'Run request "DELETE /api/admin/notifications/batch" from the Postman collection folder "Admin > Notification detail"',
      'Body: ids = []',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the id list cannot be empty',
      'No notification is deleted',
    ],
    pre: PRE_ADMIN,
    body: { ids: [] },
    expect: [400],
  }),

  // ------------------------------------------- Create notification
  E('admin-notifications-create', 'POST', '/api/admin/notifications', {
    feature: F, section: 'Create notification', role: ROLE.ADMIN,
    desc: 'Create and publish a notification for the members',
    proc: [
      'Run request "POST /api/admin/notifications" from the Postman collection folder "Admin > Create notification"',
      'Body: title, message, type, status and targetAudience',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created notification with its id and status "PUBLISHED"',
      'The notification is delivered to the members of the target audience',
    ],
    pre: PRE_ADMIN,
    body: {
      title: 'New training program available',
      message: 'The 12-week calisthenics program is now available in the library.',
      type: 'ANNOUNCEMENT',
      status: 'PUBLISHED',
      targetAudience: 'MEMBER',
    },
    expect: [200, 201],
  }),
  E('admin-notifications-create-invalid-type', 'POST', '/api/admin/notifications', {
    feature: F, section: 'Create notification', role: ROLE.ADMIN,
    desc: 'Creating a notification is rejected when the type is not allowed',
    proc: [
      'Run request "POST /api/admin/notifications" from the Postman collection folder "Admin > Create notification"',
      'Body: type = "SPAM"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports the allowed notification types',
      'No notification is created',
    ],
    pre: PRE_ADMIN,
    body: {
      title: 'Invalid type notification',
      message: 'This notification uses a type that is not supported.',
      type: 'SPAM',
      status: 'PUBLISHED',
      targetAudience: 'MEMBER',
    },
    expect: [400],
  }),
  E('admin-notifications-create-blank-title', 'POST', '/api/admin/notifications', {
    feature: F, section: 'Create notification', role: ROLE.ADMIN,
    desc: 'Creating a notification is rejected when the title is blank',
    proc: [
      'Run request "POST /api/admin/notifications" from the Postman collection folder "Admin > Create notification"',
      'Body: title = ""',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the title is required',
      'No notification is created',
    ],
    pre: PRE_ADMIN,
    body: {
      title: '',
      message: 'The title of this notification is empty.',
      type: 'UPDATE',
      status: 'PUBLISHED',
      targetAudience: 'MEMBER',
    },
    expect: [400],
  }),

  // ------------------------------------------- Media storage & infrastructure
  E('admin-storage-overview', 'GET', '/api/admin/storage/overview', {
    feature: F, section: 'Media storage & infrastructure', role: ROLE.ADMIN,
    desc: 'Open the media storage overview of the admin portal',
    proc: [
      'Run request "GET /api/admin/storage/overview" from the Postman collection folder "Admin > Media storage & infrastructure"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the storage usage counters and the breakdown by media type',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Storage capacity
  E('admin-storage-quota', 'GET', '/api/admin/storage/quota', {
    feature: F, section: 'Storage capacity', role: ROLE.ADMIN,
    desc: 'Read the storage quota information of the Cloudinary account',
    proc: [
      'Run request "GET /api/admin/storage/quota" from the Postman collection folder "Admin > Storage capacity"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the used and the available storage quota',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-credit-guard', 'GET', '/api/admin/storage/credit-guard', {
    feature: F, section: 'Storage capacity', role: ROLE.ADMIN,
    desc: 'Read the credit guard status that protects the storage quota',
    proc: [
      'Run request "GET /api/admin/storage/credit-guard" from the Postman collection folder "Admin > Storage capacity"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the guard state and the reclaimable byte count',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-credit-guard-free', 'POST', '/api/admin/storage/credit-guard/free', {
    feature: F, section: 'Storage capacity', role: ROLE.ADMIN,
    desc: 'Run the credit guard to reclaim the storage space of orphaned media',
    proc: [
      'Run request "POST /api/admin/storage/credit-guard/free" from the Postman collection folder "Admin > Storage capacity"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of reclaimed bytes and the number of freed files',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-usage-refresh', 'POST', '/api/admin/storage/usage/refresh', {
    feature: F, section: 'Storage capacity', role: ROLE.ADMIN,
    desc: 'Refresh the cached storage usage from the media provider',
    proc: [
      'Run request "POST /api/admin/storage/usage/refresh" from the Postman collection folder "Admin > Storage capacity"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the refreshed usage overview',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Orphaned & rejected media cleanup
  E('admin-storage-media-list', 'GET', '/api/admin/storage/media', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'List the stored media files to find the orphaned or rejected ones',
    proc: [
      'Run request "GET /api/admin/storage/media" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
      'Query params: page = 0, size = 20',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the media items with their file name, size, type and storage state',
    ],
    pre: PRE_ADMIN,
    query: { page: '0', size: '20' },
    expect: [200],
  }),
  E('admin-storage-media-trash', 'POST', '/api/admin/storage/media/trash', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'Move media files to the trash so they can be purged later',
    proc: [
      'Run request "POST /api/admin/storage/media/trash" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
      'Body: ids[] = the media ids to trash',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of trashed, purged and skipped files and the purge date',
    ],
    pre: PRE_ADMIN,
    body: { ids: [1] },
    expect: [200],
  }),
  E('admin-storage-media-restore', 'POST', '/api/admin/storage/media/restore', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'Restore media files from the trash before the purge',
    proc: [
      'Run request "POST /api/admin/storage/media/restore" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
      'Body: ids[] = the media ids to restore',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of restored files and the grace period in days',
    ],
    pre: PRE_ADMIN,
    body: { ids: [1] },
    expect: [200],
  }),
  E('admin-storage-media-delete', 'DELETE', '/api/admin/storage/media', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'Permanently delete media files',
    proc: [
      'Run request "DELETE /api/admin/storage/media" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
      'Body: ids[] = the media ids to delete permanently',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of deleted files and the freed bytes',
    ],
    pre: PRE_ADMIN,
    body: { ids: [1] },
    expect: [200],
  }),
  E('admin-storage-media-extend', 'POST', '/api/admin/storage/media/{id}/extend', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'Extend the retention period of a media file',
    proc: [
      'Run request "POST /api/admin/storage/media/{id}/extend" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
      'Path variable: id = the media id; Body: days = 30',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the updated media item with the new purge date',
    ],
    pre: PRE_ADMIN,
    body: { days: 30 },
    expect: [200],
  }),
  E('admin-storage-empty-trash', 'DELETE', '/api/admin/storage/trash', {
    feature: F, section: 'Orphaned & rejected media cleanup', role: ROLE.ADMIN,
    desc: 'Empty the media trash permanently',
    proc: [
      'Run request "DELETE /api/admin/storage/trash" from the Postman collection folder "Admin > Orphaned & rejected media cleanup"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of deleted files and the freed bytes',
      'The trash list is empty afterwards',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Upload limits & infrastructure configuration
  E('admin-storage-settings-get', 'GET', '/api/admin/storage/settings', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'Read the upload limits and infrastructure settings',
    proc: [
      'Run request "GET /api/admin/storage/settings" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the maximum video and image size, the allowed formats and the quota per member',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-settings-update', 'PUT', '/api/admin/storage/settings', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'Update the upload limits and infrastructure settings',
    proc: [
      'Run request "PUT /api/admin/storage/settings" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
      'Body: the full settings payload as shown in the request',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated settings',
      'The new limits are enforced by the next upload',
    ],
    pre: PRE_ADMIN,
    body: {
      maxVideoMb: 50,
      maxImageMb: 5,
      videoFormats: ['mp4', 'webm'],
      imageFormats: ['jpg', 'jpeg', 'png'],
      demoMaxSeconds: 30,
      memberQuotaMb: 200,
      uploadsPerDay: 5,
      rejectedRetentionDays: 14,
      orphanGraceHours: 24,
      trashRetentionDays: 30,
      restoreGraceDays: 7,
      autoCleanupEnabled: true,
    },
    expect: [200],
  }),
  E('admin-storage-settings-update-invalid-format', 'PUT', '/api/admin/storage/settings', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'Updating the storage settings is rejected when a required field is missing',
    proc: [
      'Run request "PUT /api/admin/storage/settings" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
      'Body: maxVideoMb removed from the payload',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that maxVideoMb is required',
      'The stored settings are unchanged',
    ],
    pre: PRE_ADMIN,
    body: {
      maxImageMb: 5,
      videoFormats: ['mp4'],
      imageFormats: ['png'],
      demoMaxSeconds: 30,
      memberQuotaMb: 200,
      uploadsPerDay: 5,
      rejectedRetentionDays: 14,
      orphanGraceHours: 24,
      trashRetentionDays: 30,
      restoreGraceDays: 7,
      autoCleanupEnabled: true,
    },
    expect: [400],
  }),
  E('admin-storage-optimization', 'GET', '/api/admin/storage/optimization', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'Read the media optimization settings (image and video transformations)',
    proc: [
      'Run request "GET /api/admin/storage/optimization" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the enabled flag, the max widths and the applied transformations',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-folders', 'GET', '/api/admin/storage/folders', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'List the media folders of the storage provider',
    proc: [
      'Run request "GET /api/admin/storage/folders" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists the folders with their labels and file counts',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-storage-folders-setup', 'POST', '/api/admin/storage/folders/setup', {
    feature: F, section: 'Upload limits & infrastructure configuration', role: ROLE.ADMIN,
    desc: 'Create the folder structure expected by the application in the media provider',
    proc: [
      'Run request "POST /api/admin/storage/folders/setup" from the Postman collection folder "Admin > Upload limits & infrastructure configuration"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the folder setup result with the created and the already existing folders',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Maintenance schedule management
  E('admin-maintenance-schedules-list', 'GET', '/api/admin/maintenance-schedules', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.ADMIN,
    desc: 'List the maintenance schedules of the system',
    proc: [
      'Run request "GET /api/admin/maintenance-schedules" from the Postman collection folder "Admin > Maintenance schedule management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged list of schedules with title, start and end time and affected areas',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-maintenance-schedule-detail', 'GET', '/api/admin/maintenance-schedules/{id}', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.ADMIN,
    desc: 'Open the detail of a maintenance schedule',
    proc: [
      'Run request "GET /api/admin/maintenance-schedules/{id}" from the Postman collection folder "Admin > Maintenance schedule management"',
      'Path variable: id = the id of the schedule',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the schedule details and the affected areas',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-maintenance-locks-list', 'GET', '/api/admin/maintenance-schedules/locks', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.ADMIN,
    desc: 'List the area locks currently applied by a maintenance window',
    proc: [
      'Run request "GET /api/admin/maintenance-schedules/locks" from the Postman collection folder "Admin > Maintenance schedule management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body lists the locked areas with their reason',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-maintenance-lock-update', 'PATCH', '/api/admin/maintenance-schedules/locks', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.ADMIN,
    desc: 'Lock or unlock an area of the application',
    proc: [
      'Run request "PATCH /api/admin/maintenance-schedules/locks" from the Postman collection folder "Admin > Maintenance schedule management"',
      'Body: area, locked and reason',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the updated lock state of the area',
      'The locked area is rejected by the affected endpoints while the lock is active',
    ],
    pre: PRE_ADMIN,
    body: {
      area: 'MEMBER_APP_ACCESS',
      locked: 'true',
      reason: 'Scheduled database migration',
    },
    expect: [200],
  }),
  E('admin-maintenance-service-status', 'GET', '/api/admin/maintenance-schedules/service-status', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.ADMIN,
    desc: 'Read the service status flags used by the maintenance filter',
    proc: [
      'Run request "GET /api/admin/maintenance-schedules/service-status" from the Postman collection folder "Admin > Maintenance schedule management"',
      'Query param: serviceKey = "MEMBER_APP_ACCESS"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the availability flag of the requested service area',
    ],
    pre: PRE_ADMIN,
    query: { serviceKey: 'MEMBER_APP_ACCESS' },
    expect: [200],
  }),

  // ------------------------------------------- Create maintenance schedule
  E('admin-maintenance-schedule-create', 'POST', '/api/admin/maintenance-schedules', {
    feature: F, section: 'Create maintenance schedule', role: ROLE.ADMIN,
    desc: 'Create a maintenance schedule that locks the selected areas for a time window',
    proc: [
      'Run request "POST /api/admin/maintenance-schedules" from the Postman collection folder "Admin > Create maintenance schedule"',
      'Body: title, message, startsAt, endsAt, affectedAreas[], notifyMembers and reminderHours',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created schedule with its id and the affected areas',
      'The members receive the maintenance notification when notifyMembers is true',
    ],
    pre: PRE_ADMIN,
    body: {
      title: 'Database upgrade',
      message: 'The member app will be unavailable during the upgrade window.',
      startsAt: '2026-12-01T02:00:00',
      endsAt: '2026-12-01T04:00:00',
      affectedAreas: ['MEMBER_APP_ACCESS'],
      notifyMembers: true,
      reminderHours: 24,
    },
    expect: [200, 201],
  }),
  E('admin-maintenance-schedule-create-invalid-window', 'POST', '/api/admin/maintenance-schedules', {
    feature: F, section: 'Create maintenance schedule', role: ROLE.ADMIN,
    desc: 'Creating a maintenance schedule is rejected when the end time precedes the start time',
    proc: [
      'Run request "POST /api/admin/maintenance-schedules" from the Postman collection folder "Admin > Create maintenance schedule"',
      'Body: startsAt is later than endsAt',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that the end time must be after the start time',
      'No schedule is created',
    ],
    pre: PRE_ADMIN,
    body: {
      title: 'Invalid maintenance window',
      message: 'The end time is before the start time.',
      startsAt: '2026-12-01T04:00:00',
      endsAt: '2026-12-01T02:00:00',
      affectedAreas: ['MEMBER_APP_ACCESS'],
      notifyMembers: true,
      reminderHours: 24,
    },
    expect: [400],
  }),
  E('public-maintenance-service-status', 'GET', '/api/public/maintenance/service-status', {
    feature: F, section: 'Maintenance schedule management', role: ROLE.NONE,
    desc: 'Read the public service status shown to the members when the app is locked',
    proc: [
      'Run request "GET /api/public/maintenance/service-status" from the Postman collection folder "Admin > Maintenance schedule management"',
      'Query param: serviceKey = "MEMBER_APP_ACCESS"',
      'Send it without an Authorization header',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the availability state and, when locked, the reason and the end time',
    ],
    pre: [
      '1. CalisHealth server is running and reachable at {{baseUrl}}',
      '2. The request is sent without an Authorization header (the endpoint is public)',
    ],
    query: { serviceKey: 'MEMBER_APP_ACCESS' },
    expect: [200],
  }),

  // ------------------------------------------- Feedback & complaints management
  E('admin-feedback-list', 'GET', '/api/admin/feedback', {
    feature: F, section: 'Feedback & complaints management', role: ROLE.ADMIN,
    desc: 'List the feedback and complaints submitted by the members',
    proc: [
      'Run request "GET /api/admin/feedback" from the Postman collection folder "Admin > Feedback & complaints management"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the feedback list with title, category, status and the submission date',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),

  // ------------------------------------------- Feedback & complaint details
  E('admin-feedback-detail', 'GET', '/api/admin/feedback/{id}', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.ADMIN,
    desc: 'Open the detail of a feedback or complaint',
    proc: [
      'Run request "GET /api/admin/feedback/{id}" from the Postman collection folder "Admin > Feedback & complaint details"',
      'Path variable: id = the id of the feedback',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the title, content, category and the member who submitted it',
      'Response body contains the status and the resolution note when it was handled',
    ],
    pre: PRE_ADMIN,
    expect: [200],
  }),
  E('admin-feedback-handle', 'PATCH', '/api/admin/feedback/{id}/handle', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.ADMIN,
    desc: 'Handle a feedback or complaint by approving, escalating, rejecting or resolving it',
    proc: [
      'Run request "PATCH /api/admin/feedback/{id}/handle" from the Postman collection folder "Admin > Feedback & complaint details"',
      'Body: action and resolutionNote',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body shows the updated status of the feedback',
      'The resolution note is stored and shown in the detail view',
    ],
    pre: PRE_ADMIN,
    body: {
      action: 'RESOLVE',
      resolutionNote: 'The demo video has been corrected and re-uploaded.',
    },
    expect: [200],    pathValues: { id: '{{feedbackId}}' },
}),
  E('admin-feedback-handle-invalid-action', 'PATCH', '/api/admin/feedback/{id}/handle', {
    feature: F, section: 'Feedback & complaint details', role: ROLE.ADMIN,
    desc: 'Handling a feedback is rejected when the action is not one of the allowed values',
    proc: [
      'Run request "PATCH /api/admin/feedback/{id}/handle" from the Postman collection folder "Admin > Feedback & complaint details"',
      'Body: action = "DELETE"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body lists the allowed actions',
      'The feedback status is unchanged',
    ],
    pre: PRE_ADMIN,
    body: {
      action: 'DELETE',
      resolutionNote: 'Trying to delete through the handle endpoint.',
    },
    expect: [400],    pathValues: { id: '{{feedbackId}}' },
}),
  E('admin-feedback-member-forbidden', 'GET', '/api/admin/feedback', {
    feature: F, section: 'Feedback & complaints management', role: ROLE.MEMBER,
    desc: 'A member cannot open the admin feedback list',
    proc: [
      'Run request "GET /api/admin/feedback" from the Postman collection folder "Admin > Feedback & complaints management"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'No feedback of other members is disclosed',
    ],
    pre: [...PRE_AUTH],
    expect: [403],
  }),
];
