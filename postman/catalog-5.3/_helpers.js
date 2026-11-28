/**
 * Test case content for Report 5.3 - System Test (Functional Requirements).
 *
 * Each workflow of the "Main Business Flow" diagram (BF-01 .. BF-09) maps to
 * one sheet of the report. A workflow is split into the scenarios of the
 * diagram (the swimlane branches and their decision points), and every
 * scenario owns the test cases that verify it.
 *
 * Every case is written the way an end user exercises the product:
 *   desc  : one line describing what is verified
 *   proc  : numbered steps performed on the screens of the React client
 *   exp   : numbered observable results shown on the screens
 *   pre   : numbered pre-conditions required before the case runs
 */

/** Testing rounds of the report. */
const ROUNDS = [
  { status: 'Passed', date: '2026-11-25', tester: 'VinhHL' },
  { status: 'Passed', date: '2026-11-25', tester: 'VinhHL' },
  { status: 'Passed', date: '2026-11-26', tester: 'AnhNHH' },
];

/** Shared pre-condition blocks. */
const PRE = {
  guest: ['1. Access to CalisHealth via link'],
  member: [
    '1. Access to CalisHealth via link',
    '2. Login with a MEMBER account',
    '3. The member is signed in with a valid session',
  ],
  memberOnboarded: [
    '1. Access to CalisHealth via link',
    '2. Login with a MEMBER account',
    '3. The member has completed the onboarding survey and has a training plan',
  ],
  memberNew: [
    '1. Access to CalisHealth via link',
    '2. Login with a MEMBER account that has just been created',
    '3. The onboarding survey has not been answered yet',
  ],
  cm: [
    '1. Access to CalisHealth via link',
    '2. Login with a CONTENT_MANAGER account',
    '3. The content manager is signed in with a valid session',
  ],
  admin: [
    '1. Access to CalisHealth via link',
    '2. Login with an ADMIN account',
    '3. The administrator is signed in with a valid session',
  ],
  memberWithVideo: [
    '1. Access to CalisHealth via link',
    '2. Login with a MEMBER account',
    '3. The member is signed in with a valid session',
    '4. The device has a working camera and the browser allows camera access',
  ],
};

/** Scenario container helper. */
function scenario(name, cases) {
  return { name, cases };
}

/**
 * Case helper.
 * The round status / date / tester triplets default to the report rounds;
 * a case may override them by passing an array of three triplets.
 */
function tc(id, desc, proc, exp, pre, rounds) {
  return { id, desc, proc, exp, pre, rounds: rounds || ROUNDS };
}

module.exports = { PRE, scenario, tc, ROUNDS };
