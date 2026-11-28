/**
 * BF-06 - Member-provided Exercise Library Flow
 * Sheet: "Member-provided Exercise Librar"
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'Member-provided Exercise Librar',
  code: 'MEMX',
  title: 'Member-provided Exercise Library',
  scenarios: [
    scenario('Scenario A - Browse the member-provided exercise list', [
      tc('MEMX01', 'Test open the member-provided exercise list',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Library" screen',
          '3. Click the "Member-provided exercise library" section',
        ],
        [
          '1. Display the "Member-provided exercise list" title',
          '2. Display the subtitle "Browse exercises shared by other members for reference."',
          '3. Display the list of the exercises submitted by the members',
        ],
        PRE.member),
      tc('MEMX02', 'Test only the accepted member exercises are listed',
        [
          '1. Open the "Member-provided exercise list"',
          '2. Read the notice under the search field',
        ],
        [
          '1. Display the notice "Only exercises that passed the automatic checks are shown here."',
          '2. No exercise with the status "Waiting for review" appears in the list',
        ],
        PRE.member),
      tc('MEMX03', 'Test search the member-provided exercise list',
        [
          '1. Open the "Member-provided exercise list"',
          '2. Enter "push" in the "Search by title or member" field',
        ],
        [
          '1. Display only the member exercises whose title or author matches the keyword',
          '2. Display the row counter of the filtered result',
        ],
        PRE.member),
      tc('MEMX04', 'Test sort the member-provided exercise list',
        [
          '1. Open the "Member-provided exercise list"',
          '2. Change the sort order to "Most saved"',
          '3. Change the sort order to "Oldest"',
        ],
        [
          '1. The list is re-ordered by the number of saves and then by the submission date',
          '2. The selected sort option stays visible in the sort dropdown',
        ],
        PRE.member),
      tc('MEMX05', 'Test open the detail of a member-provided exercise',
        [
          '1. Open the "Member-provided exercise list"',
          '2. Click the "View" button of an exercise',
        ],
        [
          '1. Display the exercise title, the description and the "Guide"',
          '2. Display the target muscle group, the level and the demo video',
          '3. Display the "Shared by" information of the author',
        ],
        PRE.member),
      tc('MEMX06', 'Test the member-provided exercise detail is not accessible for a guest',
        [
          '1. Access to CalisHealth via link without signing in',
          '2. Open the address of a member-provided exercise',
        ],
        [
          '1. Redirect to the Log in screen',
          '2. Display message: "Please log in to view the full details of this exercise or workout."',
        ],
        PRE.guest),
    ]),

    scenario('Scenario B - Create and manage the personal exercises', [
      tc('MEMX07', 'Test open the "My exercise list" screen',
        [
          '1. Login with a MEMBER account',
          '2. Open the "Library" screen',
          '3. Click the "My exercise list →" entry',
        ],
        [
          '1. Display the "My exercise list" title',
          '2. Display the subtitle "Exercises you created. Each one is checked automatically before it joins your library."',
          '3. Display the "Pending", "Rejected" and "Accepted" tabs',
        ],
        PRE.member),
      tc('MEMX08', 'Test create a personal exercise',
        [
          '1. Open the "My exercise list" screen',
          '2. Click the "Create exercise" button',
          '3. Enter the "Exercise Name *" field with "Ring Archer Push-ups"',
          '4. Select the "Primary Muscle Group"',
          '5. Select the "Difficulty Level"',
          '6. Enter the "Equipment" field with "Bodyweight, Rings, Pull-up bar"',
          '7. Enter the "Target Reps / Time" field with "10 reps or 30 sec"',
          '8. Enter the "Instructions & Form Notes" field',
          '9. Click the "Save Exercise" button',
        ],
        [
          '1. Display success message: "Exercise submitted for review"',
          '2. The new exercise appears in the "Pending" tab of the "My exercise list"',
        ],
        PRE.member),
      tc('MEMX09', 'Test the personal exercise name is required',
        [
          '1. Open the exercise creation dialog',
          '2. Leave the "Exercise Name *" field empty',
          '3. Fill the other fields and click the "Save Exercise" button',
        ],
        [
          '1. Display error message: "Please enter the exercise name"',
          '2. No personal exercise is created',
        ],
        PRE.member),
      tc('MEMX10', 'Test the personal exercise is checked by the sensitive content scan',
        [
          '1. Open the exercise creation dialog',
          '2. Enter the "Exercise Name *" field with "Badword Exercise"',
          '3. Enter the "Instructions & Form Notes" field with a profane word',
          '4. Click the "Save Exercise" button',
        ],
        [
          '1. Display an alert that the submission was blocked because of the sensitive content',
          '2. The exercise is not added to the "My exercise list"',
        ],
        PRE.member),
      tc('MEMX11', 'Test update a personal exercise',
        [
          '1. Open the "My exercise list" screen',
          '2. Open an exercise of the "Accepted" tab and click the "Edit" button',
          '3. Change the "Instructions & Form Notes" field',
          '4. Click the "Save Exercise" button',
        ],
        [
          '1. Display success message: "Exercise updated"',
          '2. The updated instructions are displayed on the exercise detail page',
        ],
        PRE.member),
      tc('MEMX12', 'Test the personal exercise is updated immediately when it passes the checks',
        [
          '1. Open the "My exercise list" screen',
          '2. Open an exercise of the "Accepted" tab and change its instructions',
          '3. Click the "Save Exercise" button',
          '4. Open the "Member-provided exercise list" again',
        ],
        [
          '1. The updated exercise is displayed in the community list without a new moderation delay',
          '2. The updated instructions are the ones shown on the detail page',
        ],
        PRE.member),
      tc('MEMX13', 'Test the moderation status of the personal exercises',
        [
          '1. Open the "My exercise list" screen',
          '2. Open the "Pending" tab',
          '3. Open the "Rejected" tab',
        ],
        [
          '1. Display the notice "Waiting for the automatic checks. This usually takes a few minutes, and you will get a notification when it is done." on the "Pending" tab',
          '2. Display the notice "These exercises did not pass the checks. Fix the reason shown and resubmit, or delete them." on the "Rejected" tab',
          '3. Display the reason of the rejection under each rejected exercise',
        ],
        PRE.member),
    ]),

    scenario('Scenario C - Moderate the member exercises as content manager', [
      tc('MEMX14', 'Test open the pending exercise moderation list',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Pending review" entry of the content manager menu',
        ],
        [
          '1. Display the "Pending exercise moderation" title',
          '2. Display the moderation summary with the pending review count, the waiting over 3 days count and the reviewed this week count',
          '3. Display the submissions waiting for the moderation',
        ],
        PRE.cm),
      tc('MEMX15', 'Test filter the pending moderation list',
        [
          '1. Open the "Pending exercise moderation" screen',
          '2. Enter a keyword in the "Search exercise or submitter" field',
          '3. Select a level in the "Filter by level" dropdown',
        ],
        [
          '1. Display only the submissions matching the keyword and the level',
          '2. Display "No submissions match these filters." when no submission matches',
        ],
        PRE.cm),
      tc('MEMX16', 'Test inspect a pending exercise submission',
        [
          '1. Open the "Pending exercise moderation" screen',
          '2. Click the "Review" button of a submission',
        ],
        [
          '1. Display the "Exercise / skill details" with the code of the exercise',
          '2. Display the muscle group, the type, the level, the default sets and the default reps',
          '3. Display the description, the guide and the demo video',
          '4. Display the "Approve" and the "Reject" actions',
        ],
        PRE.cm),
      tc('MEMX17', 'Test approve a member exercise submission',
        [
          '1. Open the moderation detail screen of a submission',
          '2. Click the "Approve" button',
          '3. Confirm the "Approve \\"{name}\\" and add it to the active exercise list?" dialog',
        ],
        [
          '1. Display success message: "Exercise approved."',
          '2. The submission leaves the pending moderation list',
          '3. The exercise appears in the member-provided exercise list',
        ],
        PRE.cm),
      tc('MEMX18', 'Test reject a member exercise submission',
        [
          '1. Open the moderation detail screen of a submission',
          '2. Click the "Reject" button',
          '3. Enter the reason "The guide steps are not detailed enough" in the "Rejection reason" field',
          '4. Confirm the "Reject \\"{name}\\"? The status will change to rejected immediately." dialog',
        ],
        [
          '1. Display success message: "Exercise rejected."',
          '2. The submission leaves the pending moderation list',
          '3. The member sees the rejection reason on the "Rejected" tab of the "My exercise list"',
        ],
        PRE.cm),
      tc('MEMX19', 'Test the rejection reason is required',
        [
          '1. Open the moderation detail screen of a submission',
          '2. Click the "Reject" button',
          '3. Leave the "Rejection reason" field empty',
          '4. Click the "Reject" button of the dialog',
        ],
        [
          '1. Display error message: "A rejection reason is required."',
          '2. The submission stays in the pending moderation list',
        ],
        PRE.cm),
      tc('MEMX20', 'Test review the exercise approval history',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Review history" entry of the content manager menu',
        ],
        [
          '1. Display the "Exercise approval history" title',
          '2. Display the summary with the total decisions, the approved and the rejected counts',
          '3. Display the moderation records with the decision, the reason and the moderator',
        ],
        PRE.cm),
      tc('MEMX21', 'Test an escalated submission cannot be handled again by the content manager',
        [
          '1. Open the moderation detail screen of a submission that was already escalated',
          '2. Try to press the "Approve" or the "Reject" button',
        ],
        [
          '1. Display the notice "This ticket was already escalated to the administrators, so it cannot be handled again here."',
          '2. The decision actions are not available',
        ],
        PRE.cm),
    ]),
  ],
};
