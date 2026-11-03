// Auth fields (email, password) only accept ASCII characters.
// A Vietnamese IME in Vietnamese mode produces accented characters, which we detect here.
export function hasNonAscii(value) {
  return /[^\x00-\x7F]/.test(value);
}

// Same rule as the backend StrongPasswordValidator: 8+ chars, upper, lower, digit, and any other char.
export const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a digit and a special character";

export function isStrongPassword(value) {
  if (!value || value.length < 8) return false;
  let upper = false, lower = false, digit = false, special = false;
  for (const c of value) {
    if (c !== c.toLowerCase()) upper = true;
    else if (c !== c.toUpperCase()) lower = true;
    else if (/[0-9]/.test(c)) digit = true;
    else special = true;
  }
  return upper && lower && digit && special;
}

// Field-level messages from a 400 validation response ({ errors: { field: message } }).
export function fieldErrors(err) {
  const errors = err?.response?.data?.errors;
  return errors && typeof errors === "object" ? errors : {};
}

export const IME_WARNING_MESSAGE =
  "Accented characters detected. Switch your input method to English and type again.";
