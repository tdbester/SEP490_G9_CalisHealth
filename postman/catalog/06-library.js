/**
 * Feature: Exercise & Workout Library
 * Covers the /api/v1/library/** family (exercises, workouts, personal
 * exercises, member exercises, favourites, muscle groups, exercise tree) and
 * the legacy /api/library/** endpoints plus the public library.
 */
const { E, ROLE, PRE_AUTH, PRE_GUEST, PRE_CONTENT } = require('./_helpers');

const F = 'Exercise & Workout Library';

module.exports = [
  // ------------------------------------------- Exercise & Workout library
  E('library-overview', 'GET', '/api/v1/library/overview', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'Load the library overview screen with the counts of exercises and workouts',
    proc: [
      'Run request "GET /api/v1/library/overview" from the Postman collection folder "Library > Exercise & Workout library"',
      'Send it without an Authorization header (the endpoint is public)',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the total counts of system exercises, system workouts and muscle groups',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('library-exercises-list', 'GET', '/api/v1/library/exercises', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'List the system exercises of the library with paging',
    proc: [
      'Run request "GET /api/v1/library/exercises" from the Postman collection folder "Library > Exercise & Workout library"',
      'Query params: page = 0, size = 12',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the items array with the exercise code, name, muscle group and level',
      'Response body contains the paging metadata (page, size, total elements)',
    ],
    pre: [...PRE_GUEST],
    query: { page: '0', size: '12' },
    expect: [200],
  }),
  E('library-muscle-groups', 'GET', '/api/v1/library/muscle-groups', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'List the muscle groups with their exercise statistics',
    proc: [
      'Run request "GET /api/v1/library/muscle-groups" from the Postman collection folder "Library > Exercise & Workout library"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of muscle groups with the exercise count of each group',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),

  // ------------------------------------------- Exercise for health / skill list
  E('public-library-exercises', 'GET', '/api/public/library/exercises', {
    feature: F, section: 'Exercise for health / skill list', role: ROLE.NONE,
    desc: 'Browse the public exercise catalogue filtered by training goal',
    proc: [
      'Run request "GET /api/public/library/exercises" from the Postman collection folder "Library > Exercise for health / skill list"',
      'Send it without an Authorization header',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of exercises with their name, type (HEALTH / SKILL) and level',
      'The catalogue is readable by guests',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('public-library-exercise-detail', 'GET', '/api/public/library/exercises/{code}', {
    feature: F, section: 'Exercise for health / skill list', role: ROLE.NONE,
    desc: 'Open the public detail of a single exercise',
    proc: [
      'Run request "GET /api/public/library/exercises/{code}" from the Postman collection folder "Library > Exercise for health / skill list"',
      'Path variable: code = the exercise code',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise description, target muscle, level and guide',
      'The guide steps are returned in the configured order',
    ],
    pre: [...PRE_GUEST],
    expect: [200],    pathValues: { code: 'PULL_UP' },
}),
  E('public-library-exercise-not-found', 'GET', '/api/public/library/exercises/{code}', {
    feature: F, section: 'Exercise for health / skill list', role: ROLE.NONE,
    desc: 'Opening an unknown exercise code returns a not-found error',
    proc: [
      'Run request "GET /api/public/library/exercises/{code}" from the Postman collection folder "Library > Exercise for health / skill list"',
      'Path variable: code = "NO_SUCH_EXERCISE"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the exercise was not found',
    ],
    pre: [...PRE_GUEST],
    expect: [404],    pathValues: { code: 'NO_SUCH_EXERCISE' },
}),

  // ------------------------------------------- System exercise detail page
  E('library-exercise-detail', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'System exercise detail page', role: ROLE.MEMBER,
    desc: 'Open the system exercise detail page of the library',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Library > System exercise detail page"',
      'Path variable: id = the numeric id of a system exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise name, description, level, muscle group and guide steps',
      'Response body contains the demo video URL and the anatomy image URL',
      'Response body contains the unlock state for the logged-in member',
    ],
    pre: [...PRE_AUTH, '3. A system exercise exists'],
    expect: [200],    pathValues: { id: '{{systemExerciseId}}' },
}),
  E('library-exercise-detail-guest-forbidden', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'System exercise detail page', role: ROLE.NONE,
    desc: 'The system exercise detail requires an authenticated member',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Library > System exercise detail page"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'The exercise detail payload is not returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],    pathValues: { id: '{{systemExerciseId}}' },
}),

  // ------------------------------------------- Calisthenics exercise tree
  E('library-exercise-tree', 'GET', '/api/v1/library/exercise-tree', {
    feature: F, section: 'Calisthenics exercise tree', role: ROLE.MEMBER,
    desc: 'Load the calisthenics exercise tree that groups exercises by movement pattern',
    proc: [
      'Run request "GET /api/v1/library/exercise-tree" from the Postman collection folder "Library > Calisthenics exercise tree"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the root node with the child nodes of the movement tree',
      'Each node carries the exercise code and the unlock state of the member',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('library-exercise-tree-unauthenticated', 'GET', '/api/v1/library/exercise-tree', {
    feature: F, section: 'Calisthenics exercise tree', role: ROLE.NONE,
    desc: 'The exercise tree rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/v1/library/exercise-tree" from the Postman collection folder "Library > Calisthenics exercise tree"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No tree payload is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ------------------------------------------- Workout for health / skill list
  E('public-library-workouts', 'GET', '/api/public/library/workouts', {
    feature: F, section: 'Workout for health / skill list', role: ROLE.NONE,
    desc: 'Browse the public workout catalogue',
    proc: [
      'Run request "GET /api/public/library/workouts" from the Postman collection folder "Library > Workout for health / skill list"',
      'Send it without an Authorization header',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of workouts with their name, type (HEALTH / SKILL / FLEX) and level',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('library-system-workouts', 'GET', '/api/v1/library/system-workouts', {
    feature: F, section: 'Workout for health / skill list', role: ROLE.NONE,
    desc: 'List the system workouts of the library, optionally filtered by type',
    proc: [
      'Run request "GET /api/v1/library/system-workouts" from the Postman collection folder "Library > Workout for health / skill list"',
      'Query param: type = "HEALTH"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout items with their code, name and level',
      'Only workouts of the requested type are returned when type is supplied',
    ],
    pre: [...PRE_GUEST],
    query: { type: 'HEALTH' },
    expect: [200],
  }),
  E('library-system-workouts-invalid-type', 'GET', '/api/v1/library/system-workouts', {
    feature: F, section: 'Workout for health / skill list', role: ROLE.NONE,
    desc: 'The system workout list rejects an unsupported type filter',
    proc: [
      'Run request "GET /api/v1/library/system-workouts" from the Postman collection folder "Library > Workout for health / skill list"',
      'Query param: type = "INVALID_TYPE"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the workout type is not valid',
    ],
    pre: [...PRE_GUEST],
    query: { type: 'INVALID_TYPE' },
    expect: [400],
  }),

  // ------------------------------------------- System workout detail page
  E('library-system-workout-detail', 'GET', '/api/v1/library/system-workouts/{id}', {
    feature: F, section: 'System workout detail page', role: ROLE.MEMBER,
    desc: 'Open the system workout detail page with its ordered exercise list',
    proc: [
      'Run request "GET /api/v1/library/system-workouts/{id}" from the Postman collection folder "Library > System workout detail page"',
      'Path variable: id = the numeric id of a system workout',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout name, description, level and type',
      'Response body contains the exercise items with their sets, reps or duration and rest time',
    ],
    pre: [...PRE_AUTH, '3. A system workout exists'],
    expect: [200],    pathValues: { id: '{{systemWorkoutId}}' },
}),
  E('library-system-workout-detail-not-found', 'GET', '/api/v1/library/system-workouts/{id}', {
    feature: F, section: 'System workout detail page', role: ROLE.MEMBER,
    desc: 'Opening a non-existent system workout returns a not-found error',
    proc: [
      'Run request "GET /api/v1/library/system-workouts/{id}" from the Postman collection folder "Library > System workout detail page"',
      'Path variable: id = 999999',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the workout was not found',
    ],
    pre: [...PRE_AUTH],
    expect: [404],    pathValues: { id: '999999' },
}),

  // ------------------------------------------- Member-provided exercise list
  E('library-member-exercises', 'GET', '/api/v1/library/member-exercises', {
    feature: F, section: 'Member-provided exercise list', role: ROLE.MEMBER,
    desc: 'List the member-provided exercises of the logged-in member',
    proc: [
      'Run request "GET /api/v1/library/member-exercises" from the Postman collection folder "Library > Member-provided exercise list"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the items array with the exercise code, name, level and moderation status',
      'Only the submissions of the logged-in member are returned',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('legacy-member-exercises', 'GET', '/api/library/member-exercises', {
    feature: F, section: 'Member-provided exercise list', role: ROLE.MEMBER,
    desc: 'Legacy member exercise listing used by the older library screens',
    proc: [
      'Run request "GET /api/library/member-exercises" from the Postman collection folder "Library > Member-provided exercise list"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged list of the member exercise submissions',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('legacy-member-exercises-guest-forbidden', 'GET', '/api/library/member-exercises', {
    feature: F, section: 'Member-provided exercise list', role: ROLE.NONE,
    desc: 'A guest cannot list the member exercises of other members',
    proc: [
      'Run request "GET /api/library/member-exercises" from the Postman collection folder "Library > Member-provided exercise list"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No member exercise data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ------------------------------------------- Member-provided exercise detail
  E('library-member-exercise-detail', 'GET', '/api/v1/library/member-exercises/{id}', {
    feature: F, section: 'Member-provided exercise detail', role: ROLE.MEMBER,
    desc: 'Open the detail of a member-provided exercise',
    proc: [
      'Run request "GET /api/v1/library/member-exercises/{id}" from the Postman collection folder "Library > Member-provided exercise detail"',
      'Path variable: id = the numeric id of one of the member submissions',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise title, description, guide steps, target muscle and the demo video URL',
      'Response body contains the moderation status and, when rejected, the rejection reason',
    ],
    pre: [...PRE_AUTH, '3. The member has at least one submitted exercise'],
    expect: [200],    pathValues: { id: '{{memberExerciseId}}' },
}),
  E('library-member-exercise-detail-other-member', 'GET', '/api/v1/library/member-exercises/{id}', {
    feature: F, section: 'Member-provided exercise detail', role: ROLE.MEMBER,
    desc: 'A member cannot open an exercise submitted by another member',
    proc: [
      'Run request "GET /api/v1/library/member-exercises/{id}" from the Postman collection folder "Library > Member-provided exercise detail"',
      'Path variable: id = a submission owned by a different member',
    ],
    exp: [
      'HTTP 403 Forbidden (or 404 Not Found) is returned',
      'The response does not disclose the other member\'s submission',
    ],
    pre: [...PRE_AUTH, '3. A submission owned by another member exists'],
    expect: [403, 404],    pathValues: { id: '{{otherMemberExerciseId}}' },
}),

  // ------------------------------------------- Create personal exercise
  E('personal-exercise-create', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Create personal exercise', role: ROLE.MEMBER,
    desc: 'Create a personal exercise in the library',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Library > Create personal exercise"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: form-data — part "data" = the exercise JSON, part "videoFile" = the demo video',
    ],
    exp: [
      'HTTP 201 Created is returned',
      'Response body contains the created exercise with its id and the status "PENDING"',
      'The exercise appears in the personal exercise list of the member',
    ],
    pre: [
      ...PRE_AUTH,
      '3. A local video file within the configured size limit is available',
    ],
    form: {
      data: JSON.stringify({
        title: 'My handstand hold',
        description: 'A personal handstand hold progression for the shoulders and core.',
        level: 'INTERMEDIATE',
        guideSteps: ['Kick up against a wall', 'Hold the position for 30 seconds'],
        targetMuscle: 'SHOULDERS',
        defaultSets: 3,
        defaultReps: 10,
      }),
      videoFile: '@C:/calishealth-testdata/handstand.mp4',
    },
    expect: [201],
  }),
  E('personal-exercise-create-blank-title', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Create personal exercise', role: ROLE.MEMBER,
    desc: 'Creating a personal exercise is rejected when the title is blank',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Library > Create personal exercise"',
      'Body: part "data" has an empty "title"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the exercise title is required',
      'No exercise is created',
    ],
    pre: [...PRE_AUTH],
    expect: [400],
  }),
  E('personal-exercise-create-empty-guide', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Create personal exercise', role: ROLE.MEMBER,
    desc: 'Creating a personal exercise is rejected when no guide step is supplied',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Library > Create personal exercise"',
      'Body: part "data" has guideSteps = []',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that at least one instruction step is required',
      'No exercise is created',
    ],
    pre: [...PRE_AUTH],
    expect: [400],
  }),

  // ------------------------------------------- Personal exercise list
  E('personal-exercise-list', 'GET', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Personal exercise list', role: ROLE.MEMBER,
    desc: 'List the personal exercise submissions of the member with the moderation status filter',
    proc: [
      'Run request "GET /api/v1/library/personal-exercises" from the Postman collection folder "Library > Personal exercise list"',
      'Query params: status = "PENDING", page = 0, size = 6',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the items array with the submission and its status',
      'Only submissions matching the status filter are returned',
    ],
    pre: [...PRE_AUTH],
    query: { status: 'PENDING', page: '0', size: '6' },
    expect: [200],
  }),
  E('personal-exercise-list-counts', 'GET', '/api/v1/library/personal-exercises/counts', {
    feature: F, section: 'Personal exercise list', role: ROLE.MEMBER,
    desc: 'Read the submission counters shown in the personal exercise tabs',
    proc: [
      'Run request "GET /api/v1/library/personal-exercises/counts" from the Postman collection folder "Library > Personal exercise list"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of submissions per moderation status',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('personal-exercise-list-search', 'GET', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Personal exercise list', role: ROLE.MEMBER,
    desc: 'Search and filter the personal exercise submissions',
    proc: [
      'Run request "GET /api/v1/library/personal-exercises" from the Postman collection folder "Library > Personal exercise list"',
      'Query params: search = "handstand", level = "INTERMEDIATE"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Only submissions whose title matches the search term and level are returned',
    ],
    pre: [...PRE_AUTH],
    query: { search: 'handstand', level: 'INTERMEDIATE' },
    expect: [200],
  }),

  // ------------------------------------------- Update personal exercise
  E('personal-exercise-update', 'PUT', '/api/v1/library/personal-exercises/{id}', {
    feature: F, section: 'Update personal exercise', role: ROLE.MEMBER,
    desc: 'Update a personal exercise that was rejected by the moderation',
    proc: [
      'Run request "PUT /api/v1/library/personal-exercises/{id}" from the Postman collection folder "Library > Update personal exercise"',
      'Path variable: id = the id of a rejected personal exercise',
      'Body: form-data — part "data" = the corrected exercise JSON, optionally part "videoFile"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the updated exercise with the status back to "PENDING"',
      'The exercise is queued for a new moderation round',
    ],
    pre: [...PRE_AUTH, '3. A rejected personal exercise of the member exists'],
    form: {
      data: JSON.stringify({
        title: 'My handstand hold (corrected)',
        description: 'A personal handstand hold progression for the shoulders and core.',
        level: 'INTERMEDIATE',
        guideSteps: ['Kick up against a wall', 'Hold the position for 30 seconds'],
        targetMuscle: 'SHOULDERS',
        defaultSets: 3,
        defaultReps: 10,
      }),
      videoFile: '@C:/calishealth-testdata/handstand.mp4',
    },
    expect: [200],    pathValues: { id: '{{rejectedExerciseId}}' },
}),
  E('personal-exercise-delete', 'DELETE', '/api/v1/library/personal-exercises/{id}', {
    feature: F, section: 'Update personal exercise', role: ROLE.MEMBER,
    desc: 'Delete a personal exercise submission of the member',
    proc: [
      'Run request "DELETE /api/v1/library/personal-exercises/{id}" from the Postman collection folder "Library > Update personal exercise"',
      'Path variable: id = the id of one of the member submissions',
    ],
    exp: [
      'HTTP 204 No Content is returned',
      'The exercise no longer appears in the personal exercise list',
      'The uploaded media is released for cleanup',
    ],
    pre: [...PRE_AUTH, '3. A personal exercise of the member exists'],
    expect: [204],    pathValues: { id: '{{memberExerciseId}}' },
}),

  // ------------------------------------------- Custom workout list
  E('library-custom-workouts', 'GET', '/api/v1/library/custom-workouts', {
    feature: F, section: 'Custom workout list', role: ROLE.MEMBER,
    desc: 'Browse the custom workouts shared by the community',
    proc: [
      'Run request "GET /api/v1/library/custom-workouts" from the Postman collection folder "Library > Custom workout list"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged list of community workouts with their name, level and author',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('library-custom-workout-detail', 'GET', '/api/v1/library/custom-workouts/{id}', {
    feature: F, section: 'Custom workout list', role: ROLE.MEMBER,
    desc: 'Open the detail of a community custom workout',
    proc: [
      'Run request "GET /api/v1/library/custom-workouts/{id}" from the Postman collection folder "Library > Custom workout list"',
      'Path variable: id = the numeric id of a community workout',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout name, description and its ordered exercise items',
    ],
    pre: [...PRE_AUTH, '3. A community workout exists'],
    expect: [200],    pathValues: { id: '{{communityWorkoutId}}' },
}),

  // ------------------------------------------- Create personal workout
  E('my-workout-create', 'POST', '/api/v1/library/my-workouts', {
    feature: F, section: 'Create personal workout', role: ROLE.MEMBER,
    desc: 'Create a personal workout in the member library',
    proc: [
      'Run request "POST /api/v1/library/my-workouts" from the Postman collection folder "Library > Create personal workout"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: title, description, level, type, isSharedWithCommunity and items[]',
    ],
    exp: [
      'HTTP 200 OK (or 201 Created) is returned',
      'Response body contains the created workout with its id and the configured exercise items',
      'The workout appears in the my-workouts list',
    ],
    pre: [...PRE_AUTH, '3. The referenced exercise codes exist in the library'],
    body: {
      title: 'My beginner full body',
      description: 'A three day full body routine for beginners.',
      level: 'BEGINNER',
      type: 'HEALTH',
      isSharedWithCommunity: false,
      items: [
        { exerciseCode: 'PUSH_UP', sets: 3, reps: 12, restSeconds: 60 },
        { exerciseCode: 'SQUAT', sets: 3, reps: 15, restSeconds: 60 },
      ],
    },
    expect: [200, 201],
  }),
  E('my-workout-create-invalid-type', 'POST', '/api/v1/library/my-workouts', {
    feature: F, section: 'Create personal workout', role: ROLE.MEMBER,
    desc: 'Creating a personal workout is rejected when the workout type is invalid',
    proc: [
      'Run request "POST /api/v1/library/my-workouts" from the Postman collection folder "Library > Create personal workout"',
      'Body: type = "INVALID_TYPE"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that a valid workout type must be selected',
      'No workout is created',
    ],
    pre: [...PRE_AUTH],
    body: {
      title: 'My beginner full body',
      description: 'A three day full body routine for beginners.',
      level: 'BEGINNER',
      type: 'INVALID_TYPE',
      items: [],
    },
    expect: [400],
  }),

  // ------------------------------------------- My custom workout list
  E('my-workout-list', 'GET', '/api/v1/library/my-workouts', {
    feature: F, section: 'My custom workout list', role: ROLE.MEMBER,
    desc: 'List the personal workouts created by the logged-in member',
    proc: [
      'Run request "GET /api/v1/library/my-workouts" from the Postman collection folder "Library > My custom workout list"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged list of the workouts owned by the member',
      'Only the member\'s own workouts are returned',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('my-workout-detail', 'GET', '/api/v1/library/my-workouts/{id}', {
    feature: F, section: 'My custom workout list', role: ROLE.MEMBER,
    desc: 'Open the detail of one of the personal workouts of the member',
    proc: [
      'Run request "GET /api/v1/library/my-workouts/{id}" from the Postman collection folder "Library > My custom workout list"',
      'Path variable: id = the numeric id of a personal workout',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the workout name, description, type, level and exercise items',
    ],
    pre: [...PRE_AUTH, '3. The member has created at least one personal workout'],
    expect: [200],    pathValues: { id: '{{myWorkoutId}}' },
}),

  // ------------------------------------------- Update my custom workout
  E('my-workout-update', 'PUT', '/api/v1/library/my-workouts/{id}', {
    feature: F, section: 'Update my custom workout', role: ROLE.MEMBER,
    desc: 'Update the name, description and exercise list of a personal workout',
    proc: [
      'Run request "PUT /api/v1/library/my-workouts/{id}" from the Postman collection folder "Library > Update my custom workout"',
      'Path variable: id = the numeric id of a personal workout',
      'Body: title, description, level, type, isSharedWithCommunity and items[]',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated workout values',
      'The change is visible in "GET /api/v1/library/my-workouts/{id}"',
    ],
    pre: [...PRE_AUTH, '3. The member has created at least one personal workout'],
    body: {
      title: 'My beginner full body (updated)',
      description: 'A three day full body routine for beginners.',
      level: 'BEGINNER',
      type: 'HEALTH',
      isSharedWithCommunity: true,
      items: [
        { exerciseCode: 'PUSH_UP', sets: 4, reps: 10, restSeconds: 90 },
        { exerciseCode: 'SQUAT', sets: 3, reps: 15, restSeconds: 60 },
      ],
    },
    expect: [200],    pathValues: { id: '{{myWorkoutId}}' },
}),
  E('my-workout-delete', 'DELETE', '/api/v1/library/my-workouts/{id}', {
    feature: F, section: 'Update my custom workout', role: ROLE.MEMBER,
    desc: 'Delete a personal workout of the member',
    proc: [
      'Run request "DELETE /api/v1/library/my-workouts/{id}" from the Postman collection folder "Library > Update my custom workout"',
      'Path variable: id = the numeric id of a personal workout',
    ],
    exp: [
      'HTTP 204 No Content is returned',
      'The workout no longer appears in the my-workouts list',
    ],
    pre: [...PRE_AUTH, '3. The member has created at least one personal workout'],
    expect: [204],    pathValues: { id: '{{myWorkoutId}}' },
}),
  E('my-workout-update-other-member', 'PUT', '/api/v1/library/my-workouts/{id}', {
    feature: F, section: 'Update my custom workout', role: ROLE.MEMBER,
    desc: 'A member cannot update a personal workout owned by somebody else',
    proc: [
      'Run request "PUT /api/v1/library/my-workouts/{id}" from the Postman collection folder "Library > Update my custom workout"',
      'Path variable: id = a personal workout owned by a different member',
    ],
    exp: [
      'HTTP 403 Forbidden (or 404 Not Found) is returned',
      'The other member\'s workout is left unchanged',
    ],
    pre: [...PRE_AUTH, '3. A personal workout owned by another member exists'],
    expect: [403, 404],    pathValues: { id: '{{otherMemberWorkoutId}}' },
}),

  // ------------------------------------------- Exercise detail
  E('workout-exercises-available', 'GET', '/api/v1/library/workout-exercises/available', {
    feature: F, section: 'Exercise detail', role: ROLE.MEMBER,
    desc: 'List the exercises that can be added to a workout',
    proc: [
      'Run request "GET /api/v1/library/workout-exercises/available" from the Postman collection folder "Library > Exercise detail"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of exercises with the code, name, muscle group and default set/rep configuration',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('legacy-library-exercises', 'GET', '/api/library/exercises', {
    feature: F, section: 'Exercise detail', role: ROLE.NONE,
    desc: 'Legacy exercise listing used by the older library screens',
    proc: [
      'Run request "GET /api/library/exercises" from the Postman collection folder "Library > Exercise detail"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the paged exercise list used by the legacy screens',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('legacy-library-exercise-detail', 'GET', '/api/library/exercises/{id}', {
    feature: F, section: 'Exercise detail', role: ROLE.MEMBER,
    desc: 'Legacy exercise detail endpoint',
    proc: [
      'Run request "GET /api/library/exercises/{id}" from the Postman collection folder "Library > Exercise detail"',
      'Path variable: id = the numeric id of a system exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the exercise summary used by the legacy screens',
    ],
    pre: [...PRE_AUTH, '3. A system exercise exists'],
    expect: [200],    pathValues: { id: '{{systemExerciseId}}' },
}),
  E('legacy-library-exercise-detail-guest-forbidden', 'GET', '/api/library/exercises/{id}', {
    feature: F, section: 'Exercise detail', role: ROLE.NONE,
    desc: 'A guest cannot read the detail of a system exercise through the legacy endpoint',
    proc: [
      'Run request "GET /api/library/exercises/{id}" from the Postman collection folder "Library > Exercise detail"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'The exercise detail payload is not returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],    pathValues: { id: '{{systemExerciseId}}' },
}),

  // ------------------------------------------- Favorite workout and exercise
  E('favorites-list', 'GET', '/api/v1/library/favorites', {
    feature: F, section: 'Favorite workout and exercise', role: ROLE.MEMBER,
    desc: 'List the exercises and workouts the member marked as favourite',
    proc: [
      'Run request "GET /api/v1/library/favorites" from the Postman collection folder "Library > Favorite workout and exercise"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of favourite items with the item type, code, name and image',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('favorites-toggle-on', 'POST', '/api/v1/library/favorites/{itemType}/{itemId}/toggle', {
    feature: F, section: 'Favorite workout and exercise', role: ROLE.MEMBER,
    desc: 'Mark an exercise as favourite',
    proc: [
      'Run request "POST /api/v1/library/favorites/{itemType}/{itemId}/toggle" from the Postman collection folder "Library > Favorite workout and exercise"',
      'Path variables: itemType = "SYSTEM_EXERCISE", itemId = the exercise code',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reports the new favourite state as true',
      'The exercise appears in the favourites list',
    ],
    pre: [...PRE_AUTH, '3. The exercise is not yet marked as favourite'],
    expect: [200],    pathValues: { itemType: 'SYSTEM_EXERCISE', itemId: 'PULL_UP' },
}),
  E('favorites-toggle-off', 'POST', '/api/v1/library/favorites/{itemType}/{itemId}/toggle', {
    feature: F, section: 'Favorite workout and exercise', role: ROLE.MEMBER,
    desc: 'Remove an exercise from the favourites list',
    proc: [
      'Mark an exercise as favourite first',
      'Run request "POST /api/v1/library/favorites/{itemType}/{itemId}/toggle" again for the same item',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reports the new favourite state as false',
      'The exercise no longer appears in the favourites list',
    ],
    pre: [...PRE_AUTH, '3. The exercise is currently marked as favourite'],
    expect: [200],    pathValues: { itemType: 'SYSTEM_EXERCISE', itemId: 'PULL_UP' },
}),
  E('favorites-toggle-invalid-type', 'POST', '/api/v1/library/favorites/{itemType}/{itemId}/toggle', {
    feature: F, section: 'Favorite workout and exercise', role: ROLE.MEMBER,
    desc: 'Favourite toggle rejects an unsupported item type',
    proc: [
      'Run request "POST /api/v1/library/favorites/{itemType}/{itemId}/toggle" from the Postman collection folder "Library > Favorite workout and exercise"',
      'Path variables: itemType = "INVALID_TYPE", itemId = "PULL_UP"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the item type is not supported',
      'No favourite record is created',
    ],
    pre: [...PRE_AUTH],
    expect: [400],    pathValues: { itemType: 'INVALID_TYPE', itemId: 'PULL_UP' },
}),

  // ------------------------------------------- Library summary and counts
  E('legacy-library-summary', 'GET', '/api/library/summary', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'Legacy library summary used by the home screen counters',
    proc: [
      'Run request "GET /api/library/summary" from the Postman collection folder "Library > Exercise & Workout library"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the summary counters of the library',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('legacy-library-counts', 'GET', '/api/library/counts', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'Legacy library counters used by the filter chips',
    proc: [
      'Run request "GET /api/library/counts" from the Postman collection folder "Library > Exercise & Workout library"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the number of exercises per filter value',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
  E('legacy-library-levels', 'GET', '/api/library/levels', {
    feature: F, section: 'Exercise & Workout library', role: ROLE.NONE,
    desc: 'Legacy fitness level options used by the library filters',
    proc: [
      'Run request "GET /api/library/levels" from the Postman collection folder "Library > Exercise & Workout library"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of fitness levels configured by the content manager',
    ],
    pre: [...PRE_GUEST],
    expect: [200],
  }),
];
