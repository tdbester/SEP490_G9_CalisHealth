/**
 * BF-08 - View Health & Skill Workout Library Flow
 * Sheet: "View Health & Skill Workout Lib"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'View Health & Skill Workout Lib',
  code: 'LIBW',
  title: 'View Health & Skill Workout Library',
  scenarios: [
    scenario('Scenario A - Browse the health and skill workout lists', [
      tc('LIBW01', 'Test open the workouts tab of the Library screen',
        [
          '1. Access to CalisHealth via link',
          '2. Open the "Library" screen',
          '3. Click the "Workouts" tab',
        ],
        [
          '1. Display the "Workout for health & skill list" title',
          '2. Display the subtitle "Browse workouts that support your health and skill goals."',
          '3. Display the workout list with the code, the name and the level',
        ],
        PRE.guest),
      tc('LIBW02', 'Test open the health workout list',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Select "Health" in the "Workout type" dropdown',
        ],
        [
          '1. Display only the workouts of the health category',
          '2. Display the row counter "Showing {from}–{to} of {count} workouts"',
        ],
        PRE.guest),
      tc('LIBW03', 'Test open the skill workout list',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Select "Skill" in the "Workout type" dropdown',
        ],
        [
          '1. Display only the workouts of the skill category',
          '2. Display the row counter of the filtered result',
        ],
        PRE.guest),
      tc('LIBW04', 'Test filter the workout list by level',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Select "Advanced" in the "Level" dropdown',
        ],
        [
          '1. Display only the workouts of the "Advanced" level',
          '2. Display the level filter chip of the selected level',
        ],
        PRE.guest),
      tc('LIBW05', 'Test search the workout list by name',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Enter "beginner" in the "Search workouts..." field',
        ],
        [
          '1. Display only the workouts whose name matches the keyword',
          '2. Display the row counter of the filtered result',
        ],
        PRE.guest),
      tc('LIBW06', 'Test the empty state of the workout list',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Enter "zzzz" in the "Search workouts..." field',
        ],
        [
          '1. Display "No workouts found"',
          '2. Display the hint "Try adjusting your search keywords, filter, or difficulty level."',
          '3. Display the "Clear all filters" button',
        ],
        PRE.guest),
      tc('LIBW07', 'Test paginate the workout list',
        [
          '1. Open the "Workouts" tab of the Library screen',
          '2. Click the "Next" button at the bottom of the list',
        ],
        [
          '1. Display the next page of the workout list',
          '2. Display the updated row counter of the page',
        ],
        PRE.guest),
    ]),

    scenario('Scenario B - Open the detail of a system workout and start it', [
      tc('LIBW08', 'Test the system workout detail requires a signed-in member',
        [
          '1. Access to CalisHealth via link without signing in',
          '2. Open the "Workouts" tab of the Library screen',
          '3. Click on a workout of the list',
        ],
        [
          '1. Display the message "Please log in to view the full details of this exercise or workout."',
          '2. The workout detail content is not displayed',
        ],
        PRE.guest),
      tc('LIBW09', 'Test open the detail page of a system workout',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Workouts" tab of the Library screen',
          '3. Click on a workout of the list',
        ],
        [
          '1. Display the workout name, the description and the level',
          '2. Display the ordered list of the workout items with the sets, the reps and the rest',
          '3. Display the "Start workout" button',
        ],
        PRE.member),
      tc('LIBW10', 'Test start a system workout',
        [
          '1. Open the detail page of a system workout',
          '2. Click the "Start workout" button',
        ],
        [
          '1. Redirect to the training screen of the first exercise',
          '2. The exercise detail of the first item of the workout is displayed',
        ],
        PRE.member),
      tc('LIBW11', 'Test open the detail of an exercise included in a system workout',
        [
          '1. Open the detail page of a system workout',
          '2. Click on one of the exercises of the workout',
        ],
        [
          '1. Display the exercise description, the target muscle group and the guide steps',
          '2. Display the demo video of the exercise',
        ],
        PRE.member),
      tc('LIBW12', 'Test a system workout without a startable exercise',
        [
          '1. Open the detail page of a system workout whose exercises are all locked',
          '2. Click the "Start workout" button',
        ],
        [
          '1. Display message: "This workout has no exercise you can start yet."',
          '2. The training screen does not open',
        ],
        PRE.member),
      tc('LIBW13', 'Test the workout list is reachable from the Library hub counters',
        [
          '1. Open the "Library" screen',
          '2. Click the "{count} workouts" counter of the summary',
        ],
        [
          '1. Display the "Workout for health & skill list" with the workout rows',
          '2. Display the row counter of the whole workout list',
        ],
        PRE.guest),
    ]),

    scenario('Scenario C - Create a system workout as content manager', [
      tc('LIBW14', 'Test open the workout list of the content manager',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Workouts" entry of the content manager menu',
        ],
        [
          '1. Display the workout list with the name, the level, the type and the status',
          '2. Display the "Create content" button',
        ],
        PRE.cm),
      tc('LIBW15', 'Test create a system workout',
        [
          '1. Open the workout list of the content manager',
          '2. Click the "Create content" button and choose "Workout"',
          '3. Enter the "Name" field with "Full Body Beginner A"',
          '4. Select "Beginner" in the "Level" dropdown',
          '5. Select "Health" in the "Type" dropdown',
          '6. Add the exercises of the workout with their sets and reps',
          '7. Click the "Save" button',
        ],
        [
          '1. Display success message: "Workout created"',
          '2. The new workout appears in the workout list with the status "Active"',
        ],
        PRE.cm),
      tc('LIBW16', 'Test the system workout form is validated when a required field is missing',
        [
          '1. Open the workout creation screen',
          '2. Enter the "Name" field with "Full Body Beginner A"',
          '3. Do not add any exercise',
          '4. Click the "Save" button',
        ],
        [
          '1. Display error message: "Invalid data"',
          '2. The workout is not created',
        ],
        PRE.cm),
      tc('LIBW17', 'Test the system workout name must be unique',
        [
          '1. Open the workout creation screen',
          '2. Enter the "Name" field with "Full Body Beginner A" where a workout with that name already exists',
          '3. Add the exercises and click the "Save" button',
        ],
        [
          '1. Display error message: "A workout with this name already exists."',
          '2. No new workout is created',
        ],
        PRE.cm),
      tc('LIBW18', 'Test update the details of a system workout',
        [
          '1. Open the workout list of the content manager',
          '2. Open the "Full Body Beginner A" workout and press the "Edit" action',
          '3. Change the description and the exercises',
          '4. Click the "Save" button',
        ],
        [
          '1. Display success message: "Workout updated"',
          '2. The updated workout is displayed on the member workout detail page',
        ],
        PRE.cm),
      tc('LIBW19', 'Test the status of a system workout is changed',
        [
          '1. Open the workout list of the content manager',
          '2. Change the status of the "Full Body Beginner A" workout to "Inactive"',
        ],
        [
          '1. The status column of the workout list is refreshed',
          '2. The inactive workout is no longer displayed in the member workout list',
        ],
        PRE.cm),
      tc('LIBW20', 'Test delete a system workout',
        [
          '1. Open the workout list of the content manager',
          '2. Click the "Delete" action of the "Full Body Beginner A" workout',
          '3. Confirm the delete dialog',
        ],
        [
          '1. Display success message: "Deleted successfully"',
          '2. The workout is removed from the workout list',
        ],
        PRE.cm),
    ]),
  ],
};
