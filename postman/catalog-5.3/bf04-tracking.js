/**
 * BF-04 - Track Health & Progress Flow
 * Sheet: "Track Health & Progress Flow"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'Track Health & Progress Flow',
  code: 'TRCK',
  title: 'Track Health & Progress',
  scenarios: [
    scenario('Scenario A - Open the Health & Progress section and view the body metrics', [
      tc('TRCK01', 'Test open the Health & Progress screen',
        [
          '1. Login with a MEMBER account',
          '2. Click the "Health & Progress" entry on the navigation sidebar',
        ],
        [
          '1. Display the "Your health, in motion." header',
          '2. Display the health score with the percentage of the month',
          '3. Display the "Body metrics" panel with the current weight and height',
          '4. Display the "Current BMI" and the healthy range',
        ],
        PRE.member),
      tc('TRCK02', 'Test the Health & Progress screen requires a signed-in member',
        [
          '1. Access to CalisHealth via link without signing in',
          '2. Open the address of the Health & Progress screen',
        ],
        [
          '1. Redirect to the Log in screen',
          '2. Display message: "You will be redirected to the login page in {seconds} seconds."',
        ],
        PRE.guest),
      tc('TRCK03', 'Test the empty state of the body metrics',
        [
          '1. Login with a MEMBER account that has never recorded a measurement',
          '2. Open the "Health & Progress" screen',
        ],
        [
          '1. Display "No measurements logged yet" in the "Body metrics" panel',
          '2. Display "No monthly BMI records yet." in the BMI chart panel',
          '3. Display the "Log your body metrics and workouts to get your weekly score." hint',
        ],
        PRE.member),
      tc('TRCK04', 'Test the BMI category of the current measurement',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Health & Progress" screen',
        ],
        [
          '1. Display the BMI category of the member: "Underweight", "Healthy", "Overweight" or "Obese"',
          '2. Display the latest monthly reading with the recorded date',
        ],
        PRE.member),
      tc('TRCK05', 'Test the BMI chart of the monthly readings',
        [
          '1. Login with a MEMBER account that has recorded several measurements',
          '2. Open the "Health & Progress" screen',
          '3. Scroll down to the "BMI by month" chart',
        ],
        [
          '1. Display the monthly BMI bar chart with one bar per month',
          '2. Display the subtitle "Final recorded value at 23:59 on each month\'s last day"',
        ],
        PRE.member),
    ]),

    scenario('Scenario B - Update the weight and the height', [
      tc('TRCK06', 'Test update the weight and the height of the member',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "Update" button of the "Body metrics" panel',
          '3. Enter "70" in the "Weight (kg)" field',
          '4. Enter "175" in the "Height (cm)" field',
          '5. Click the "Save measurements" button',
        ],
        [
          '1. Display the updated weight and height on the "Body metrics" panel',
          '2. Display the recomputed BMI and its category',
          '3. Display the "Last updated" timestamp of the panel',
        ],
        PRE.member),
      tc('TRCK07', 'Test the weight below the accepted minimum is rejected',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "Update" button of the "Body metrics" panel',
          '3. Enter "20" in the "Weight (kg)" field',
          '4. Click the "Save measurements" button',
        ],
        [
          '1. Display error message: "Please enter a value between {min} and {max}kg"',
          '2. The previous measurement is kept unchanged',
        ],
        PRE.member),
      tc('TRCK08', 'Test the weight above the accepted maximum is rejected',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "Update" button of the "Body metrics" panel',
          '3. Enter "300" in the "Weight (kg)" field',
          '4. Click the "Save measurements" button',
        ],
        [
          '1. Display error message: "Please enter a value between {min} and {max}kg"',
          '2. The previous measurement is kept unchanged',
        ],
        PRE.member),
      tc('TRCK09', 'Test the height below the accepted minimum is rejected',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "Update" button of the "Body metrics" panel',
          '3. Enter "80" in the "Height (cm)" field',
          '4. Click the "Save measurements" button',
        ],
        [
          '1. Display error message: "Please enter a value between {min} and {max}cm"',
          '2. The previous measurement is kept unchanged',
        ],
        PRE.member),
      tc('TRCK10', 'Test the measurement update with a missing field',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "Update" button of the "Body metrics" panel',
          '3. Leave the "Weight (kg)" field empty',
          '4. Enter "175" in the "Height (cm)" field',
          '5. Click the "Save measurements" button',
        ],
        [
          '1. Display error message: "This field is required" under the weight field',
          '2. No measurement is saved',
        ],
        PRE.member),
    ]),

    scenario('Scenario C - Review the workout history', [
      tc('TRCK11', 'Test open the workout history of the member',
        [
          '1. Login with a MEMBER account',
          '2. Click the "Open history" button of the "Workout history" panel on the Health & Progress screen',
        ],
        [
          '1. Display the "Workout history" screen',
          '2. Display the counters of the workouts, the total workout time, the clean rep ratio and the total hold time',
          '3. Display the list of the completed sessions with the date and the duration',
        ],
        PRE.member),
      tc('TRCK12', 'Test filter the workout history by date',
        [
          '1. Open the "Workout history" screen',
          '2. Enter a date in the "Search by date" field',
        ],
        [
          '1. Display only the sessions of the selected date',
          '2. Display "No workouts on this day." when no session matches the date',
        ],
        PRE.member),
      tc('TRCK13', 'Test open the detail of a workout session',
        [
          '1. Open the "Workout history" screen',
          '2. Click the "View details" button of a session',
        ],
        [
          '1. Display the "Workout history / Workout log" breadcrumb',
          '2. Display the "Exercise details" with the total sets and the reps or hold per set',
          '3. Display the list total time and the number of completed exercises',
        ],
        PRE.member),
      tc('TRCK14', 'Test log a workout manually from the daily workout',
        [
          '1. Login with a MEMBER account',
          '2. Open the workout of the day on the Dashboard screen',
          '3. Open the workout log dialog of an exercise',
          '4. Enter "20" in the "Total reps" field and "18" in the "Clean reps" field',
          '5. Click the "Save" button',
        ],
        [
          '1. The workout session is recorded with the entered counters',
          '2. The session appears in the workout history',
        ],
        PRE.memberOnboarded),
      tc('TRCK15', 'Test the clean reps cannot exceed the total reps',
        [
          '1. Open the workout log dialog of an exercise',
          '2. Enter "10" in the "Total reps" field and "15" in the "Clean reps" field',
          '3. Click the "Save" button',
        ],
        [
          '1. Display error message: "The clean reps cannot be greater than the total reps."',
          '2. No workout session is saved',
        ],
        PRE.memberOnboarded),
    ]),

    scenario('Scenario D - Read the performance analytics', [
      tc('TRCK16', 'Test open the performance analytics screen',
        [
          '1. Open the "Health & Progress" screen',
          '2. Click the "View performance analytics" button',
        ],
        [
          '1. Display the "Performance analytics" screen with the "Deep insights" eyebrow',
          '2. Display the "AI form & accuracy metrics" section with the clean rep ratio and the clean hold ratio',
          '3. Display the "Training volume & load" section with the volume progression chart',
          '4. Display the "Workout Duration & Active Time" section with the active and rest split',
        ],
        PRE.member),
      tc('TRCK17', 'Test the empty state of the performance analytics',
        [
          '1. Login with a MEMBER account that has never recorded a workout',
          '2. Open the "Health & Progress" screen and click the "View performance analytics" button',
        ],
        [
          '1. Display message: "No workouts recorded {period}. Complete a few AI-tracked workouts to see your trends."',
          '2. The volume and the accuracy charts are empty',
        ],
        PRE.member),
      tc('TRCK18', 'Test the analytics period filter',
        [
          '1. Open the "Performance analytics" screen',
          '2. Change the time range to "in the last 3 months"',
        ],
        [
          '1. The charts and the counters are recomputed for the selected period',
          '2. The period label of every section is updated',
        ],
        PRE.member),
    ]),
  ],
};
