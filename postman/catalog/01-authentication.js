/**
 * Feature: Authentication
 * Covers AuthController (/api/auth/**) and ProfileController (/api/profile/**).
 * Source: server/src/main/java/com/calishealth/controllers/{AuthController,ProfileController}.java
 */
const { E, ROLE, PRE_AUTH, PRE_GUEST } = require('./_helpers');

const F = 'Authentication';

module.exports = [
  // ---------------------------------------------------------------- Login
  E('auth-login-valid', 'POST', '/api/auth/login', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Login successfully with valid email and password of a verified MEMBER account',
    proc: [
      'Run request "POST /api/auth/login" from the Postman collection folder "Authentication > Login"',
      'Body: email = "member.calishealth@gmail.com", password = "P@ssword1"',
      'Send the request without an Authorization header',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains "token" (JWT), "email", "fullName", "role" = "MEMBER" and "mustChangePassword" = false',
      'Response body does NOT contain the plain-text password',
    ],
    pre: [...PRE_GUEST, '3. The account exists, is email-verified (enabled = true) and is not blocked'],
    body: { email: 'member.calishealth@gmail.com', password: 'P@ssword1' },
    expect: [200],
    tests: ['Response body has a non-empty "token" property', 'Response body "role" equals "MEMBER"'],
  }),
  E('auth-login-wrong-password', 'POST', '/api/auth/login', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Login fails when the password does not match the registered account',
    proc: [
      'Run request "POST /api/auth/login" from the Postman collection folder "Authentication > Login"',
      'Body: email = "member.calishealth@gmail.com", password = "WrongPass123"',
      'Send the request',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'Response body contains a "message" describing that email or password is incorrect',
      'No "token" property is present in the response body',
    ],
    results: [
      'Display error message: "Email or password is incorrect."',
      'No session token is issued, so the member stays on the Log in screen',
    ],
    pre: [...PRE_GUEST, '3. The account member.calishealth@gmail.com exists and is verified'],
    body: { email: 'member.calishealth@gmail.com', password: 'WrongPass123' },
    expect: [401],
    tests: ['Response body does NOT have a "token" property'],
  }),
  E('auth-login-email-not-verified', 'POST', '/api/auth/login', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Login is rejected for an account that has not verified its email address yet',
    proc: [
      'Register a new account through "POST /api/auth/register" (the account stays unverified)',
      'Run request "POST /api/auth/login" from the Postman collection folder "Authentication > Login"',
      'Body: email = "unverified.calishealth@gmail.com", password = "P@ssword1"',
    ],
    exp: [
      'HTTP 403 Forbidden is returned',
      'Response body message states the account has not been email-verified yet',
    ],
    results: [
      'Display error message: "This account has not been verified or is not allowed to sign in."',
      'No session token is issued, so the member stays on the Log in screen',
    ],
    pre: [...PRE_GUEST, '3. The account exists but enabled = false (email not verified)'],
    body: { email: 'unverified.calishealth@gmail.com', password: 'P@ssword1' },
    expect: [403],
  }),
  E('auth-login-invalid-email-format', 'POST', '/api/auth/login', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Login request is rejected when the email does not have a valid format',
    proc: [
      'Run request "POST /api/auth/login" from the Postman collection folder "Authentication > Login"',
      'Body: email = "not-an-email", password = "P@ssword1"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body contains a field-level validation error for "email"',
    ],
    results: [
      'Display error message: "Invalid data"',
      'The email field is highlighted and the member stays on the Log in screen',
    ],
    pre: [...PRE_GUEST],
    body: { email: 'not-an-email', password: 'P@ssword1' },
    expect: [400],
  }),
  E('auth-login-empty-body', 'POST', '/api/auth/login', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Login request is rejected when email and password are missing',
    proc: [
      'Run request "POST /api/auth/login" from the Postman collection folder "Authentication > Login"',
      'Body: {} (both fields removed)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports validation errors for the missing "email" and "password" fields',
    ],
    results: [
      'Display error message: "Invalid data"',
      'The email and the password fields are highlighted and the member stays on the Log in screen',
    ],
    pre: [...PRE_GUEST],
    body: {},
    expect: [400],
  }),
  E('auth-me', 'GET', '/api/auth/me', {
    feature: F, section: 'Login', role: ROLE.MEMBER,
    desc: 'Retrieve the profile of the currently authenticated user',
    proc: [
      'Run request "GET /api/auth/me" from the Postman collection folder "Authentication > Login"',
      'Send it with header Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the "email" and "fullName" of the logged-in member',
      'Response body contains "role" and "mustChangePassword"',
      'The "token" property is null (the endpoint does not re-issue a token)',
    ],
    pre: [...PRE_AUTH, '3. The Authorization header carries a valid JWT of that member'],
    expect: [200],
    tests: ['Response body "email" equals "member.calishealth@gmail.com"'],
  }),
  E('auth-me-unauthenticated', 'GET', '/api/auth/me', {
    feature: F, section: 'Login', role: ROLE.NONE,
    desc: 'Protected "me" endpoint rejects a request that carries no Authorization header',
    proc: [
      'Run request "GET /api/auth/me" from the Postman collection folder "Authentication > Login"',
      'Remove the Authorization header (or set it to an empty value)',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No user data is disclosed in the response body',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),

  // ---------------------------------------------------------------- Register
  E('auth-register-success', 'POST', '/api/auth/register', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Register a new member account and trigger the verification email',
    proc: [
      'Run request "POST /api/auth/register" from the Postman collection folder "Authentication > Register"',
      'Body: fullName / email / password / confirmPassword as shown in the request',
      'Use an email address that does not exist in the system yet',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body "message" confirms the registration succeeded and asks the user to check email',
      'A verification email containing a token is sent to the registered address',
    ],
    pre: [...PRE_GUEST, '3. The email address is not already registered'],
    body: {
      fullName: 'Test Member',
      email: 'newmember.calishealth@gmail.com',
      password: 'P@ssword1',
      confirmPassword: 'P@ssword1',
    },
    expect: [200],
  }),
  E('auth-register-duplicate-email', 'POST', '/api/auth/register', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Register is rejected when the email address is already taken',
    proc: [
      'Run request "POST /api/auth/register" from the Postman collection folder "Authentication > Register"',
      'Body: email = "member.calishealth@gmail.com" (an address that already exists)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the email has already been registered',
      'No new user row is created',
    ],
    pre: [...PRE_GUEST, '3. The email address member.calishealth@gmail.com already exists'],
    body: {
      fullName: 'Test Member',
      email: 'member.calishealth@gmail.com',
      password: 'P@ssword1',
      confirmPassword: 'P@ssword1',
    },
    expect: [400],
  }),
  E('auth-register-password-mismatch', 'POST', '/api/auth/register', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Register is rejected when confirmPassword does not match password',
    proc: [
      'Run request "POST /api/auth/register" from the Postman collection folder "Authentication > Register"',
      'Body: password = "P@ssword1", confirmPassword = "P@ssword2"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the confirmation password does not match',
    ],
    pre: [...PRE_GUEST],
    body: {
      fullName: 'Test Member',
      email: 'newmember.calishealth@gmail.com',
      password: 'P@ssword1',
      confirmPassword: 'P@ssword2',
    },
    expect: [400],
  }),
  E('auth-register-weak-password', 'POST', '/api/auth/register', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Register is rejected when the password does not meet the strong-password policy',
    proc: [
      'Run request "POST /api/auth/register" from the Postman collection folder "Authentication > Register"',
      'Body: password = "weak" (no upper case, digit or special character)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the password does not satisfy the strong-password requirement',
    ],
    pre: [...PRE_GUEST],
    body: {
      fullName: 'Test Member',
      email: 'newmember.calishealth@gmail.com',
      password: 'weak',
      confirmPassword: 'weak',
    },
    expect: [400],
  }),
  E('auth-register-missing-fullname', 'POST', '/api/auth/register', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Register is rejected when fullName is blank',
    proc: [
      'Run request "POST /api/auth/register" from the Postman collection folder "Authentication > Register"',
      'Body: fullName = "" (empty string)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports a validation error for "fullName"',
    ],
    pre: [...PRE_GUEST],
    body: {
      fullName: '',
      email: 'newmember.calishealth@gmail.com',
      password: 'P@ssword1',
      confirmPassword: 'P@ssword1',
    },
    expect: [400],
  }),
  E('auth-verify-token-check', 'GET', '/api/auth/verify', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Check that an email verification token is valid before activating the account',
    proc: [
      'Run request "GET /api/auth/verify" from the Postman collection folder "Authentication > Register"',
      'Query param: token = the UUID received in the verification email',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message confirms the verification link is valid',
      'The account is not yet activated by this request',
    ],
    pre: [...PRE_GUEST, '3. A verification email with a valid token has been received'],
    query: { token: '{{verifyToken}}' },
    expect: [200],
  }),
  E('auth-verify-token-invalid', 'GET', '/api/auth/verify', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Verification link check fails for an invalid or already used token',
    proc: [
      'Run request "GET /api/auth/verify" from the Postman collection folder "Authentication > Register"',
      'Query param: token = "00000000-0000-0000-0000-000000000000"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the link is invalid or has already been used',
    ],
    pre: [...PRE_GUEST],
    query: { token: '00000000-0000-0000-0000-000000000000' },
    expect: [400],
  }),
  E('auth-verify-email', 'POST', '/api/auth/verify', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Activate the account by confirming the email verification token',
    proc: [
      'Run request "POST /api/auth/verify" from the Postman collection folder "Authentication > Register"',
      'Query param: token = the UUID received in the verification email',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message confirms the email was verified and the user can now log in',
      'The account becomes enabled, so a subsequent login returns HTTP 200',
    ],
    pre: [...PRE_GUEST, '3. A verification email with a valid token has been received'],
    query: { token: '{{verifyToken}}' },
    expect: [200],
  }),
  E('auth-verify-email-invalid-token', 'POST', '/api/auth/verify', {
    feature: F, section: 'Register', role: ROLE.NONE,
    desc: 'Email activation fails when the verification token is invalid or expired',
    proc: [
      'Run request "POST /api/auth/verify" from the Postman collection folder "Authentication > Register"',
      'Query param: token = "11111111-1111-1111-1111-111111111111"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the link is invalid, already used or expired',
      'The account remains disabled',
    ],
    pre: [...PRE_GUEST],
    query: { token: '11111111-1111-1111-1111-111111111111' },
    expect: [400],
  }),

  // ---------------------------------------------------------------- Forgot password
  E('auth-forgot-password-success', 'POST', '/api/auth/forgot-password', {
    feature: F, section: 'Forgot password', role: ROLE.NONE,
    desc: 'Request a password reset link for an existing email address',
    proc: [
      'Run request "POST /api/auth/forgot-password" from the Postman collection folder "Authentication > Forgot password"',
      'Body: email = "member.calishealth@gmail.com"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message states that, if the email exists, a reset link has been sent',
      'A password reset email containing a token is sent; the token is valid for 30 minutes',
    ],
    pre: [...PRE_GUEST, '3. The email address member.calishealth@gmail.com is registered'],
    body: { email: 'member.calishealth@gmail.com' },
    expect: [200],
  }),
  E('auth-forgot-password-nonexistent-email', 'POST', '/api/auth/forgot-password', {
    feature: F, section: 'Forgot password', role: ROLE.NONE,
    desc: 'Forgot password does not reveal whether an email address exists',
    proc: [
      'Run request "POST /api/auth/forgot-password" from the Postman collection folder "Authentication > Forgot password"',
      'Body: email = "nobody.calishealth@gmail.com" (address that does not exist)',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'The response message is identical to the message returned for an existing email address',
      'No reset email is sent',
    ],
    pre: [...PRE_GUEST],
    body: { email: 'nobody.calishealth@gmail.com' },
    expect: [200],
  }),
  E('auth-forgot-password-invalid-email', 'POST', '/api/auth/forgot-password', {
    feature: F, section: 'Forgot password', role: ROLE.NONE,
    desc: 'Forgot password request is rejected when the email format is invalid',
    proc: [
      'Run request "POST /api/auth/forgot-password" from the Postman collection folder "Authentication > Forgot password"',
      'Body: email = "invalid-email"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports a validation error for the "email" field',
    ],
    pre: [...PRE_GUEST],
    body: { email: 'invalid-email' },
    expect: [400],
  }),

  // ---------------------------------------------------------------- Reset password
  E('auth-verify-reset-token-valid', 'GET', '/api/auth/verify-reset-token', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Check that a password reset token is still valid before showing the reset form',
    proc: [
      'Run request "GET /api/auth/verify-reset-token" from the Postman collection folder "Authentication > Reset password"',
      'Query param: token = the UUID received in the password reset email',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message confirms the password reset token is valid',
    ],
    pre: [...PRE_GUEST, '3. A password reset email with a valid token has been received'],
    query: { token: '{{resetToken}}' },
    expect: [200],
  }),
  E('auth-verify-reset-token-invalid', 'GET', '/api/auth/verify-reset-token', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Reset token check fails for an unknown or expired token',
    proc: [
      'Run request "GET /api/auth/verify-reset-token" from the Postman collection folder "Authentication > Reset password"',
      'Query param: token = "22222222-2222-2222-2222-222222222222"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the reset token is invalid or expired',
    ],
    pre: [...PRE_GUEST],
    query: { token: '22222222-2222-2222-2222-222222222222' },
    expect: [400],
  }),
  E('auth-reset-password-success', 'POST', '/api/auth/reset-password', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Set a new password using the token from the password reset email',
    proc: [
      'Run request "POST /api/auth/reset-password" from the Postman collection folder "Authentication > Reset password"',
      'Body: token = the UUID from the reset email, newPassword / confirmNewPassword = "NewP@ss1"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message confirms the password was reset and the user must log in again',
      'Logging in with the new password succeeds and returns a JWT',
      'The reset token cannot be reused a second time',
    ],
    pre: [...PRE_GUEST, '3. A valid password reset token has been received'],
    body: {
      token: '{{resetToken}}',
      newPassword: 'NewP@ss1',
      confirmNewPassword: 'NewP@ss1',
    },
    expect: [200],
  }),
  E('auth-reset-password-mismatch', 'POST', '/api/auth/reset-password', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Reset password is rejected when the confirmation of the new password does not match',
    proc: [
      'Run request "POST /api/auth/reset-password" from the Postman collection folder "Authentication > Reset password"',
      'Body: newPassword = "NewP@ss1", confirmNewPassword = "NewP@ss2"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the confirmation password does not match',
      'The old password remains valid',
    ],
    pre: [...PRE_GUEST, '3. A valid password reset token has been received'],
    body: {
      token: '{{resetToken}}',
      newPassword: 'NewP@ss1',
      confirmNewPassword: 'NewP@ss2',
    },
    expect: [400],
  }),
  E('auth-reset-password-expired-token', 'POST', '/api/auth/reset-password', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Reset password fails when the token has expired',
    proc: [
      'Run request "POST /api/auth/reset-password" from the Postman collection folder "Authentication > Reset password"',
      'Body: token = an expired token, newPassword = "NewP@ss1", confirmNewPassword = "NewP@ss1"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body states the token is invalid or expired',
      'The password is not changed',
    ],
    pre: [...PRE_GUEST, '3. A reset token older than 30 minutes is available'],
    body: {
      token: '{{expiredResetToken}}',
      newPassword: 'NewP@ss1',
      confirmNewPassword: 'NewP@ss1',
    },
    expect: [400],
  }),
  E('auth-change-password', 'POST', '/api/auth/change-password', {
    feature: F, section: 'Reset password', role: ROLE.MEMBER,
    desc: 'Change the password of the logged-in account while staying authenticated',
    proc: [
      'Run request "POST /api/auth/change-password" from the Postman collection folder "Authentication > Reset password"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: oldPassword = "P@ssword1", newPassword / confirmNewPassword = "ChgP@ss1"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body message confirms the password was changed',
      'The old password no longer works for login; the new password does',
      'The current session token stays valid',
    ],
    pre: [...PRE_AUTH, '3. The member knows the current password'],
    body: {
      oldPassword: 'P@ssword1',
      newPassword: 'ChgP@ss1',
      confirmNewPassword: 'ChgP@ss1',
    },
    expect: [200],
  }),
  E('auth-change-password-wrong-old-password', 'POST', '/api/auth/change-password', {
    feature: F, section: 'Reset password', role: ROLE.MEMBER,
    desc: 'Change password is rejected when the current password is incorrect',
    proc: [
      'Run request "POST /api/auth/change-password" from the Postman collection folder "Authentication > Reset password"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: oldPassword = "WrongOld123", newPassword / confirmNewPassword = "ChgP@ss1"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned (or 401 when the session is invalid)',
      'Response body explains that the current password is incorrect',
      'The password is not changed',
    ],
    pre: [...PRE_AUTH],
    body: {
      oldPassword: 'WrongOld123',
      newPassword: 'ChgP@ss1',
      confirmNewPassword: 'ChgP@ss1',
    },
    expect: [400, 401],
  }),
  E('auth-change-password-unauthenticated', 'POST', '/api/auth/change-password', {
    feature: F, section: 'Reset password', role: ROLE.NONE,
    desc: 'Change password rejects a request without a valid session token',
    proc: [
      'Run request "POST /api/auth/change-password" from the Postman collection folder "Authentication > Reset password"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'The password is not changed',
    ],
    pre: [...PRE_GUEST],
    body: {
      oldPassword: 'P@ssword1',
      newPassword: 'ChgP@ss1',
      confirmNewPassword: 'ChgP@ss1',
    },
    expect: [401],
  }),

  // ---------------------------------------------------------------- Profile information
  E('profile-get', 'GET', '/api/profile', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'View the profile information of the logged-in member',
    proc: [
      'Run request "GET /api/profile" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the member full name, email, phone, gender and date of birth',
      'Response body contains the avatar URL and the last password change timestamp',
    ],
    pre: [...PRE_AUTH],
    expect: [200],
  }),
  E('profile-update', 'PUT', '/api/profile', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Update the profile information of the logged-in member',
    proc: [
      'Run request "PUT /api/profile" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: fullName / phone / gender / dateOfBirth as shown in the request',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body reflects the updated values (full name, phone, gender, date of birth)',
      'A subsequent "GET /api/profile" returns the same updated values',
    ],
    pre: [...PRE_AUTH],
    body: {
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      gender: 'MALE',
      dateOfBirth: '1995-05-20',
    },
    expect: [200],
  }),
  E('profile-update-invalid-phone', 'PUT', '/api/profile', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Profile update is rejected when the phone number has an invalid format',
    proc: [
      'Run request "PUT /api/profile" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: phone = "abc" (not a valid phone number)',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports a validation error for the "phone" field',
      'The stored phone number is unchanged',
    ],
    pre: [...PRE_AUTH],
    body: { phone: 'abc' },
    expect: [400],
  }),
  E('profile-update-future-dob', 'PUT', '/api/profile', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Profile update is rejected when the date of birth lies in the future',
    proc: [
      'Run request "PUT /api/profile" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: dateOfBirth = "2099-01-01"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the date of birth must be in the past',
    ],
    pre: [...PRE_AUTH],
    body: { dateOfBirth: '2099-01-01' },
    expect: [400],
  }),
  E('profile-upload-avatar', 'POST', '/api/profile/avatar', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Upload a new profile avatar image',
    proc: [
      'Run request "POST /api/profile/avatar" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: form-data with the file part "file" pointing at a local PNG/JPEG image',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body contains the new avatar URL',
      'The avatar is retrievable through the public media path /media/profile-avatars/**',
    ],
    pre: [...PRE_AUTH, '3. A valid image file (PNG/JPEG, within the configured size limit) is available locally'],
    form: { file: '@C:/calishealth-testdata/avatar.png' },
    expect: [200],
  }),
  E('profile-upload-avatar-invalid-type', 'POST', '/api/profile/avatar', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Avatar upload is rejected when the file type is not a supported image',
    proc: [
      'Run request "POST /api/profile/avatar" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: form-data with the file part "file" pointing at a plain text file',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body explains that the file type is not allowed',
      'The stored avatar is not replaced',
    ],
    pre: [...PRE_AUTH, '3. A .txt file is available locally'],
    form: { file: '@C:/calishealth-testdata/not-an-image.txt' },
    expect: [400],
  }),
  E('profile-delete-avatar', 'DELETE', '/api/profile/avatar', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Remove the current profile avatar',
    proc: [
      'Run request "DELETE /api/profile/avatar" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body no longer contains an avatar URL',
      'The avatar image is no longer served from /media/profile-avatars/**',
    ],
    pre: [...PRE_AUTH, '3. The member currently has an avatar uploaded'],
    expect: [200],
  }),
  E('profile-change-password', 'POST', '/api/profile/password', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Change the own password from the Profile Information screen',
    proc: [
      'Run request "POST /api/profile/password" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: currentPassword = "P@ssword1", newPassword / confirmNewPassword = "Pr0file1"',
    ],
    exp: [
      'HTTP 200 OK is returned',
      'Response body confirms the password was changed',
      'The old password can no longer be used to log in; the new password can',
    ],
    pre: [...PRE_AUTH, '3. The member knows the current password'],
    body: {
      currentPassword: 'P@ssword1',
      newPassword: 'Pr0file1',
      confirmNewPassword: 'Pr0file1',
    },
    expect: [200],
  }),
  E('profile-change-password-mismatch', 'POST', '/api/profile/password', {
    feature: F, section: 'Profile information', role: ROLE.MEMBER,
    desc: 'Profile password change is rejected when the confirmation does not match',
    proc: [
      'Run request "POST /api/profile/password" from the Postman collection folder "Authentication > Profile information"',
      'Header: Authorization = "Bearer {{memberToken}}"',
      'Body: newPassword = "Pr0file1", confirmNewPassword = "Pr0file2"',
    ],
    exp: [
      'HTTP 400 Bad Request is returned',
      'Response body reports that the confirmation password does not match',
      'The password is not changed',
    ],
    pre: [...PRE_AUTH],
    body: {
      currentPassword: 'P@ssword1',
      newPassword: 'Pr0file1',
      confirmNewPassword: 'Pr0file2',
    },
    expect: [400],
  }),
  E('profile-get-unauthenticated', 'GET', '/api/profile', {
    feature: F, section: 'Profile information', role: ROLE.NONE,
    desc: 'Profile endpoint rejects unauthenticated requests',
    proc: [
      'Run request "GET /api/profile" from the Postman collection folder "Authentication > Profile information"',
      'Remove the Authorization header',
    ],
    exp: [
      'HTTP 401 Unauthorized is returned',
      'No profile data is returned',
    ],
    pre: [...PRE_GUEST],
    expect: [401],
  }),
];
