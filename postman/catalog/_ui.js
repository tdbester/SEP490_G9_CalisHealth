/**
 * UI specification of the CalisHealth web client.
 *
 * Each catalogue section is bound to the screen of the React client that
 * exercises it. The specification provides the natural-language building
 * blocks used to write the "Test Case Procedure" and "Expected Results" cells
 * of the Integration Test report:
 *
 *   screen  : the name of the screen the tester opens
 *   action  : the verb used to reach that screen
 *   fields  : the labelled input the tester fills in
 *   submit  : the button the tester presses
 *   results : the observable outcome, phrased the way the UI shows it
 *
 * The wording follows the English translation keys of the client
 * (client/src/i18n/locales/en/*.js) so the report matches the real product.
 */

/** Screens of the client, keyed by the catalogue section they belong to. */
const SCREENS = {
  // ---------------------------------------------------------- Authentication
  Login: {
    screen: 'Log in screen',
    action: 'Navigate to the Log in screen',
    fields: {
      email: 'Email',
      password: 'Password',
    },
    submit: 'Log in',
    results: {
      success: 'Display success message: "Logged in successfully"',
      redirect: 'Redirect to the Dashboard screen',
      invalid: 'Display error message: "Email or password is incorrect."',
      unverified: 'Display error message: "This account has not been verified or is not allowed to sign in."',
      empty: 'Display error message: "Invalid data"',
      format: 'Display error message: "Please enter a valid email!"',
      blocked: 'Display error message: "Your account has been blocked"',
      unauthorized: 'Display error message: "Please log in to continue"',
      forbidden: 'Display error message: "You do not have access to this area"',
      notFound: 'Display error message: "The requested data was not found"',
    },
  },
  Register: {
    screen: 'Create account screen',
    action: 'Navigate to the Create account screen',
    fields: {
      fullName: 'Full name',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm password',
    },
    submit: 'Register',
    results: {
      success: 'Display success message: "Registered successfully!"',
      mail: 'Display message: "Verification email sent successfully. Please check your inbox to verify your account."',
      duplicate: 'Display error message: "Email is already registered"',
      mismatch: 'Display error message: "Passwords do not match"',
      weak: 'Display error message: "Password must be at least 8 characters and include uppercase, lowercase, a digit and a special character"',
      empty: 'Display error message: "Invalid data"',
      invalid: 'Display error message: "Invalid data"',
      forbidden: 'Display error message: "You do not have access to this area"',
      notFound: 'Display error message: "The requested data was not found"',
    },
  },
  'Forgot password': {
    screen: 'Forgot password screen',
    action: 'Navigate to the Forgot password screen',
    fields: { email: 'Email' },
    submit: 'Send reset link',
    results: {
      success: 'Display success message: "Request sent"',
      mail: 'Display message: "If the email exists, we have sent a reset link. Please check your inbox."',
      format: 'Display error message: "Invalid data"',
      invalid: 'Display error message: "Invalid data"',
      unauthorized: 'Display error message: "Please log in to continue"',
      forbidden: 'Display error message: "You do not have access to this area"',
      notFound: 'Display error message: "The requested data was not found"',
    },
  },
  'Reset password': {
    screen: 'Reset password screen',
    action: 'Navigate to the Reset password screen',
    fields: {
      token: 'the reset token from the reset email',
      newPassword: 'New password',
      confirmNewPassword: 'Confirm password',
    },
    submit: 'Reset password',
    results: {
      success: 'Display success message: "Password reset successfully!"',
      redirect: 'Redirect to the Log in screen',
      mismatch: 'Display error message: "Passwords do not match"',
      invalid: 'Display error message: "This reset link is invalid or has expired. Please request a new one."',
      weak: 'Display error message: "Password must be at least 8 characters and include uppercase, lowercase, a digit and a special character"',
      unauthorized: 'Display error message: "Please log in to continue"',
      forbidden: 'Display error message: "You do not have access to this area"',
      notFound: 'Display error message: "The requested data was not found"',
    },
  },
  'Profile information': {
    screen: 'Profile screen',
    action: 'Navigate to the Profile screen',
    fields: {
      fullName: 'Full name',
      phone: 'Phone number',
      gender: 'Gender',
      dateOfBirth: 'Date of birth',
      heightCm: 'Height (cm)',
      weightKg: 'Weight (kg)',
    },
    submit: 'Save',
    results: {
      success: 'Display success message: "Profile updated successfully"',
      redirect: 'The updated information is shown on the Profile screen',
      invalid: 'Display error message: "Invalid data"',
      unauthorized: 'Display error message: "Please log in to continue"',
      forbidden: 'Display error message: "You do not have access to this area"',
      notFound: 'Display error message: "The requested data was not found"',
    },
  },

  // ------------------------------------------------- User onboarding survey
  'Survey - Body information': {
    screen: 'onboarding survey screen (Body information step)',
    action: 'Navigate to the onboarding survey and open the "Body information" step',
    fields: { heightCm: 'Height (cm)', weightKg: 'Weight (kg)' },
    submit: 'Continue',
    results: { success: 'The survey moves to the next step' },
  },
  'Survey - Goals and motivation': {
    screen: 'onboarding survey screen (Goals and motivation step)',
    action: 'Navigate to the onboarding survey and open the "Goals and motivation" step',
    fields: { goalPrimary: 'Primary goal', goalTimeline: 'Timeline goal' },
    submit: 'Continue',
    results: { success: 'The survey moves to the next step' },
  },
  'Survey - Current training routine': {
    screen: 'onboarding survey screen (Current training routine step)',
    action: 'Navigate to the onboarding survey and open the "Current training routine" step',
    fields: { trainingDays: 'Training days per week', level: 'Current level' },
    submit: 'Continue',
    results: { success: 'The survey moves to the next step' },
  },
  'Survey - Level test': {
    screen: 'onboarding survey screen (Level test step)',
    action: 'Navigate to the onboarding survey and open the "Level test" step',
    fields: { levelTest: 'the level test answers' },
    submit: 'Continue',
    results: { success: 'The survey moves to the next step' },
  },
  'Survey - Result and recommended plan': {
    screen: 'survey result screen',
    action: 'Complete the onboarding survey',
    fields: {},
    submit: 'Finish',
    results: {
      success: 'Display the fitness level and the recommended training plan',
      redirect: 'Redirect to the survey result screen',
    },
  },
  'Preview training plan': {
    screen: 'training plan preview screen',
    action: 'Navigate to the training plan preview screen',
    fields: {},
    submit: 'Start this plan',
    results: {
      success: 'Display the plan name, the training days per week and the target level',
      redirect: 'Redirect to the Dashboard screen',
    },
  },

  // ------------------------------------------------ Main dashboard & routine
  'Main dashboard': {
    screen: 'Dashboard screen',
    action: 'Log in and land on the Dashboard screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the current streak, the workout of the day and the progress counters',
    },
  },
  Leaderboard: {
    screen: 'Leaderboard screen',
    action: 'Navigate to the Leaderboard screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the ranked members with their weekly score',
    },
  },
  'Workout schedule': {
    screen: 'Workout schedule screen',
    action: 'Navigate to the Workout schedule screen',
    fields: {},
    submit: 'Save',
    results: {
      success: 'Display message: "Your week has been saved."',
      failure: 'Display error message: "Could not save your schedule."',
    },
  },
  'Preview workout plan': {
    screen: 'daily workout plan screen',
    action: 'Navigate to the daily workout plan screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the workout of the current day with its exercise list',
    },
  },
  "Today's workout": {
    screen: 'workout of the day card on the Dashboard screen',
    action: 'Open the workout of the day on the Dashboard screen',
    fields: {},
    submit: 'Start Workout',
    results: {
      success: 'Display the workout of the current day with its exercise list',
    },
  },
  'Exercise detail & preview': {
    screen: 'exercise detail screen',
    action: 'Open an exercise from the workout of the day',
    fields: {},
    submit: 'Start',
    results: {
      success: 'Display the exercise description, the target muscle, the level and the guide steps',
    },
  },
  'Day streak': {
    screen: 'Day streak screen',
    action: 'Navigate to the Day streak screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the current streak length and the list of active days',
    },
  },
  'Day report': {
    screen: 'day report dialog',
    action: 'Open the day report of the current day',
    fields: {},
    submit: '',
    results: {
      success: 'Display the workouts completed, the sets performed and the time trained of the day',
    },
  },
  Feedback: {
    screen: 'Feedback screen',
    action: 'Navigate to the Feedback screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the feedback list of the logged-in member',
    },
  },

  // ------------------------------------------------ Tracking health & progress
  'Tracking health & progress': {
    screen: 'Health & Progress screen',
    action: 'Navigate to the Health & Progress screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the current weight, the height, the BMI and the goal values',
    },
  },
  'Update weight, height': {
    screen: 'Health & Progress screen',
    action: 'Navigate to the Health & Progress screen and open the measurement update dialog',
    fields: { weightKg: 'Weight (kg)', heightCm: 'Height (cm)', note: 'Note' },
    submit: 'Save',
    results: {
      success: 'Display the updated measurements including the recomputed BMI',
    },
  },
  'Workout history': {
    screen: 'workout history screen',
    action: 'Navigate to the workout history screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the workout sessions with the date, the duration and the number of completed sets',
    },
  },
  'Log workout': {
    screen: 'workout log dialog',
    action: 'Open the workout log dialog from the workout of the day',
    fields: { exerciseCode: 'Exercise', totalReps: 'Total reps', cleanReps: 'Clean reps', totalSeconds: 'Duration (seconds)' },
    submit: 'Save',
    results: {
      success: 'The workout session appears in the workout history',
    },
  },
  'Performance analytics': {
    screen: 'Performance analytics screen',
    action: 'Navigate to the Performance analytics screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the aggregated series used by the charts (volume, session count, best set per exercise)',
    },
  },

  // ------------------------------------------------ Pose analysis & AI support
  'Video demo': {
    screen: 'exercise detail screen (demo video)',
    action: 'Open the demo video of an exercise on the exercise detail screen',
    fields: {},
    submit: 'Play',
    results: {
      success: 'The demo video is played in the demo player',
    },
  },
  'Camera frame overlay': {
    screen: 'camera screen with the anatomy overlay',
    action: 'Open the camera screen of an exercise',
    fields: {},
    submit: '',
    results: {
      success: 'The anatomy image is drawn over the camera frame',
    },
  },
  'Upload Video / Browse File': {
    screen: 'personal exercise creation screen',
    action: 'Navigate to the personal exercise creation screen',
    fields: { title: 'Title', description: 'Description', videoFile: 'Video file' },
    submit: 'Save',
    results: {
      success: 'Display success message: "Exercise submitted for review"',
    },
  },
  'Real-time AI pose tracking': {
    screen: 'pose tracking screen',
    action: 'Open the pose tracking screen of an exercise',
    fields: {},
    submit: 'Start scanning',
    results: {
      success: 'Display the real-time alerts raised by the pose tracking',
    },
  },
  'Rest between sets': {
    screen: 'rest countdown screen',
    action: 'Open the rest countdown between two sets',
    fields: {},
    submit: 'Skip',
    results: {
      success: 'Display the rest time in seconds configured for the exercise',
    },
  },
  'Exercise result & assessment': {
    screen: 'exercise result screen',
    action: 'Finish the exercise and open the result screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the exercise result with the accuracy recalculated from the raw counters',
    },
  },
  'Chat-box AI support': {
    screen: 'AI support chat box',
    action: 'Open the AI support chat box from the top bar',
    fields: { question: 'Message' },
    submit: 'Send',
    results: {
      success: 'Display the answer generated for the question',
    },
  },
  'Form correction': {
    screen: 'form correction screen',
    action: 'Navigate to the form correction screen from the exercise result',
    fields: {},
    submit: '',
    results: {
      success: 'Display the list of correction tips and the thresholds that were breached',
    },
  },

  // ----------------------------------------------- Exercise & workout library
  'Exercise & Workout library': {
    screen: 'Library screen',
    action: 'Navigate to the Library screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the summary counters of the library',
    },
  },
  'Exercise for health / skill list': {
    screen: 'Library screen (Exercises tab)',
    action: 'Navigate to the Library screen and open the "Exercises" tab',
    fields: { level: 'Level', search: 'Search' },
    submit: '',
    results: {
      success: 'Display the exercise list with the code, the name, the muscle group and the level',
    },
  },
  'System exercise detail page': {
    screen: 'system exercise detail screen',
    action: 'Open a system exercise from the Library screen',
    fields: {},
    submit: 'Start',
    results: {
      success: 'Display the exercise name, the description, the target muscle, the level and the guide steps',
    },
  },
  'Calisthenics exercise tree': {
    screen: 'exercise tree screen',
    action: 'Navigate to the exercise tree screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the tree of the movement groups with the unlock state of the member',
    },
  },
  'Workout for health / skill list': {
    screen: 'Library screen (Workouts tab)',
    action: 'Navigate to the Library screen and open the "Workouts" tab',
    fields: { type: 'Workout type', level: 'Level', search: 'Search' },
    submit: '',
    results: {
      success: 'Display the workout list with the code, the name and the level',
    },
  },
  'System workout detail page': {
    screen: 'system workout detail screen',
    action: 'Open a system workout from the Library screen',
    fields: {},
    submit: 'Start workout',
    results: {
      success: 'Display the workout name, the description and its ordered exercise items',
    },
  },
  'Member-provided exercise list': {
    screen: 'community exercise list screen',
    action: 'Navigate to the community exercise list screen',
    fields: { search: 'Search', level: 'Level' },
    submit: '',
    results: {
      success: 'Display the list of the exercises submitted by the members',
    },
  },
  'Member-provided exercise detail': {
    screen: 'member exercise detail screen',
    action: 'Open a member exercise from the community exercise list',
    fields: {},
    submit: '',
    results: {
      success: 'Display the exercise title, the description, the guide steps, the target muscle and the demo video',
    },
  },
  'Create personal exercise': {
    screen: 'personal exercise creation screen',
    action: 'Navigate to the personal exercise creation screen',
    fields: { title: 'Title', description: 'Description', guideSteps: 'Guide steps' },
    submit: 'Save',
    results: {
      success: 'Display success message: "Exercise submitted for review"',
    },
  },
  'Personal exercise list': {
    screen: 'my exercises screen',
    action: 'Navigate to the my exercises screen',
    fields: { search: 'Search', level: 'Level' },
    submit: '',
    results: {
      success: 'Display the personal exercises of the member with their moderation status',
    },
  },
  'Update personal exercise': {
    screen: 'personal exercise update screen',
    action: 'Navigate to the personal exercise update screen',
    fields: { title: 'Title', description: 'Description', guideSteps: 'Guide steps' },
    submit: 'Save',
    results: {
      success: 'Display success message: "Exercise updated"',
    },
  },
  'Custom workout list': {
    screen: 'community workout list screen',
    action: 'Navigate to the community workout list screen',
    fields: { search: 'Search', level: 'Level' },
    submit: '',
    results: {
      success: 'Display the community workouts with their name, the level and the author',
    },
  },
  'Create personal workout': {
    screen: 'personal workout creation screen',
    action: 'Navigate to the personal workout creation screen',
    fields: { title: 'Title', description: 'Description', level: 'Level', type: 'Workout type' },
    submit: 'Save',
    results: {
      success: 'Display success message: "Workout created"',
    },
  },
  'My custom workout list': {
    screen: 'my workouts screen',
    action: 'Navigate to the my workouts screen',
    fields: { search: 'Search', level: 'Level' },
    submit: '',
    results: {
      success: 'Display the workouts owned by the member',
    },
  },
  'Update my custom workout': {
    screen: 'personal workout update screen',
    action: 'Navigate to the personal workout update screen',
    fields: { title: 'Title', description: 'Description', level: 'Level', type: 'Workout type' },
    submit: 'Save',
    results: {
      success: 'Display success message: "Workout updated"',
    },
  },
  'Exercise detail': {
    screen: 'exercise detail screen',
    action: 'Open an exercise from the library',
    fields: {},
    submit: 'Start',
    results: {
      success: 'Display the exercise description, the target muscle, the level and the guide steps',
    },
  },
  'Favorite workout and exercise': {
    screen: 'favorites screen',
    action: 'Open an exercise in the library and press the favorite button',
    fields: {},
    submit: 'Add to favorites',
    results: {
      success: 'The exercise appears in the favourites list',
    },
  },

  // --------------------------------------------------------- Admin system
  'Admin dashboard': {
    screen: 'Admin dashboard screen',
    action: 'Log in with the admin account and open the Admin dashboard screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the total counts of the users, the exercises, the workouts and the media',
    },
  },
  'Survey questions management': {
    screen: 'survey management screen',
    action: 'Open the survey management screen of the admin area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the ordered list of the survey steps with their code, their title and their status',
    },
  },
  'Create step': {
    screen: 'survey step creation dialog',
    action: 'Open the survey management screen and press "Create step"',
    fields: { code: 'Step code', title: 'Title', type: 'Step type' },
    submit: 'Create',
    results: {
      success: 'Display message: "Step created"',
    },
  },
  'Preview step': {
    screen: 'survey step preview dialog',
    action: 'Open the survey management screen and press "Preview" on a step',
    fields: {},
    submit: '',
    results: {
      success: 'Display the rendered questions with their options and the required flag',
    },
  },
  'Update step': {
    screen: 'survey step update dialog',
    action: 'Open the survey management screen and press "Edit" on a step',
    fields: { code: 'Step code', title: 'Title', type: 'Step type' },
    submit: 'Update',
    results: {
      success: 'Display message: "Step updated"',
    },
  },
  'User management': {
    screen: 'user management screen',
    action: 'Open the user management screen of the admin area',
    fields: { search: 'Search', role: 'Role', status: 'Status' },
    submit: '',
    results: {
      success: 'Display the paged list of the users with their email, their role and their active state',
    },
  },
  'Create other admin/ content manager account': {
    screen: 'staff account creation screen',
    action: 'Open the user management screen and press "Create user"',
    fields: { fullName: 'Full name', email: 'Email', role: 'Role' },
    submit: 'Create',
    results: {
      success: 'Display message: "User created"',
    },
  },
  'User details & activity log': {
    screen: 'user detail screen',
    action: 'Open a user from the user management screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the log entries with the action, the timestamp and the actor',
    },
  },
  'Notification management': {
    screen: 'notification list screen',
    action: 'Open the notification list screen of the admin area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the notification list with the title, the type, the status and the target audience',
    },
  },
  'Notification detail': {
    screen: 'notification detail screen',
    action: 'Open a notification from the notification list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the title, the message, the type, the status and the target audience of the notification',
    },
  },
  'Create notification': {
    screen: 'notification creation screen',
    action: 'Open the notification list screen and press "Create notification"',
    fields: { title: 'Title', message: 'Message', type: 'Type', targetAudience: 'Target audience' },
    submit: 'Create',
    results: {
      success: 'Display message: "Notification published"',
    },
  },
  'Media storage & infrastructure': {
    screen: 'storage screen',
    action: 'Open the storage screen of the admin area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the refreshed usage overview',
    },
  },
  'Storage capacity': {
    screen: 'storage capacity tab',
    action: 'Open the storage screen and select the "Capacity" tab',
    fields: {},
    submit: '',
    results: {
      success: 'Display the used and the available storage quota',
    },
  },
  'Orphaned & rejected media cleanup': {
    screen: 'media cleanup tab',
    action: 'Open the storage screen and select the "Cleanup" tab',
    fields: {},
    submit: 'Purge',
    results: {
      success: 'Display the number of the deleted files and the freed bytes',
    },
  },
  'Upload limits & infrastructure configuration': {
    screen: 'upload limits tab',
    action: 'Open the storage screen and select the "Upload limits" tab',
    fields: { maxVideoMb: 'Maximum video size (MB)' },
    submit: 'Save',
    results: {
      success: 'Display message: "Settings updated"',
    },
  },
  'Maintenance schedule management': {
    screen: 'maintenance schedule list screen',
    action: 'Open the maintenance schedule list screen of the admin area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the paged list of the schedules with the title, the start and end time and the affected areas',
    },
  },
  'Create maintenance schedule': {
    screen: 'maintenance schedule creation screen',
    action: 'Open the maintenance schedule list screen and press "Create schedule"',
    fields: {
      title: 'Title',
      message: 'Message',
      startsAt: 'Start time',
      endsAt: 'End time',
      affectedAreas: 'Affected areas',
      notifyMembers: 'Notify members',
    },
    submit: 'Create',
    results: {
      success: 'Display message: "Maintenance schedule created"',
    },
  },
  'Feedback & complaints management': {
    screen: 'feedback list screen',
    action: 'Open the feedback list screen of the admin area',
    fields: { status: 'Status', search: 'Search' },
    submit: '',
    results: {
      success: 'Display the feedback list with the title, the category and the status',
    },
  },
  'Feedback & complaint details': {
    screen: 'feedback detail screen',
    action: 'Open a feedback ticket from the feedback list screen',
    fields: {},
    submit: 'Save',
    results: {
      success: 'Display the resolution note in the detail view',
    },
  },

  // ------------------------------------------------ Content management system
  'Content manager dashboard': {
    screen: 'Content manager dashboard screen',
    action: 'Log in with the content manager account and open the Content manager dashboard screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the summary counters of the content management',
    },
  },
  'Feedbacks & complaints management': {
    screen: 'content feedback list screen',
    action: 'Open the feedback list screen of the content manager area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the feedback assigned to the current content manager',
    },
  },
  'Daily training plan templates': {
    screen: 'daily training plan template list screen',
    action: 'Open the daily training plan template list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the template list with the name, the level and the training days',
    },
  },
  'Daily training plan template builder': {
    screen: 'daily training plan template builder screen',
    action: 'Open the daily training plan template builder screen',
    fields: { name: 'Name', level: 'Level', daysPerWeek: 'Days per week' },
    submit: 'Save',
    results: {
      success: 'Display message: "Template created"',
    },
  },
  'Plan Preview': {
    screen: 'training plan preview dialog',
    action: 'Open the plan preview of a daily training plan template',
    fields: {},
    submit: '',
    results: {
      success: 'Display the template name, the level and the ordered list of the days with their workouts',
    },
  },
  'Daily training plan template details': {
    screen: 'daily training plan template detail screen',
    action: 'Open a template from the daily training plan template list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the template name, the level and the ordered list of the days with their workouts',
    },
  },
  'Update daily training plan template': {
    screen: 'daily training plan template builder screen',
    action: 'Open a template in edit mode from the template list screen',
    fields: { name: 'Name', level: 'Level', daysPerWeek: 'Days per week' },
    submit: 'Save',
    results: {
      success: 'Display message: "Template updated"',
    },
  },
  'Workout Detail': {
    screen: 'workout detail screen',
    action: 'Open a workout from the workout list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the workout name, the description, the level and the type',
    },
  },
  'Exercise & workout management': {
    screen: 'exercise and workout management screen',
    action: 'Open the exercise and workout management screen',
    fields: { search: 'Search', status: 'Status' },
    submit: '',
    results: {
      success: 'Display the exercise and the workout list with their status',
    },
  },
  'Pending exercise moderation list': {
    screen: 'pending review screen',
    action: 'Open the pending review screen of the content manager area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the submissions waiting for the moderation',
    },
  },
  'Exercise approval history': {
    screen: 'review history screen',
    action: 'Open the review history screen of the content manager area',
    fields: {},
    submit: '',
    results: {
      success: 'Display the moderation records with the decision, the reason and the moderator',
    },
  },
  'Exercise moderation detail': {
    screen: 'exercise moderation detail screen',
    action: 'Open a submission from the pending review screen',
    fields: {},
    submit: 'Approve',
    results: {
      success: 'Display message: "Exercise approved"',
    },
  },
  'Rejection details': {
    screen: 'exercise moderation detail screen',
    action: 'Reject a submission from the exercise moderation detail screen',
    fields: { rejectionReason: 'Rejection reason' },
    submit: 'Reject',
    results: {
      success: 'Display message: "Exercise rejected"',
    },
  },
  'Workout detail': {
    screen: 'workout detail screen',
    action: 'Open a workout from the workout list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the workout name, the description and its ordered exercise items',
    },
  },
  'Create system exercise & workout': {
    screen: 'exercise creation screen',
    action: 'Open the exercise and workout management screen and press "Create"',
    fields: {
      name: 'Name',
      description: 'Description',
      level: 'Level',
      type: 'Type',
      items: 'Exercise items',
      guideSteps: 'Guide steps',
    },
    submit: 'Save',
    results: {
      success: 'Display message: "Exercise created"',
    },
  },
  'Progression rule configurations': {
    screen: 'progression rule list screen',
    action: 'Open the progression rule list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the rules with the prerequisite, the required sets, the reps and the minimum accuracy',
    },
  },
  'Create progression rule': {
    screen: 'progression rule creation screen',
    action: 'Open the progression rule list screen and press "Create rule"',
    fields: {
      exerciseCode: 'Exercise',
      prerequisiteCode: 'Prerequisite exercise',
      requiredSets: 'Required sets',
      requiredReps: 'Required reps',
      requiredSeconds: 'Required seconds',
      minAccuracy: 'Minimum accuracy (%)',
      status: 'Status',
    },
    submit: 'Save',
    results: {
      success: 'Display message: "Rule created"',
    },
  },
  'Progression rule detail': {
    screen: 'progression rule detail screen',
    action: 'Open a rule from the progression rule list screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the exercise pair, the thresholds and the status of the rule',
    },
  },
  'Update progression rule': {
    screen: 'progression rule edit screen',
    action: 'Open a rule in edit mode from the progression rule list screen',
    fields: {
      requiredSets: 'Required sets',
      requiredReps: 'Required reps',
      requiredSeconds: 'Required seconds',
      minAccuracy: 'Minimum accuracy (%)',
      status: 'Status',
    },
    submit: 'Save',
    results: {
      success: 'Display message: "Rule updated"',
    },
  },
  'Calisthenic level benchmark criteria': {
    screen: 'level criteria screen',
    action: 'Open the level criteria screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the list of the levels with the benchmark exercises and their thresholds',
    },
  },
  'Update level & benchmark criteria': {
    screen: 'level criteria edit screen',
    action: 'Open a level in edit mode from the level criteria screen',
    fields: { name: 'Level name', minAccuracy: 'Minimum accuracy (%)' },
    submit: 'Save',
    results: {
      success: 'Display message: "Level updated"',
    },
  },
  'Benchmark level detail': {
    screen: 'level criteria detail screen',
    action: 'Open a level from the level criteria screen',
    fields: {},
    submit: '',
    results: {
      success: 'Display the benchmark exercises of the level with their reps thresholds and their scores',
    },
  },
};

/** Default screen used when a section has no explicit specification. */
const DEFAULT_SCREEN = {
  screen: 'the related screen',
  action: 'Navigate to the related screen',
  fields: {},
  submit: '',
  results: { success: 'The screen shows the expected data' },
};

/** Look up the specification of a catalogue section. */
function specFor(section) {
  return SCREENS[section] || DEFAULT_SCREEN;
}

module.exports = { SCREENS, DEFAULT_SCREEN, specFor };
