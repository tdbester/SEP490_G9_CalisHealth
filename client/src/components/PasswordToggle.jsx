function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <circle cx="16.5" cy="13" r="5" stroke="currentColor" strokeWidth="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M2 2L31 24" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

// Eye button placed inside .login-input-wrap, after the password input.
export default function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      className="login-toggle-pw"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
    >
      {visible ? <EyeOffIcon /> : <EyeOpenIcon />}
    </button>
  );
}
