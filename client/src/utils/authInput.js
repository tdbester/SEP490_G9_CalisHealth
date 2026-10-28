// Auth fields (email, password) only accept ASCII characters.
// A Vietnamese IME in Vietnamese mode produces accented characters, which we detect here.
export function hasNonAscii(value) {
  return /[^\x00-\x7F]/.test(value);
}

export const IME_WARNING_MESSAGE =
  "Accented characters detected. Switch your input method to English and type again.";
