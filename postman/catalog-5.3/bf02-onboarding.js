/**
 * BF-02 - User Onboarding Survey & Exercise Recommendation Flow
 * Sheet: "User Onboarding Survey & Exerci"
 *
 * The swimlanes of the "Main Business Flow" diagram give four actors:
 *   Content Manager -> configures the "Level & Benchmark Criteria"
 *   Admin           -> manages the survey steps and the questions
 *   System          -> validates, scores and persists
 *   Member          -> answers the survey, reads the level result and starts the plan
 *
 * The role split follows the running system: the survey management screen and
 * the /api/content/surveys/** endpoints belong to the ADMIN role (SecurityConfig
 * and the /admin/surveys route), while the benchmark criteria screen belongs to
 * the CONTENT_MANAGER role (/api/content/level-benchmarks).
 */
const { PRE, scenario, tc } = require('./_helpers');

module.exports = {
  sheet: 'User Onboarding Survey & Exerci',
  code: 'SURV',
  title: 'User Onboarding Survey & Exercise Recommendation',
  scenarios: [
    // ---------------------------------------------------------------- Scenario A
    // Content Manager lane: Open "Level & Benchmark Criteria" -> Add exercises
    // and set thresholds -> Name the levels and contiguous ranges -> Click
    // "Save All Changes" -> Configuration valid? -> No: error, Yes: save the
    // levels and the shared thresholds -> Auto-create the Level test questions.
    scenario('Scenario A - Configure the level benchmark criteria as content manager', [
      tc('SURV01', 'Test open the "Level & Benchmark Criteria" screen',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Click the "Level benchmark criteria" entry of the content manager menu',
        ],
        [
          '1. Display the "Calisthenics Level Benchmark Criteria" page title',
          '2. Display the counters of the total levels, the configured levels, the active levels and the inactive levels',
          '3. Display the "Benchmark Criteria" table with the level, the score range, the scoring formula and the status',
        ],
        PRE.cm),
      tc('SURV02', 'Test open the detail of a benchmark level',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Click the "View" action of a level of the table',
        ],
        [
          '1. Display the name of the level and the "Benchmark level details" description',
          '2. Display the tier, the score range, the number of members and the last updated information',
          '3. Display the "Exercise point rules" table with the 1-point, the 2-point and the 3-point bands of every exercise',
        ],
        PRE.cm),
      tc('SURV03', 'Test the benchmark screen lists only the shared benchmark exercises',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Open the "Update All Benchmark Levels" screen',
          '3. Click the "Add exercise" button',
        ],
        [
          '1. Display the system exercises of the REPS and the HOLD categories only',
          '2. Display a member-provided exercise nowhere in the list',
          '3. Display the unit "reps" for a REPS exercise and "seconds" for a HOLD exercise',
        ],
        PRE.cm),
      tc('SURV04', 'Test add the benchmark exercises and set their thresholds',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Click the "Add exercise" button and select a REPS exercise',
          '3. Enter the 1-point limit and the 2-point limit of the exercise',
          '4. Click the "Add exercise" button again and select a HOLD exercise',
          '5. Enter the 1-point limit and the 2-point limit of the second exercise',
          '6. Click the "Save All Changes" button',
        ],
        [
          '1. The exercises and their thresholds are added to the "Exercises and thresholds" section',
          '2. Display success message: "All benchmark levels updated."',
          '3. The total score range of the levels is re-fitted automatically around the number of exercises',
        ],
        PRE.cm),
      tc('SURV05', 'Test name the levels and their contiguous score ranges',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Enter the name of a level in the "Level name" field',
          '3. Set the "Minimum score" of the level to the previous maximum plus one',
          '4. Set the "Maximum score" of the highest level to the end of the total score range',
          '5. Click the "Save All Changes" button',
        ],
        [
          '1. Display success message: "All benchmark levels updated."',
          '2. Display the levels of the table with the entered names and the contiguous score ranges',
          '3. The score ranges of the table have no gap and no overlap',
        ],
        PRE.cm),
      tc('SURV06', 'Test the benchmark configuration is rejected when a level has no name',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Clear the "Level name" field of a level',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "Every level needs a name."',
          '2. Nothing is saved and the level list stays unchanged',
        ],
        PRE.cm),
      tc('SURV07', 'Test the benchmark configuration is rejected when a level name is duplicated',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Enter the name of another level in the "Level name" field',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "Level names must be unique."',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV08', 'Test the benchmark configuration is rejected when no level stays active',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Set the "Status" of every level to "Inactive"',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "At least one level must stay active."',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV09', 'Test the benchmark configuration is rejected when the 2-point limit is not greater than the 1-point limit',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Enter a 2-point limit that is not greater than the 1-point limit of the same exercise',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "{label}: the 2-point limit must be greater than the 1-point limit."',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV10', 'Test the benchmark configuration is rejected when the score ranges are not contiguous',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Set the "Minimum score" of a level so that it no longer follows the previous maximum plus one',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "Benchmark score ranges must be contiguous: {name} must start at {value}."',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV11', 'Test activate and deactivate a benchmark level',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Open the action menu of a level and click the "Deactivate" entry',
          '3. Open the action menu of the same level and click the "Activate" entry',
        ],
        [
          '1. The status of the level changes to "Inactive" and then back to "Active"',
          '2. The status column of the table is refreshed after each change',
        ],
        PRE.cm),
      tc('SURV12', 'Test delete a benchmark level that is not used',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Open the action menu of an unused level and click the "Delete" entry',
          '3. Confirm the "Delete level?" dialog',
        ],
        [
          '1. Display success message: "Level deleted."',
          '2. The level is removed from the table and its score range goes to the neighbouring level',
        ],
        PRE.cm),
      tc('SURV13', 'Test delete a benchmark level that is still used by a member',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Open the action menu of a level that a member is currently at and click the "Delete" entry',
        ],
        [
          '1. Display error message: "{count} member is currently at level {name}. Deactivate the level instead of deleting it."',
          '2. The level stays in the table',
        ],
        PRE.cm),
      tc('SURV14', 'Test the level test questions are created from the benchmark exercises',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Add a benchmark exercise that has no survey question yet and save the configuration',
          '3. Open the survey management screen of the admin area',
        ],
        [
          '1. Display success message: "All benchmark levels updated."',
          '2. The "Level test" step of the survey contains a new number question for the added exercise',
          '3. The removed exercises keep their survey question but their answer no longer places the member',
        ],
        PRE.cm),
    ]),

    // ---------------------------------------------------------------- Scenario B
    // System lane of the benchmark branch: the configuration is saved and the
    // Level test step is linked to the benchmark slots.
    scenario('Scenario B - Validate and save the benchmark configuration', [
      tc('SURV15', 'Test the benchmark configuration is rejected when a level is still used by a workout',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Remove the level that a system workout uses',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "Workouts still use level {name}. Move them to another level first, or deactivate the level"',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV16', 'Test the benchmark configuration is rejected when no benchmark exercise is configured',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Remove every benchmark exercise',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "Configure between 1 and 8 benchmark exercises"',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV17', 'Test two benchmark exercises that resolve to the same survey question are rejected',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Add two benchmark exercises whose survey slot resolves to the same question',
          '3. Click the "Save All Changes" button',
        ],
        [
          '1. Display error message: "{name} resolves to the same survey result as another exercise; pick different exercises"',
          '2. Nothing is saved',
        ],
        PRE.cm),
      tc('SURV18', 'Test the total score range of the benchmark is re-fitted when an exercise is added',
        [
          '1. Open the "Level & Benchmark Criteria" screen',
          '2. Note the score range of the levels',
          '3. Add one more benchmark exercise and save the configuration',
          '4. Open the "Level & Benchmark Criteria" screen again',
        ],
        [
          '1. The number of the configured levels fits the new total score range',
          '2. The maximum score of the highest level equals the new end of the total score range',
          '3. Display success message: "All benchmark levels updated."',
        ],
        PRE.cm),
      tc('SURV19', 'Test the levels are reordered by their score range',
        [
          '1. Open the "Update All Benchmark Levels" screen',
          '2. Drag a level to another position of the list',
          '3. Click the "Save All Changes" button',
          '4. Open the "Level & Benchmark Criteria" screen',
        ],
        [
          '1. The levels of the table are displayed in the new order',
          '2. The minimum score of every level still follows the maximum score of the previous level',
        ],
        PRE.cm),
    ]),

    // ---------------------------------------------------------------- Scenario C
    // Admin lane: Open survey management -> Creates a step and adds the
    // questions to the step -> Set Required, validation rules -> Click
    // "Create step" -> Step valid and revision current? -> No: error, Yes:
    // save the step as DRAFT -> Previews the step, reorder, and "Save order".
    scenario('Scenario C - Manage the survey steps and the questions as the admin (admin area)', [
      tc('SURV20', 'Test open the survey management screen of the admin area',
        [
          '1. Login with an ADMIN account',
          '2. Click the "Survey Management" entry of the admin menu',
        ],
        [
          '1. Display the "Survey management" page title and the "Manage the survey steps and questions members answer when they sign up." subtitle',
          '2. Display the "Survey steps" list with the position, the name, the status and the actions of every step',
          '3. Display the counters of the All, Active, Draft and Inactive tabs',
        ],
        PRE.admin),
      tc('SURV21', 'Test the survey management of the admin area is not reachable by a content manager',
        [
          '1. Login with a CONTENT_MANAGER account',
          '2. Open the address "/admin/surveys" in the browser',
        ],
        [
          '1. Display the message "You do not have access" and the text "This area is limited to accounts with the ADMIN role."',
          '2. No survey step of the list is displayed',
        ],
        PRE.cm),
      tc('SURV22', 'Test filter and search the survey steps',
        [
          '1. Open the survey management screen',
          '2. Type a step name in the "Search step name" field',
          '3. Click the "Draft" tab of the status filter',
        ],
        [
          '1. Display only the steps whose name contains the typed text',
          '2. Display only the steps of the selected status',
          '3. The counters of the tabs follow the searched steps',
        ],
        PRE.admin),
      tc('SURV23', 'Test create a new survey step',
        [
          '1. Open the survey management screen',
          '2. Click the "Create step" button',
          '3. Enter the "Step name" field with "Mobility check"',
          '4. Enter the description in the "Description" field',
          '5. Click the "Create step" button of the dialog',
        ],
        [
          '1. Display success message: "Mobility check" was created as a draft.',
          '2. The new step appears in the "Survey steps" list with the status "Draft"',
          '3. The step is placed before the result step',
        ],
        PRE.admin),
      tc('SURV24', 'Test the step name is required',
        [
          '1. Open the "Create step" dialog',
          '2. Leave the "Step name" field empty',
          '3. Click the "Create step" button',
        ],
        [
          '1. Display error message: "Step name is required."',
          '2. No step is created',
        ],
        PRE.admin),
      tc('SURV25', 'Test a step name that is already used is rejected',
        [
          '1. Open the "Create step" dialog',
          '2. Enter the "Step name" field with the name of an existing step',
          '3. Click the "Create step" button',
        ],
        [
          '1. Display error message: "A step named \'Mobility check\' already exists in this survey"',
          '2. No step is created',
        ],
        PRE.admin),
      tc('SURV26', 'Test add a question to a survey step',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "New question" button',
          '3. Enter the question title and select the answer type',
          '4. Add the answer options and mark the question as required',
          '5. Click the "Create step" button of the dialog',
        ],
        [
          '1. Display success message: "Mobility check" was created as a draft.',
          '2. The step of the list shows the number of questions of the step',
        ],
        PRE.admin),
      tc('SURV27', 'Test the question validation rules of the step are saved',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "New question" button',
          '3. Enter the question title and select the "Numeric input" answer type',
          '4. Enter an allowed range, a maximum length and the unit of the question',
          '5. Click the "Create step" button of the dialog',
          '6. Open the "Edit step" dialog of the created step',
        ],
        [
          '1. The question is created with the entered range, maximum length and unit',
          '2. The same values are displayed again in the "Update step" dialog',
        ],
        PRE.admin),
      tc('SURV28', 'Test reuse an existing question in a survey step',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "Add existing" button',
          '3. Search a question and click its "Add" button',
          '4. Click the "Create step" button of the dialog',
        ],
        [
          '1. The selected question is added to the list of the step',
          '2. Display success message: "Mobility check" was created as a draft.',
        ],
        PRE.admin),
      tc('SURV29', 'Test a question that is already used in another step is not offered again',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "Add existing" button',
          '3. Search a question that is already linked to another step',
        ],
        [
          '1. The question of the other step is not listed',
          '2. Display the hint "No questions available. Questions used in other steps are hidden." when nothing is left',
        ],
        PRE.admin),
      tc('SURV30', 'Test a question without a label or without an option is rejected',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "New question" button',
          '3. Enter the question title but leave the answer options empty',
          '4. Click the "Create step" button of the dialog',
        ],
        [
          '1. Display error message: "Question 1: add at least one option."',
          '2. No step is created and nothing is saved',
        ],
        PRE.admin),
      tc('SURV31', 'Test the min of the allowed range cannot be greater than the max',
        [
          '1. Open the "Create step" dialog',
          '2. Click the "New question" button',
          '3. Select the "Numeric input" answer type',
          '4. Enter a minimum that is greater than the maximum',
          '5. Click the "Create step" button of the dialog',
        ],
        [
          '1. Display error message: "Question 1: min must not be greater than max."',
          '2. No step is created and nothing is saved',
        ],
        PRE.admin),
      tc('SURV32', 'Test preview a survey step',
        [
          '1. Open the survey management screen',
          '2. Click the "Preview" action of a step',
        ],
        [
          '1. Display the "Preview step" dialog with the caption "Step {{position}} · {{name}} · This is how members see it. Nothing is saved."',
          '2. Display the questions of the step with their answer type',
          '3. Display the "Continue" button of the preview',
        ],
        PRE.admin),
      tc('SURV33', 'Test the answer validation of a step is checked from the preview',
        [
          '1. Open the "Preview" dialog of a step',
          '2. Click the "Continue" button of the preview',
        ],
        [
          '1. Display message: "Some answers would be rejected. Fix the highlighted fields."',
          '2. The rejected answers are highlighted in the preview',
          '3. No answer is saved and no survey session is created',
        ],
        PRE.admin),
      tc('SURV34', 'Test reorder the survey steps and save the order',
        [
          '1. Open the survey management screen',
          '2. Drag a step to another position of the list',
          '3. Click the "Save order" button',
        ],
        [
          '1. Display success message: "Step order saved."',
          '2. The steps are displayed in the new order in the list',
          '3. The result step stays the last step of the list',
        ],
        PRE.admin),
      tc('SURV35', 'Test the result step always stays the last step',
        [
          '1. Open the survey management screen',
          '2. Drag the result step to another position of the list',
          '3. Click the "Save order" button',
        ],
        [
          '1. Display error message: "The result step must stay the last step"',
          '2. The order of the steps stays unchanged',
        ],
        PRE.admin),
      tc('SURV36', 'Test activate a survey step',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of a draft step and click the "Activate" entry',
        ],
        [
          '1. Display success message: "Mobility check" is now active.',
          '2. The status badge of the step changes to "Active"',
          '3. The step becomes visible to the members in the onboarding survey',
        ],
        PRE.admin),
      tc('SURV37', 'Test a step without an active question cannot be activated',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of an empty draft step and click the "Activate" entry',
        ],
        [
          '1. Display error message: "An active step needs at least one active question"',
          '2. The status of the step stays "Draft"',
        ],
        PRE.admin),
      tc('SURV38', 'Test a published step cannot go back to draft',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of an active step and click the "Deactivate" entry',
          '3. Open the action menu of the same step again and try to set it back to "Draft"',
        ],
        [
          '1. The status of the step changes to "Inactive"',
          '2. Display error message: "A published step cannot go back to DRAFT; set it INACTIVE instead"',
        ],
        PRE.admin),
      tc('SURV39', 'Test deactivate a survey step hides it from the members',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of an active step and click the "Deactivate" entry',
        ],
        [
          '1. Display success message: "Mobility check" is now inactive.',
          '2. The status badge of the step changes to "Inactive"',
          '3. The step disappears from the onboarding survey of the members',
        ],
        PRE.admin),
      tc('SURV40', 'Test delete a survey step that no member has answered',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of an inactive step and click the "Delete" entry',
          '3. Confirm the "Delete step?" dialog',
        ],
        [
          '1. Display success message: "Mobility check" was deleted.',
          '2. The step is removed from the "Survey steps" list',
          '3. The questions of the step stay in the question bank',
        ],
        PRE.admin),
      tc('SURV41', 'Test delete a survey step that members have already answered',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of an inactive step that a member has already answered and click the "Delete" entry',
        ],
        [
          '1. Display error message: "Members have already answered questions in this step; set it INACTIVE instead of deleting it"',
          '2. The step stays in the "Survey steps" list',
        ],
        PRE.admin),
      tc('SURV42', 'Test the result step cannot be deleted',
        [
          '1. Open the survey management screen',
          '2. Open the action menu of the result step and click the "Delete" entry',
        ],
        [
          '1. Display error message: "The result step cannot be deleted; set it INACTIVE to hide it"',
          '2. The result step stays the last step of the list',
        ],
        PRE.admin),
      tc('SURV43', 'Test configure the result step',
        [
          '1. Open the survey management screen',
          '2. Click the "Configure" action of the result step',
          '3. Set the plan length, the sessions per week and the minutes per session',
          '4. Enable the "Show level breakdown" and the "Show training plan preview" toggles',
          '5. Click the "Save changes" button',
        ],
        [
          '1. Display success message: "Mobility check" was saved.',
          '2. The configured values are displayed when the result step is previewed again',
        ],
        PRE.admin),
      tc('SURV44', 'Test the recommended plan configuration is rejected when a number is out of range',
        [
          '1. Open the "Configure result" dialog of the result step',
          '2. Enter a value out of the accepted range in the "Plan length" field',
          '3. Click the "Save changes" button',
        ],
        [
          '1. Display error message: "{{label}} must be a whole number from {{min}} to {{max}}."',
          '2. The configuration is not saved',
        ],
        PRE.admin),
    ]),

    // ---------------------------------------------------------------- Scenario D
    // Member lane: Log in -> Survey completed? -> No: Survey session already
    // started? -> Yes: resume the session, No: start a new session -> Answer each
    // step and click "Continue" -> Validate and save the answers.
    scenario('Scenario D - Walk through the onboarding survey steps', [
      tc('SURV45', 'Test the survey definition is loaded on the first survey screen',
        [
          '1. Login with a MEMBER account that has not answered the survey yet',
          '2. Open the "Find your fitness level" reminder and click the "Take the survey" button',
        ],
        [
          '1. Display the survey screen with the title "Your body stats"',
          '2. Display the progress indicator "Step 1 of 4"',
          '3. Display the questions of the "Body information" step with the required flag',
        ],
        PRE.memberNew),
      tc('SURV46', 'Test answer the "Body information" step',
        [
          '1. Open the onboarding survey',
          '2. Select "Male" in the "What is your gender?" question',
          '3. Enter "22" in the "How old are you?" question',
          '4. Enter "170" in the "What is your height?" question',
          '5. Enter "65" in the "What is your weight?" question',
          '6. Click the "Continue" button',
        ],
        [
          '1. Display the next step "Why do you train?"',
          '2. Display the progress indicator "Step 2 of 4"',
          '3. The answers of the body information step are saved',
        ],
        PRE.memberNew),
      tc('SURV47', 'Test answer the "Goals and motivation" step',
        [
          '1. Open the onboarding survey',
          '2. Select "For health" in the "What is your main goal?" question',
          '3. Select "Lose weight" in the "Which health goal fits you best?" question',
          '4. Select "Health" and "More energy" in the "What motivates you to train?" question',
          '5. Click the "Continue" button',
        ],
        [
          '1. Display the next step "How do you train now?"',
          '2. Display the progress indicator "Step 3 of 4"',
          '3. The answers of the goals step are saved',
        ],
        PRE.memberNew),
      tc('SURV48', 'Test answer the "Current training routine" step',
        [
          '1. Open the onboarding survey',
          '2. Select "Under 6 months" in the "How long have you been training?" question',
          '3. Enter "3" in the "How many days per week have you trained?" question',
          '4. Select "About 30 minutes" in the "How long is each training session?" question',
          '5. Click the "Continue" button',
        ],
        [
          '1. Display the next step "Test your level"',
          '2. Display the progress indicator "Step 4 of 4"',
          '3. The answers of the training routine step are saved',
        ],
        PRE.memberNew),
      tc('SURV49', 'Test the required field validation of the survey',
        [
          '1. Open the onboarding survey',
          '2. Leave every question of the current step unanswered',
          '3. Click the "Continue" button',
        ],
        [
          '1. Display error message: "This field is required" under each unanswered required question',
          '2. The survey stays on the current step',
        ],
        PRE.memberNew),
      tc('SURV50', 'Test the numeric validation of the survey answers',
        [
          '1. Open the onboarding survey',
          '2. Enter "abc" in the "What is your height?" question',
          '3. Enter "65.555" in the "What is your weight?" question',
          '4. Click the "Continue" button',
        ],
        [
          '1. Display error message: "Please enter a valid number" for the height',
          '2. Display error message: "Use at most 1 decimal place(s)" for the weight',
          '3. The survey stays on the current step',
        ],
        PRE.memberNew),
      tc('SURV51', 'Test the selection limit of the multi-select survey questions',
        [
          '1. Open the onboarding survey',
          '2. Select four options in the "What motivates you to train?" question',
          '3. Click the "Continue" button',
        ],
        [
          '1. Display error message: "Select at most 3 options"',
          '2. The survey stays on the current step',
        ],
        PRE.memberNew),
      tc('SURV52', 'Test skip an optional step of the survey',
        [
          '1. Open the onboarding survey',
          '2. Click the "Skip for now" button on an optional step',
        ],
        [
          '1. The survey moves to the next step',
          '2. The skipped step is recorded as skipped in the survey session',
        ],
        PRE.memberNew),
      tc('SURV53', 'Test resume a survey session that was left in progress',
        [
          '1. Answer the "Body information" step and close the browser',
          '2. Login with the same MEMBER account again',
          '3. Open the onboarding survey',
        ],
        [
          '1. Display the step where the session was left',
          '2. Display the answers that were already saved',
          '3. No second survey session is created for the member',
        ],
        PRE.memberNew),
      tc('SURV54', 'Test a second in-progress survey session cannot be created',
        [
          '1. Leave a survey session in progress',
          '2. Open the onboarding survey again from another browser tab',
        ],
        [
          '1. Display error message: "An in-progress session was just created; call this endpoint again to resume it"',
          '2. The existing survey session is kept and resumed',
        ],
        PRE.memberNew),
      tc('SURV55', 'Test the survey session of another member cannot be opened',
        [
          '1. Login with a MEMBER account',
          '2. Open the address of a survey session that belongs to another member',
        ],
        [
          '1. Display error message: "Survey session not found"',
          '2. No answer of the other member is displayed',
        ],
        PRE.member),
      tc('SURV56', 'Test the answers of a completed survey session cannot be changed',
        [
          '1. Complete the onboarding survey',
          '2. Open the address of the completed survey session and try to submit new answers',
        ],
        [
          '1. Display error message: "This survey session is completed and can no longer be changed"',
          '2. The saved answers stay unchanged',
        ],
        PRE.memberOnboarded),
    ]),

    // ---------------------------------------------------------------- Scenario E
    // Level test -> Click "Finish" -> Score with the benchmark table -> Apply the
    // rules -> Match the total score to a level range -> Build the recommended
    // plan -> Save the answers to database -> See the level result and breakdown.
    scenario('Scenario E - Take the level test and read the level result', [
      tc('SURV57', 'Test answer the "Level test" step',
        [
          '1. Open the onboarding survey',
          '2. Answer the level test questions for "Push-up", "Squat", "Plank", "Burpee", "Dips" and "Pull-up"',
          '3. Click the "Continue" button',
        ],
        [
          '1. Display the survey result screen with the eyebrow "Result & recommended plan"',
          '2. Display the title "Your results are in"',
        ],
        PRE.memberNew),
      tc('SURV58', 'Test the level result and the score breakdown',
        [
          '1. Complete the onboarding survey',
          '2. Open the survey result screen',
        ],
        [
          '1. Display "Your current level" with the assessed level name',
          '2. Display "Your test results" with the point scored by each benchmark exercise',
          '3. Display "Your starting benchmark" with the recommended training plan',
          '4. Display the weekly rhythm of the recommended plan',
        ],
        PRE.memberOnboarded),
      tc('SURV59', 'Test a member who scores zero on a benchmark exercise starts at the lowest level',
        [
          '1. Answer "0" for one benchmark exercise of the level test',
          '2. Complete the onboarding survey',
          '3. Open the survey result screen',
        ],
        [
          '1. Display the lowest active level in the "Your current level" section',
          '2. Display the summary "One exercise was not completed, so you start at the lowest level."',
        ],
        PRE.memberNew),
      tc('SURV60', 'Test an unbalanced level test result costs one level',
        [
          '1. Answer a strong result for one benchmark exercise and a weak result for another',
          '2. Complete the onboarding survey',
          '3. Open the survey result screen',
        ],
        [
          '1. The assessed level is one level below the level of the total score',
          '2. Display the summary "Your results were uneven, so we placed you one level lower."',
        ],
        PRE.memberNew),
      tc('SURV61', 'Test the level result when the member cannot be assessed',
        [
          '1. Skip the level test step of the onboarding survey',
          '2. Complete the onboarding survey',
          '3. Open the survey result screen',
        ],
        [
          '1. Display message: "We could not assess your level from your answers. You can retake the survey any time."',
          '2. Display the "Retake survey" action',
        ],
        PRE.memberNew),
      tc('SURV62', 'Test the level test cannot be completed while a required step is unanswered',
        [
          '1. Answer the "Body information" step only',
          '2. Open the survey result screen directly through the browser address',
        ],
        [
          '1. The survey result screen is not displayed',
          '2. The member is returned to the unfinished step of the survey',
        ],
        PRE.memberNew),
      tc('SURV63', 'Test retake the level test from the result screen',
        [
          '1. Complete the onboarding survey',
          '2. Click the "Retake survey" button on the survey result screen',
          '3. Answer the level test again and click the "Continue" button',
        ],
        [
          '1. Display the "Level test" step again',
          '2. The survey result screen shows the updated level and the updated breakdown',
        ],
        PRE.memberOnboarded),
    ]),

    // ---------------------------------------------------------------- Scenario F
    // The result step configures the recommended plan: the member previews the
    // plan and starts it.
    scenario('Scenario F - Preview and start the recommended training plan', [
      tc('SURV64', 'Test preview the recommended training plan',
        [
          '1. Complete the onboarding survey',
          '2. Click the "Preview training plan" button on the survey result screen',
        ],
        [
          '1. Display the "Preview training plan" dialog',
          '2. Display the 30-day month calendar with the training days and the recovery days',
          '3. Display the plan name, the level, the sessions per week and the duration per session',
        ],
        PRE.memberOnboarded),
      tc('SURV65', 'Test start the recommended training plan',
        [
          '1. Complete the onboarding survey',
          '2. Click the "Start my training plan" button on the survey result screen',
        ],
        [
          '1. Display success message: "Your plan is ready"',
          '2. Redirect to the Dashboard screen',
          '3. The workout schedule of the member is filled with the training days of the plan',
        ],
        PRE.memberOnboarded),
      tc('SURV66', 'Test the recommended plan cannot be started twice',
        [
          '1. Start the recommended training plan from the survey result screen',
          '2. Reopen the survey result screen and click the "Start my training plan" button again',
        ],
        [
          '1. Display error message: "We could not start your training plan. Please try again."',
          '2. The existing training plan is kept unchanged',
        ],
        PRE.memberOnboarded),
      tc('SURV67', 'Test the recommended plan uses the desired training days of the survey',
        [
          '1. Answer "4" in the "How many days per week do you want to train with Calishealth" question',
          '2. Complete the onboarding survey',
          '3. Open the survey result screen',
        ],
        [
          '1. Display "4 sessions / week" in the recommended plan',
          '2. The weekly rhythm of the plan shows 4 training days',
        ],
        PRE.memberNew),
    ]),
  ],
};
