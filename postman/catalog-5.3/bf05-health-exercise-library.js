/**
 * BF-05 - View Health & Skill Exercise Library Flow
 * Sheet: "View Health & Skill Exercise Li"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'View Health & Skill Exercise Li',
  code: 'LIBX',
  title: 'View Health & Skill Exercise Library',
  scenarios: [
    scenario('Scenario A - Open the Library hub and browse the exercise lists', [
      tc('LIBX01', 'Test open the Library screen',
        [
          '1. Access to CalisHealth via link',
          '2. Click the "Library" entry on the navigation sidebar',
        ],
        [
          '1. Display the "Exercise & Workout library" page title',
          '2. Display the four library sections: "Exercise for health", "Exercise for skill", "Workout for health" and "Workout for skill"',
          '3. Display the counters of the total exercises, the total sets and the total workouts',
        ],
        PRE.guest),
      tc('LIBX02', 'Test open the health exercise list',
        [
          '1. Open the "Library" screen',
          '2. Click the "View list" button of the "Exercise for health" section',
        ],
        [
          '1. Display the "Exercise for health & skill list" title',
          '2. Display the subtitle "Browse exercises that support your health goals."',
          '3. Display the exercise list with the code, the name, the muscle group and the level',
        ],
        PRE.guest),
      tc('LIBX03', 'Test open the skill exercise list',
        [
          '1. Open the "Library" screen',
          '2. Click the "View list" button of the "Exercise for skill" section',
        ],
        [
          '1. Display the "Exercise for health & skill list" title',
          '2. Display the subtitle "Browse calisthenics skills and the exercises that build up to them."',
          '3. Display the exercise list of the skill category',
        ],
        PRE.guest),
      tc('LIBX04', 'Test filter the exercise list by muscle group',
        [
          '1. Open the "Exercise for health" list',
          '2. Select a muscle group in the "MUSCLE GROUP" dropdown',
        ],
        [
          '1. Display only the exercises of the selected muscle group',
          '2. Display the row counter "Showing {from}–{to} of {count} exercises"',
        ],
        PRE.guest),
      tc('LIBX05', 'Test filter the exercise list by level',
        [
          '1. Open the "Exercise for health" list',
          '2. Select "Intermediate" in the "Level" dropdown',
        ],
        [
          '1. Display only the exercises of the "Intermediate" level',
          '2. Display the level filter chip of the selected level',
        ],
        PRE.guest),
      tc('LIBX06', 'Test search the exercise list by name',
        [
          '1. Open the "Exercise for health" list',
          '2. Enter "push" in the "Search exercises" field',
        ],
        [
          '1. Display only the exercises whose name contains "push"',
          '2. Display the row counter of the filtered result',
        ],
        PRE.guest),
      tc('LIBX07', 'Test the search and the filters are combined',
        [
          '1. Open the "Exercise for health" list',
          '2. Enter "press" in the "Search exercises" field',
          '3. Select "Beginner" in the "Level" dropdown',
        ],
        [
          '1. Display only the exercises matching both the keyword and the level',
          '2. Display the row counter of the combined result',
        ],
        PRE.guest),
      tc('LIBX08', 'Test the empty state of the exercise list',
        [
          '1. Open the "Exercise for health" list',
          '2. Enter "zzzz" in the "Search exercises" field',
        ],
        [
          '1. Display "No exercises found"',
          '2. Display the hint "Try adjusting your search keywords, filter, or difficulty level."',
          '3. Display the "Clear all filters" button',
        ],
        PRE.guest),
      tc('LIBX09', 'Test paginate the exercise list',
        [
          '1. Open the "Exercise for health" list',
          '2. Click the "Next" button at the bottom of the list',
        ],
        [
          '1. Display the next page of the exercise list',
          '2. Display the updated row counter of the page',
        ],
        PRE.guest),
    ]),

    scenario('Scenario B - Open the detail of an exercise', [
      tc('LIBX10', 'Test the exercise detail page requires a signed-in member',
        [
          '1. Access to CalisHealth via link without signing in',
          '2. Open the "Exercise for health" list',
          '3. Click on an exercise of the list',
        ],
        [
          '1. Display the message "Please log in to view the full details of this exercise or workout."',
          '2. The exercise detail content is not displayed',
        ],
        PRE.guest),
      tc('LIBX11', 'Test open the detail page of a system exercise',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Exercise for health" list',
          '3. Click on an exercise of the list',
        ],
        [
          '1. Display the exercise name, the description and the "Muscle Group"',
          '2. Display the "Guide" with the numbered steps of the execution',
          '3. Display the "Target muscle groups" and the "Tips & safety" section',
          '4. Display the "Start" button',
        ],
        PRE.member),
    ]),

    scenario('Scenario C - Read the content of an exercise', [
      tc('LIBX12', 'Test watch the demo video of an exercise',
        [
          '1. Open the detail page of a system exercise',
          '2. Click the "Play video" button of the demo player',
        ],
        [
          '1. The demo video is played in the player',
          '2. The play button is replaced by the pause button',
        ],
        PRE.member),
      tc('LIBX13', 'Test the demo video is missing for an exercise without a video',
        [
          '1. Open the detail page of an exercise that has no demo video',
          '2. Open the demo video section',
        ],
        [
          '1. Display message: "Demo video is not available yet. The Content Manager must upload a video file."',
        ],
        PRE.member),
      tc('LIBX14', 'Test view the muscle anatomy of an exercise',
        [
          '1. Open the detail page of a system exercise',
          '2. Scroll down to the "Muscle Anatomy" section',
        ],
        [
          '1. Display the anatomy image of the target muscle',
          '2. Display the caption "Muscle anatomy for {name}"',
        ],
        PRE.member),
      tc('LIBX15', 'Test view the physiology information of an exercise',
        [
          '1. Open the detail page of a system exercise',
          '2. Scroll down to the "Exercise Physiology" section',
        ],
        [
          '1. Display the contraction type, the lever arm and the cardiovascular load',
          '2. Display the estimated heart rate zone, the blood pressure and the Valsalva risk',
          '3. Display the label "Estimated — not device measurement"',
        ],
        PRE.member),
      tc('LIBX16', 'Test explore the calisthenics skill tree',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Library" screen',
          '3. Click the "Exercise tree" entry of the navigation sidebar',
        ],
        [
          '1. Display the tree of the movement groups',
          '2. Display the unlock state of every movement for the member',
          '3. Display the locked badge on the movements that are not unlocked yet',
        ],
        PRE.member),
      tc('LIBX17', 'Test the progression and the regression variations of an exercise',
        [
          '1. Open the detail page of a system exercise',
          '2. Scroll down to the variations section',
        ],
        [
          '1. Display the progression variations that lead to the exercise',
          '2. Display the regression variations that simplify the exercise',
        ],
        PRE.member),
    ]),

    scenario('Scenario D - Create a system exercise as content manager', [
      tc('LIBX18', 'Test open the Exercise & Workout management screen',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Exercise & Workout" entry of the content manager menu',
        ],
        [
          '1. Display the exercise and the workout list with their status',
          '2. Display the "Create content" button',
        ],
        PRE.cm),
      tc('LIBX19', 'Test create a system exercise',
        [
          '1. Open the "Exercise & Workout" management screen',
          '2. Click the "Create content" button and choose "Exercise"',
          '3. Enter the "Name" field with "Pike Push-up"',
          '4. Select the target muscle group',
          '5. Select "Beginner" in the "Level" dropdown',
          '6. Enter the description and the guide steps',
          '7. Click the "Save" button',
        ],
        [
          '1. Display success message: "Exercise created"',
          '2. The new exercise appears in the exercise list with the status "Active"',
        ],
        PRE.cm),
      tc('LIBX20', 'Test the system exercise form is validated when a required field is missing',
        [
          '1. Open the exercise creation screen',
          '2. Enter the "Name" field with "Pike Push-up"',
          '3. Leave the description and the guide steps empty',
          '4. Click the "Save" button',
        ],
        [
          '1. Display error message: "Invalid data"',
          '2. The missing fields are highlighted and the exercise is not created',
        ],
        PRE.cm),
      tc('LIBX21', 'Test the system exercise name must be unique',
        [
          '1. Open the exercise creation screen',
          '2. Enter the "Name" field with "Pike Push-up" where an exercise with that name already exists',
          '3. Fill the description and the guide steps',
          '4. Click the "Save" button',
        ],
        [
          '1. Display error message: "An exercise with this name already exists."',
          '2. No new exercise is created',
        ],
        PRE.cm),
      tc('LIBX22', 'Test update the details of a system exercise',
        [
          '1. Open the "Exercise & Workout" management screen',
          '2. Open the "Pike Push-up" exercise and press the "Edit" action',
          '3. Change the description and the guide steps',
          '4. Click the "Save" button',
        ],
        [
          '1. Display success message: "Exercise updated"',
          '2. The updated description and guide steps are displayed on the exercise detail page',
        ],
        PRE.cm),
    ]),
  ],
};
