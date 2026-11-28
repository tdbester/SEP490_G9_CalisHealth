/**
 * Index of the Report 5.3 system test case catalogue.
 * The order matches the "Main Business Flow" diagram BF-01 .. BF-09 and the
 * order of the sheets in the report workbook.
 */
module.exports = [
  require('./bf01-authentication'),
  require('./bf02-onboarding'),
  require('./bf03-pose-tracking'),
  require('./bf04-tracking'),
  require('./bf05-health-exercise-library'),
  require('./bf06-member-exercise-library'),
  require('./bf07-custom-workout-library'),
  require('./bf08-health-workout-library'),
  require('./bf09-feedback'),
];
