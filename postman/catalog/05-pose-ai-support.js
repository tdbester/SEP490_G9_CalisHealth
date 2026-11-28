/**
 * Feature: Pose Analysis & AI Support
 * Covers MemberAiSupportController (/api/member/ai-support/**),
 * MemberFormCorrectionController (/api/member/form-correction) and the media
 * endpoints that serve the video demo / anatomy image assets.
 */
const { E, ROLE, PRE_AUTH } = require('./_helpers');

const F = 'Pose Analysis & AI Support';

module.exports = [
  // ------------------------------------------- Video demo
  E('media-demo-video', 'GET', '/media/exercise-demos/{file}', {
    feature: F, section: 'Video demo', role: ROLE.NONE,
    desc: 'Play the demo video of a system exercise',
    proc: [
      'Run request "GET /media/exercise-demos/{file}" from the Postman collection folder "Pose Analysis > Video demo"',
      'Path variable: file = the demo file name taken from the exercise detail response',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Content-Type header matches the media type of the file (for example video/mp4)',
      'The response body carries the video content and supports range requests for seeking',
    ],
    pre: [
      '1. CalisHealth server is running and reachable at {{baseUrl}}',
      '2. A system exercise with a demo video exists',
      '3. The request is sent without an Authorization header (the media path is public)',
    ],
    expect: [200],
    tests: ['Response "Content-Type" header contains "video/"'],    pathValues: { file: '{{demoVideoFileName}}' },
}),
  E('media-demo-video-not-found', 'GET', '/media/exercise-demos/{file}', {
    feature: F, section: 'Video demo', role: ROLE.NONE,
    desc: 'Requesting a missing demo video returns a not-found error',
    proc: [
      'Run request "GET /media/exercise-demos/{file}" from the Postman collection folder "Pose Analysis > Video demo"',
      'Path variable: file = "no-such-demo.mp4"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'The response body does not contain any video content',
    ],
    pre: [...PRE_AUTH, '3. The request is sent without an Authorization header'],
    expect: [404],    pathValues: { file: 'no-such-demo.mp4' },
}),

  // ------------------------------------------- Camera frame overlay
  E('media-anatomy-image', 'GET', '/media/exercise-anatomy/{file}', {
    feature: F, section: 'Camera frame overlay', role: ROLE.NONE,
    desc: 'Load the anatomy image used as the camera frame overlay reference',
    proc: [
      'Run request "GET /media/exercise-anatomy/{file}" from the Postman collection folder "Pose Analysis > Camera frame overlay"',
      'Path variable: file = the anatomy image file name from the exercise detail response',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Content-Type header is an image type such as image/png or image/jpeg',
      'The image can be rendered by the overlay component of the camera screen',
    ],
    pre: [
      '1. CalisHealth server is running and reachable at {{baseUrl}}',
      '2. A system exercise with an anatomy image exists',
      '3. The request is sent without an Authorization header (the media path is public)',
    ],
    expect: [200],
    tests: ['Response "Content-Type" header contains "image/"'],    pathValues: { file: '{{anatomyImageFileName}}' },
}),
  E('media-anatomy-image-not-found', 'GET', '/media/exercise-anatomy/{file}', {
    feature: F, section: 'Camera frame overlay', role: ROLE.NONE,
    desc: 'Requesting a missing anatomy image returns a not-found error',
    proc: [
      'Run request "GET /media/exercise-anatomy/{file}" from the Postman collection folder "Pose Analysis > Camera frame overlay"',
      'Path variable: file = "no-such-image.png"',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'The response body does not contain any image content',
    ],
    pre: [...PRE_AUTH, '3. The request is sent without an Authorization header'],
    expect: [404],    pathValues: { file: 'no-such-image.png' },
}),

  // ------------------------------------------- Upload Video / Browse File
  E('personal-exercise-create-with-video', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Upload Video / Browse File', role: ROLE.MEMBER,
    desc: 'Submit a member-provided exercise together with a demo video file',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Pose Analysis > Upload Video / Browse File"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: form-data — part "data" = the JSON exercise, part "videoFile" = the local video file',
    ],
    exp: [
      'HTTP 201 Created is returned',
      'Response body contains the created exercise with its id and status "PENDING"',
      'The submission is queued for content moderation',
    ],
    pre: [
      ...PRE_AUTH,
      '3. A local video file (mp4/webm) within the configured size limit is available',
    ],
    form: {
      data: JSON.stringify({
        title: 'My custom push-up',
        description: 'A personal push-up variation for the chest and triceps.',
        level: 'BEGINNER',
        guideSteps: ['Place the hands shoulder width apart', 'Lower the chest to the floor', 'Push back up'],
        targetMuscle: 'CHEST',
        defaultSets: 3,
        defaultReps: 12,
      }),
      videoFile: '@C:/calishealth-testdata/push-up.mp4',
    },
    expect: [201],
  }),
  E('personal-exercise-create-missing-video', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Upload Video / Browse File', role: ROLE.MEMBER,
    desc: 'Submitting a member exercise without the required video file is rejected',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Pose Analysis > Upload Video / Browse File"',
      'Remove the "videoFile" part so only "data" is sent',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that the video file is required',
      'No exercise submission is created',
    ],
    pre: [...PRE_AUTH],
    expect: [400],
  }),
  E('personal-exercise-create-oversized-video', 'POST', '/api/v1/library/personal-exercises', {
    feature: F, section: 'Upload Video / Browse File', role: ROLE.MEMBER,
    desc: 'Submitting a video larger than the configured limit is rejected',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises" from the Postman collection folder "Pose Analysis > Upload Video / Browse File"',
      'Body: part "videoFile" points at a file larger than the maximum video size configured by the admin',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states that the file exceeds the allowed size',
      'The oversized file is not stored',
    ],
    pre: [
      ...PRE_AUTH,
      '3. A video file larger than the admin-configured limit is available locally',
    ],
    form: {
      data: JSON.stringify({
        title: 'My custom push-up',
        description: 'A personal push-up variation for the chest and triceps.',
        level: 'BEGINNER',
        guideSteps: ['Place the hands shoulder width apart', 'Lower the chest to the floor', 'Push back up'],
        targetMuscle: 'CHEST',
        defaultSets: 3,
        defaultReps: 12,
      }),
      videoFile: '@C:/calishealth-testdata/too-large.mp4',
    },
    expect: [400],
  }),
  E('personal-exercise-text-check', 'POST', '/api/v1/library/personal-exercises/text-check', {
    feature: F, section: 'Upload Video / Browse File', role: ROLE.MEMBER,
    desc: 'Check the title, description and guide steps of a member exercise against the moderation rules',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises/text-check" from the Postman collection folder "Pose Analysis > Upload Video / Browse File"',
      'Body: title, description, guideSteps[] and targetMuscle',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reports whether the text is acceptable and lists the flagged words when it is not',
    ],
    pre: [...PRE_AUTH],
    body: {
      title: 'My custom push-up',
      description: 'A personal push-up variation for the chest and triceps.',
      guideSteps: ['Place the hands shoulder width apart', 'Lower the chest to the floor'],
      targetMuscle: 'CHEST',
    },
    expect: [200],
  }),
  E('personal-exercise-text-check-flagged', 'POST', '/api/v1/library/personal-exercises/text-check', {
    feature: F, section: 'Upload Video / Browse File', role: ROLE.MEMBER,
    desc: 'The text check reports the flagged words of a submission that breaks the content policy',
    proc: [
      'Run request "POST /api/v1/library/personal-exercises/text-check" from the Postman collection folder "Pose Analysis > Upload Video / Browse File"',
      'Body: title contains a word that the moderation service flags',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reports the submission as not acceptable and names the flagged words',
    ],
    pre: [...PRE_AUTH],
    body: {
      title: 'steroid muscle workout',
      description: 'Best gains ever with this routine.',
      guideSteps: ['Lift heavy'],
      targetMuscle: 'CHEST',
    },
    expect: [200],
  }),

  // ------------------------------------------- Real-time AI pose tracking
  E('ai-support-alerts-for-exercise', 'GET', '/api/member/ai-support/alerts/{exerciseCode}', {
    feature: F, section: 'Real-time AI pose tracking', role: ROLE.MEMBER,
    desc: 'Load the physiology and safety alerts that apply while performing an exercise',
    proc: [
      'Run request "GET /api/member/ai-support/alerts/{exerciseCode}" from the Postman collection folder "Pose Analysis > Real-time AI pose tracking"',
      'Path variable: exerciseCode = the code of the exercise being performed',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of alerts, each with the severity and the affected red-flag condition',
      'An empty array is returned when the member has no relevant contraindication',
    ],
    pre: [...PRE_AUTH, '3. The member profile holds the physiological data used for the alert evaluation'],
    expect: [200],    pathValues: { exerciseCode: 'PULL_UP' },
}),
  E('ai-support-alerts-unknown-exercise', 'GET', '/api/member/ai-support/alerts/{exerciseCode}', {
    feature: F, section: 'Real-time AI pose tracking', role: ROLE.MEMBER,
    desc: 'Alert lookup for an unknown exercise code returns an empty result or a not-found error',
    proc: [
      'Run request "GET /api/member/ai-support/alerts/{exerciseCode}" from the Postman collection folder "Pose Analysis > Real-time AI pose tracking"',
      'Path variable: exerciseCode = "NO_SUCH_EXERCISE"',
    ],
    exp: [
      'HTTP 404 Not Found is returned (or 200 with an empty array)',
      'No alert payload of another exercise leaks into the response',
    ],
    pre: [...PRE_AUTH],
    expect: [200, 404],    pathValues: { exerciseCode: 'NO_SUCH_EXERCISE' },
}),
  E('ai-support-quota', 'GET', '/api/member/ai-support/quota', {
    feature: F, section: 'Real-time AI pose tracking', role: ROLE.MEMBER,
    desc: 'Check the remaining AI support quota of the member',
    proc: [
      'Run request "GET /api/member/ai-support/quota" from the Postman collection folder "Pose Analysis > Real-time AI pose tracking"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the used and remaining quota for the current period',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),

  // ------------------------------------------- Rest between sets
  E('exercise-detail-rest-config', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'Rest between sets', role: ROLE.MEMBER,
    desc: 'Read the rest duration configured for the sets of an exercise',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Pose Analysis > Rest between sets"',
      'Path variable: id = the numeric id of a system exercise',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the rest time in seconds configured for the exercise',
      'A sensible default is returned when the exercise has no custom rest configuration',
    ],
    pre: [...PRE_AUTH, '3. A system exercise exists'],
    expect: [200],    pathValues: { id: '{{systemExerciseId}}' },
}),
  E('exercise-detail-rest-config-not-found', 'GET', '/api/v1/library/exercises/{id}', {
    feature: F, section: 'Rest between sets', role: ROLE.MEMBER,
    desc: 'Reading the rest configuration of a non-existent exercise returns a not-found error',
    proc: [
      'Run request "GET /api/v1/library/exercises/{id}" from the Postman collection folder "Pose Analysis > Rest between sets"',
      'Path variable: id = 999999',
    ],
    exp: [
      'HTTP 404 Not Found is returned',
      'Response body explains that the exercise was not found',
    ],
    pre: [...PRE_AUTH],
    expect: [404],    pathValues: { id: '999999' },
}),

  // ------------------------------------------- Exercise result & assessment
  E('ai-support-history', 'GET', '/api/member/ai-support/history', {
    feature: F, section: 'Exercise result & assessment', role: ROLE.MEMBER,
    desc: 'View the history of the AI assessments performed for the member',
    proc: [
      'Run request "GET /api/member/ai-support/history" from the Postman collection folder "Pose Analysis > Exercise result & assessment"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body is an array of history entries with the question, the answer and the creation time',
      'The entries are ordered from the newest to the oldest',
    ],
    pre: [...PRE_AUTH, '3. The member has asked at least one AI support question'],
    expect: [200],
  }),
  E('member-form-rules', 'GET', '/api/member/form-rules', {
    feature: F, section: 'Exercise result & assessment', role: ROLE.MEMBER,
    desc: 'Load the form thresholds used to score the exercise form of the member',
    proc: [
      'Run request "GET /api/member/form-rules" from the Postman collection folder "Pose Analysis > Exercise result & assessment"',
      'Query param: exerciseCode = the exercise being assessed',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the joint thresholds (angle, ROM depth, weight) applied to the exercise',
      'The default preset rules are returned when the exercise has no custom configuration',
    ],
    pre: [...PRE_AUTH, '3. The exercise code exists'],
    query: { exerciseCode: 'PULL_UP' },
    expect: [200],
  }),

  // ------------------------------------------- Chat-box AI support
  E('ai-support-ask', 'POST', '/api/member/ai-support/ask', {
    feature: F, section: 'Chat-box AI support', role: ROLE.MEMBER,
    desc: 'Ask a training question in the AI support chat box',
    proc: [
      'Run request "POST /api/member/ai-support/ask" from the Postman collection folder "Pose Analysis > Chat-box AI support"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: exerciseCode, question and the optional sessionId / formIssues / accuracy',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the answer text generated for the question',
      'The question is recorded in the AI support history',
    ],
    pre: [...PRE_AUTH, '3. The member still has AI support quota left'],
    body: {
      exerciseCode: 'PULL_UP',
      question: 'How can I improve the bottom position of my pull-up?',
      sessionId: '{{aiSessionId}}',
      formIssues: ['Elbow flare is too wide'],
      accuracy: 0.72,
    },
    expect: [200],
  }),
  E('ai-support-ask-empty-question', 'POST', '/api/member/ai-support/ask', {
    feature: F, section: 'Chat-box AI support', role: ROLE.MEMBER,
    desc: 'The AI chat rejects a blank question',
    proc: [
      'Run request "POST /api/member/ai-support/ask" from the Postman collection folder "Pose Analysis > Chat-box AI support"',
      'Body: question = "" (empty string)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the question is required',
      'No quota is consumed',
    ],
    pre: [...PRE_AUTH],
    body: {
      exerciseCode: 'PULL_UP',
      question: '',
    },
    expect: [400],
  }),
  E('ai-support-ask-quota-exceeded', 'POST', '/api/member/ai-support/ask', {
    feature: F, section: 'Chat-box AI support', role: ROLE.MEMBER,
    desc: 'The AI chat rejects the request when the member has used the whole quota',
    proc: [
      'Consume the whole AI support quota of the member',
      'Run request "POST /api/member/ai-support/ask" from the Postman collection folder "Pose Analysis > Chat-box AI support"',
    ],
    exp: [
      'HTTP 429 Too Many Requests is returned',
      'Response body explains that the quota for the period is exhausted',
      'No answer is generated',
    ],
    pre: [...PRE_AUTH, '3. The AI support quota of the member is exhausted for the current period'],
    expect: [429],
  }),
  E('ai-support-ask-unauthenticated', 'POST', '/api/member/ai-support/ask', {
    feature: F, section: 'Chat-box AI support', role: ROLE.NONE,
    desc: 'The AI chat rejects unauthenticated requests',
    proc: [
      'Run request "POST /api/member/ai-support/ask" from the Postman collection folder "Pose Analysis > Chat-box AI support"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No answer is generated and no quota is consumed',
    ],
    pre: [...PRE_AUTH, '3. The Authorization header has been removed'],
    expect: [401],
  }),

  // ------------------------------------------- Form correction
  E('form-correction-plan', 'GET', '/api/member/form-correction', {
    feature: F, section: 'Form correction', role: ROLE.MEMBER,
    desc: 'Get the personalised form-correction plan for an exercise',
    proc: [
      'Run request "GET /api/member/form-correction" from the Postman collection folder "Pose Analysis > Form correction"',
      'Query param: exerciseCode = the exercise to correct',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the list of correction tips and the thresholds that were breached',
      'An empty tip list is returned when the recorded form is already correct',
    ],
    pre: [...PRE_AUTH, '3. The exercise code exists and the member has recorded a session for it'],
    query: { exerciseCode: 'PULL_UP' },
    expect: [200],
  }),
  E('form-correction-plan-missing-code', 'GET', '/api/member/form-correction', {
    feature: F, section: 'Form correction', role: ROLE.MEMBER,
    desc: 'The form-correction plan rejects a request without the exercise code',
    proc: [
      'Run request "GET /api/member/form-correction" from the Postman collection folder "Pose Analysis > Form correction"',
      'Remove the exerciseCode query parameter',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the exercise code is required',
    ],
    pre: [...PRE_AUTH],
    expect: [400],
  }),
  E('form-correction-plan-unauthenticated', 'GET', '/api/member/form-correction', {
    feature: F, section: 'Form correction', role: ROLE.NONE,
    desc: 'The form-correction plan rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/member/form-correction" from the Postman collection folder "Pose Analysis > Form correction"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No correction plan is returned',
    ],
    pre: [...PRE_AUTH, '3. The Authorization header has been removed'],
    expect: [401],
  }),
];
