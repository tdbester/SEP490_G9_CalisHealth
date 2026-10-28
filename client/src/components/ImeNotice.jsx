import { IME_WARNING_MESSAGE } from "../utils/authInput";

// Small line under an input. Idle: a reminder shown only while the field is focused
// (see .login-field:focus-within in Login.css). Warn: always visible once accents are typed.
export default function ImeNotice({ warn = false }) {
  return (
    <small
      className={`login-hint ${warn ? "login-hint--warn" : "login-hint--idle"}`}
      role={warn ? "alert" : undefined}
    >
      {warn ? IME_WARNING_MESSAGE : "Hãy chuyển bộ gõ sang tiếng Anh trước khi nhập."}
    </small>
  );
}
