/**
 * BF-03 - Daily Training With AI Pose Tracking & Scoring Flow
 * Sheet: "Daily Training With AI Pose Tra"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'Daily Training With AI Pose Tra',
  code: 'POSE',
  title: 'Daily Training With AI Pose Tracking & Scoring',
  scenarios: [
    scenario('Scenario A - Build and publish a daily training plan template', [
      tc('POSE01', 'Test view the list of the daily training plan templates',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Open the "Daily Training Plans" screen from the content manager menu',
        ],
        [
          '1. Display the "Daily Training Plan Templates" page title',
          '2. Display the template list with the name, the level, the type and the days per week',
          '3. Display the counters of the total templates, the active and the inactive ones',
        ],
        PRE.cm),
      tc('POSE02', 'Test create a new daily training plan template',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Click the "New template" button',
          '3. Enter the "Name" field with "Beginner Health 3D"',
          '4. Select "Beginner" in the "Level" dropdown',
          '5. Select "Health" in the "Type" dropdown',
          '6. Enter "3" in the "Days per week" field',
          '7. Click the "Save" button',
        ],
        [
          '1. Display success message: "Template saved."',
          '2. The new template appears in the template list',
          '3. Display the weekly schedule of the template with its training days',
        ],
        PRE.cm),
      tc('POSE03', 'Test create a template with an invalid level',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Click the "New template" button',
          '3. Enter the "Name" field with "Invalid Plan"',
          '4. Select a level that does not exist in the level benchmark criteria',
          '5. Click the "Save" button',
        ],
        [
          '1. Display error message: "Could not save the template."',
          '2. No template is created',
        ],
        PRE.cm),
      tc('POSE04', 'Test assign a workout to a training day of the template',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Open the "Beginner Health 3D" template in edit mode',
          '3. Click the "Add a training day" button',
          '4. Click the "Pick a workout" button and select a system workout',
          '5. Click the "Save" button',
        ],
        [
          '1. The workout is listed under the selected training day',
          '2. Display success message: "Template saved."',
          '3. The weekly schedule shows the number of training days and the total number of exercises',
        ],
        PRE.cm),
      tc('POSE05', 'Test the preview of a daily training plan template',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Open the "Beginner Health 3D" template',
        ],
        [
          '1. Display the plan name, the level and the days per week',
          '2. Display the ordered list of the training days with their workouts',
        ],
        PRE.cm),
      tc('POSE06', 'Test the activation and the deactivation of a template',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Open the "More actions" menu of the "Beginner Health 3D" template',
          '3. Click the "Set inactive" entry',
          '4. Open the "More actions" menu again and click the "Set active" entry',
        ],
        [
          '1. The status of the template changes to "Inactive" and then back to "Active"',
          '2. The status column of the template list is refreshed after each change',
        ],
        PRE.cm),
      tc('POSE07', 'Test delete a daily training plan template',
        [
          '1. Open the "Daily Training Plans" screen',
          '2. Open the "More actions" menu of the "Beginner Health 3D" template',
          '3. Click the "Delete" entry',
          '4. Confirm the "Delete \"Beginner Health 3D\"? This cannot be undone." dialog',
        ],
        [
          '1. Display success message: "Template deleted."',
          '2. The template is removed from the template list',
        ],
        PRE.cm),
    ]),

    scenario('Scenario B - Plan the week of the member', [
      tc('POSE08', 'Test the member level is matched with the active template',
        [
          '1. Login with a MEMBER account that has completed the onboarding survey',
          '2. Open the workout of the day card on the Dashboard screen',
        ],
        [
          '1. The level of the member is read from the onboarding survey',
          '2. The active template of that level is matched and used for the day',
        ],
        PRE.memberOnboarded),
      tc('POSE09', 'Test open the workout schedule of the member',
        [
          '1. Login with a MEMBER account',
          '2. Click the "Schedule" entry on the navigation sidebar',
        ],
        [
          '1. Display the "Workout schedule" screen',
          '2. Display the "Your training plan" header with the used and the maximum number of training days',
          '3. Display the week calendar with the planned workouts',
        ],
        PRE.memberOnboarded),
      tc('POSE10', 'Test the week is pre-filled from the matched template',
        [
          '1. Open the "Workout schedule" screen for a week that was never scheduled',
          '2. Read the workouts that are already placed on the days of the week',
        ],
        [
          '1. The workouts of the matched template are pre-filled on the week',
          '2. The days that have already passed are skipped',
        ],
        PRE.memberOnboarded),
      tc('POSE11', 'Test the saved entries of the current week are loaded again',
        [
          '1. Open the "Workout schedule" screen',
          '2. Save a week, then reopen the "Workout schedule" screen',
        ],
        [
          '1. Display the workouts that were saved for the current week',
          '2. The week that was already scheduled is not pre-filled again from the template',
        ],
        PRE.memberOnboarded),
      tc('POSE12', 'Test drag and drop a workout onto a day of the week',
        [
          '1. Open the "Workout schedule" screen',
          '2. Drag a workout from the "Workouts" panel onto a day of the current week',
          '3. Click the "Save schedule" button',
        ],
        [
          '1. The workout is displayed on the selected day',
          '2. Display success message: "Your week has been saved."',
          '3. The counter of the training days is updated',
        ],
        PRE.memberOnboarded),
      tc('POSE13', 'Test the schedule cannot exceed the training day limit of the plan',
        [
          '1. Open the "Workout schedule" screen',
          '2. Drag workouts onto more days than the plan allows',
        ],
        [
          '1. Display error message: "This week has {used} training days, more than the {max} allowed by your plan. Remove a day to save."',
          '2. The extra workout is not added to the week',
        ],
        PRE.memberOnboarded),
      tc('POSE14', 'Test the schedule cannot be saved without a selected workout',
        [
          '1. Open the "Workout schedule" screen',
          '2. Do not select any workout for the week',
          '3. Click the "Save schedule" button',
        ],
        [
          '1. Display error message: "Pick at least one workout for this week before saving."',
          '2. The schedule of the week is not changed',
        ],
        PRE.memberOnboarded),
      tc('POSE15', 'Test the workout cannot be planned on a day that has already passed',
        [
          '1. Open the "Workout schedule" screen',
          '2. Drag a workout onto a day of the current week that is already over',
        ],
        [
          '1. Display error message: "You cannot plan workouts on a day that has already passed."',
          '2. The past day keeps its locked state',
        ],
        PRE.memberOnboarded),
      tc('POSE16', 'Test preview the workout plan of the week',
        [
          '1. Open the "Workout schedule" screen',
          '2. Click the "Preview workout plan" button',
        ],
        [
          '1. Display the "Plan info" of the week with the name, the year and the level',
          '2. Display the summary of the planned workouts and the training days',
          '3. Display the "Let\'s go →" button',
        ],
        PRE.memberOnboarded),
      tc('POSE17', 'Test start the week plan from the preview',
        [
          '1. Open the "Preview workout plan" dialog',
          '2. Click the "Let\'s go →" button',
        ],
        [
          '1. The current month schedule and the plan of the day are loaded',
          '2. Redirect to the workout of the day of the plan',
        ],
        PRE.memberOnboarded),
    ]),

    scenario('Scenario C - Open the daily workout of the member', [
      tc('POSE18', 'Test the daily workout of the day on the dashboard',
        [
          '1. Login with a MEMBER account that has a training plan',
          '2. Open the workout of the day card on the Dashboard screen',
        ],
        [
          '1. Display the "Today\'s workout" screen',
          '2. Display the exercise list with the sets, the reps and the rest time of each exercise',
          '3. Display the "Start workout" button',
        ],
        PRE.memberOnboarded),
      tc('POSE19', 'Test a rest day is displayed instead of a workout',
        [
          '1. Login with a MEMBER account',
          '2. Open the Dashboard screen on a day that is scheduled as a recovery day',
        ],
        [
          '1. Display the "REST DAY" badge',
          '2. Display the title "Take a breath today"',
          '3. Display the "Explore the exercise library" button',
        ],
        PRE.memberOnboarded),
      tc('POSE20', 'Test the detail of an exercise of the daily workout',
        [
          '1. Open the workout of the day on the Dashboard screen',
          '2. Click on an exercise of the list',
        ],
        [
          '1. Display the exercise description, the target muscle group, the level and the guide steps',
          '2. Display the demo video player and the "Start" button',
        ],
        PRE.memberOnboarded),
    ]),

    scenario('Scenario D - Track the pose and score the sets', [
      tc('POSE21', 'Test the camera check before the workout starts',
        [
          '1. Open the workout of the day on the Dashboard screen',
          '2. Click the "Start workout" button',
          '3. Grant the camera access when the browser asks for it',
        ],
        [
          '1. Display the camera preview of the member',
          '2. The workout starts once the camera is ready',
        ],
        PRE.memberWithVideo),
      tc('POSE22', 'Test the real-time AI pose tracking during a set',
        [
          '1. Start the workout of the day and open an exercise',
          '2. Click the "Start scanning" button',
          '3. Perform the repetitions in front of the camera',
        ],
        [
          '1. Display the skeleton of the body drawn over the camera frame',
          '2. Display the rep counter and the knee angle of the movement',
          '3. Display the real-time form alerts such as "Great form!" or "Form correction"',
        ],
        PRE.memberWithVideo),
      tc('POSE23', 'Test the camera access is denied',
        [
          '1. Open the workout of the day on the Dashboard screen',
          '2. Deny the camera access in the browser prompt',
          '3. Click the "Start scanning" button',
        ],
        [
          '1. Display error message: "Camera access is required to track your pose."',
          '2. The workout does not start the scanning',
        ],
        PRE.memberWithVideo),
      tc('POSE24', 'Test the rest countdown between two sets',
        [
          '1. Finish a set of the exercise',
          '2. Wait on the rest countdown screen',
          '3. Click the "Skip" button',
        ],
        [
          '1. Display the message "Rest for {seconds} seconds."',
          '2. Display the countdown in seconds and the hint "Rest {seconds}s, then start set {set}"',
          '3. The next set opens when the countdown ends or when "Skip" is pressed',
        ],
        PRE.memberWithVideo),
      tc('POSE25', 'Test the upload of a workout video for scoring',
        [
          '1. Open the exercise and press the "Upload video" action',
          '2. Click the "Browse file" button and select an MP4 video of the exercise',
          '3. Click the "Start scanning" button',
        ],
        [
          '1. Display the scanning progress with the scanned frame count',
          '2. Display the scan result with the detected person and the visible movement',
          '3. Open the workout result of the scanned video',
        ],
        PRE.memberWithVideo),
      tc('POSE26', 'Test the upload of a video that fails the safety scan',
        [
          '1. Open the exercise and press the "Upload video" action',
          '2. Click the "Browse file" button and select a video without any visible person',
          '3. Click the "Start scanning" button',
        ],
        [
          '1. Display error message: "No person was detected in this video. Please upload a video of the exercise."',
          '2. The workout result is not opened',
        ],
        PRE.memberWithVideo),
      tc('POSE27', 'Test the exercise result and the assessment of the set',
        [
          '1. Complete all the sets of an exercise',
          '2. Open the result screen',
        ],
        [
          '1. Display the session summary with the total reps, the clean reps and the accuracy',
          '2. Display the accuracy recalculated from the raw counters',
          '3. Display the list of the detected form issues',
        ],
        PRE.memberWithVideo),
      tc('POSE28', 'Test the form correction screen of the detected issues',
        [
          '1. Open the result screen of a finished exercise',
          '2. Click the "Form correction" action',
        ],
        [
          '1. Display the list of the correction tips and the thresholds that were breached',
          '2. Display the body angle and the knee angle values of the failed set',
        ],
        PRE.memberWithVideo),
      tc('POSE29', 'Test the daily session is saved when the workout is finished',
        [
          '1. Complete all the exercises of the daily workout',
          '2. Click the "Finish workout" button',
        ],
        [
          '1. Display success message: "Session saved. Nice work!"',
          '2. Display the "Great job!" summary with the exercises done, the accuracy and the day streak',
          '3. The session appears in the workout history',
        ],
        PRE.memberWithVideo),
    ]),

    scenario('Scenario E - Read the AI support', [
      tc('POSE30', 'Test the AI support answers the question about the form errors',
        [
          '1. Open the AI support chat box from the top bar',
          '2. Enter "Why do my form errors happen in Push-up?" in the "Message" field',
          '3. Click the "Send" button',
        ],
        [
          '1. Display the question counter "Question 1 of 3"',
          '2. Display the answer with the likely causes, one suggestion and the follow-up questions',
          '3. Display the badge "Powered by {model}"',
        ],
        PRE.memberWithVideo),
      tc('POSE31', 'Test the AI support is opened from the workout result screen',
        [
          '1. Open the result screen of a finished exercise',
          '2. Click the "Ask AI support" action',
          '3. Enter a question in the "Message" field and click the "Send" button',
        ],
        [
          '1. Display the AI support chat box with the question of the member',
          '2. Display the answer with the likely causes, one suggestion and the follow-up questions',
        ],
        PRE.memberWithVideo),
    ]),
  ],
};
