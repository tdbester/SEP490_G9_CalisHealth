/**
 * BF-07 - View Custom Workout Library Flow
 * Sheet: "View Custom Workout Library Flo"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'View Custom Workout Library Flo',
  code: 'CUST',
  title: 'View Custom Workout Library',
  scenarios: [
    scenario('Scenario A - Browse the custom workout library', [
      tc('CUST01', 'Test open the custom workout list',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Library" screen',
          '3. Click the "Custom workout library" section',
        ],
        [
          '1. Display the "Custom workout list" title',
          '2. Display the subtitle "Workouts other members built from accepted exercises. Browse them for ideas."',
          '3. Display the community workouts with their name, the level and the author',
        ],
        PRE.member),
      tc('CUST02', 'Test every exercise of a community workout has passed the checks',
        [
          '1. Open the "Custom workout list"',
          '2. Read the notice above the list',
        ],
        [
          '1. Display the notice "Every exercise inside these workouts has passed the automatic checks."',
        ],
        PRE.member),
      tc('CUST03', 'Test search the custom workout list',
        [
          '1. Open the "Custom workout list"',
          '2. Enter "push" in the "Search by workout or member" field',
        ],
        [
          '1. Display only the community workouts whose name or author matches the keyword',
          '2. Display the row counter of the filtered result',
        ],
        PRE.member),
      tc('CUST04', 'Test open the detail of a community custom workout',
        [
          '1. Open the "Custom workout list"',
          '2. Click on a workout of the list',
        ],
        [
          '1. Display the workout name, the description and the total time',
          '2. Display the "Exercises" section with the sets, the reps and the rest of each exercise',
          '3. Display the author information "By {name} · {posted} · {saved} saved"',
        ],
        PRE.member),
      tc('CUST05', 'Test open the "My custom workout list" screen',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Library" screen',
          '3. Click the "My custom workouts" entry',
        ],
        [
          '1. Display the "My custom workout list" title',
          '2. Display the subtitle "Workouts you created. Edit or delete them, or build a new one."',
          '3. Display the workouts owned by the member',
        ],
        PRE.member),
      tc('CUST06', 'Test filter and sort the "My custom workout list"',
        [
          '1. Open the "My custom workout list"',
          '2. Enter a keyword in the "Search by workout name" field',
          '3. Select a level in the "Filter by level" dropdown',
          '4. Select a length in the "Filter by length" dropdown',
        ],
        [
          '1. Display only the personal workouts matching the keyword, the level and the length',
          '2. Display "No workouts match your filters." when no workout matches',
        ],
        PRE.member),
    ]),

    scenario('Scenario B - Create and manage a personal custom workout', [
      tc('CUST07', 'Test create a personal custom workout',
        [
          '1. Open the "My custom workout list"',
          '2. Click the "+ Create workout" button',
          '3. Enter the "Workout name" field with "Upper body push day"',
          '4. Select "Intermediate" in the "Level" dropdown',
          '5. Enter a note in the "Note (optional)" field',
          '6. Search an accepted exercise and click its "+ Add" button',
          '7. Click the "Create workout" button',
        ],
        [
          '1. Display success message: "Workout created successfully!"',
          '2. The new workout appears in the "My custom workout list"',
          '3. Display the summary with the number of exercises, the number of sets and the estimated time',
        ],
        PRE.member),
      tc('CUST08', 'Test the workout name is required',
        [
          '1. Open the workout creation screen',
          '2. Leave the "Workout name" field empty',
          '3. Add an accepted exercise and click the "Create workout" button',
        ],
        [
          '1. Display error message: "Please fill in all required fields correctly."',
          '2. No workout is created',
        ],
        PRE.member),
      tc('CUST09', 'Test the workout level is required',
        [
          '1. Open the workout creation screen',
          '2. Enter the "Workout name" field with "Upper body push day"',
          '3. Do not select a level',
          '4. Click the "Create workout" button',
        ],
        [
          '1. Display error message: "Please select a level"',
          '2. No workout is created',
        ],
        PRE.member),
      tc('CUST10', 'Test the workout title cannot duplicate another workout of the member',
        [
          '1. Open the workout creation screen',
          '2. Enter the "Workout name" field with "Upper body push day" where the member already owns that title',
          '3. Select a level, add an exercise and click the "Create workout" button',
        ],
        [
          '1. Display error message: "You already have a workout with this title. Please choose a different title."',
          '2. No duplicate workout is created',
        ],
        PRE.member),
      tc('CUST11', 'Test only the accepted exercises can be added to a workout',
        [
          '1. Open the workout creation screen',
          '2. Look at the "Accepted exercises" panel',
        ],
        [
          '1. Display the notice "Only exercises accepted by the system can be added. Pending and rejected ones are not available until they pass the checks."',
          '2. Display the counter "{count} available" of the accepted exercises',
        ],
        PRE.member),
      tc('CUST12', 'Test update the details and the exercises of a personal custom workout',
        [
          '1. Open the "My custom workout list"',
          '2. Open a workout and click the "Edit" action',
          '3. Change the workout name and the description',
          '4. Remove one exercise and add another one',
          '5. Click the "Save changes" button',
        ],
        [
          '1. Display success message: "Workout updated"',
          '2. The updated name, the description and the exercise list are displayed on the workout detail page',
        ],
        PRE.member),
      tc('CUST13', 'Test reorder the exercises of a personal custom workout',
        [
          '1. Open the "Update my custom workout" screen',
          '2. Drag an exercise to another position of the list',
          '3. Click the "Save changes" button',
        ],
        [
          '1. The exercises are displayed in the new order',
          '2. Display success message: "Workout updated"',
          '3. The new order is kept on the workout detail page',
        ],
        PRE.member),
      tc('CUST14', 'Test delete a personal custom workout and undo the deletion',
        [
          '1. Open the "My custom workout list"',
          '2. Click the "Delete" action of a workout',
          '3. Confirm the "Are you sure you want to delete this item? You will have {seconds} seconds to undo this action after confirming." dialog',
          '4. Click the "Undo" button of the toast within 10 seconds',
        ],
        [
          '1. Display success message: "Item deleted."',
          '2. The workout is removed from the list',
          '3. Display success message: "Deletion undone." and the workout is restored at its original index',
        ],
        PRE.member),
      tc('CUST15', 'Test the deletion is kept when the undo is not pressed in time',
        [
          '1. Open the "My custom workout list"',
          '2. Click the "Delete" action of a workout',
          '3. Confirm the delete dialog',
          '4. Wait more than 10 seconds without pressing the "Undo" button',
        ],
        [
          '1. The workout stays removed from the list',
          '2. The undo action is no longer available on the toast',
        ],
        PRE.member),
    ]),

    scenario('Scenario C - Start a custom workout', [
      tc('CUST16', 'Test start a custom workout from the community list',
        [
          '1. Open the "Custom workout list"',
          '2. Open a workout and click the "Start workout" button',
        ],
        [
          '1. Redirect to the training screen of the first exercise',
          '2. The exercise detail of the first item of the workout is displayed',
        ],
        PRE.member),
      tc('CUST17', 'Test start a personal custom workout from the "My custom workout list"',
        [
          '1. Open the "My custom workout list"',
          '2. Click the "Start" button of a workout',
        ],
        [
          '1. Redirect to the training screen of the first exercise',
          '2. The workout summary of the day is updated with the personal workout',
        ],
        PRE.member),
      tc('CUST18', 'Test a locked workout cannot be started',
        [
          '1. Open the "Custom workout list"',
          '2. Open a workout whose exercises are still locked and click the "Start workout" button',
        ],
        [
          '1. Display the "Locked" badge on the workout',
          '2. Display message: "This workout is locked. Unlock {exercises} in the Exercise Tree before starting it."',
          '3. The training screen does not open',
        ],
        PRE.member),
      tc('CUST19', 'Test a locked exercise cannot be started from a community workout',
        [
          '1. Open the detail of a community workout',
          '2. Press the "Start workout" button on an exercise whose prerequisites are not done',
        ],
        [
          '1. Display the "Locked" badge on the exercise',
          '2. Display message: "This exercise is still locked. Complete its prerequisites in the Exercise Tree first."',
        ],
        PRE.member),
    ]),
  ],
};
