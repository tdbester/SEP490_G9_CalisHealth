import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import PasswordToggle from "../components/PasswordToggle";
import { PASSWORD_RULE_MESSAGE, fieldErrors, hasNonAscii, isStrongPassword } from "../utils/authInput";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  // Inline messages under each field, keyed by form field name.
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [seconds, setSeconds] = useState(8);

  useEffect(() => {
    if (!result || result.success) return undefined;
    if (seconds <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [result, seconds, navigate]);

  // Full name may contain accents; email and passwords must be ASCII.
  const imeWarn = {
    email: hasNonAscii(form.email),
    password: hasNonAscii(form.password),
    confirmPassword: hasNonAscii(form.confirmPassword),
  };

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [k]: value }));
    if (error) setError("");
    // Once a field error is shown, re-check it as the user types so it clears when fixed.
    if (errors[k]) setErrors((current) => ({ ...current, [k]: validateField(k, value) }));
  };

  const validateField = (k, value) => {
    if (k === "password") return isStrongPassword(value) ? "" : PASSWORD_RULE_MESSAGE;
    if (k === "confirmPassword") return value === form.password ? "" : "The confirmation password does not match";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (imeWarn.email || imeWarn.password || imeWarn.confirmPassword) return;
    const local = {
      password: validateField("password", form.password),
      confirmPassword: validateField("confirmPassword", form.confirmPassword),
    };
    setErrors(local);
    if (local.password || local.confirmPassword) return;
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setResult({ success: true, message: "Verification email sent successfully. Please check your inbox to verify your account." });
    } catch (err) {
      // Validation errors (400 with per-field messages) stay on the form.
      const byField = fieldErrors(err);
      if (Object.keys(byField).length > 0) {
        setErrors(byField);
        const other = Object.entries(byField)
          .filter(([field]) => !["fullName", "email", "password", "confirmPassword"].includes(field))
          .map(([, message]) => message);
        if (other.length) setError(other.join(" • "));
        return;
      }
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.message || data?.error || data?.detail || (data && typeof data === "object"
          ? Object.values(data).flat().filter((value) => typeof value === "string").join(" • ")
          : "");
      const message = msg || "Registration failed. Please check your information and try again.";
      if (message.toLowerCase().includes("email is already registered")) {
        setError(message);
      } else {
        setResult({ success: false, message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">Create Account</h1>

        {result ? (
          <div className="login-form">
            {result.success && <h2 className="login-title">Verification email sent</h2>}
            <div className={result.success ? "login-success" : "login-error"}>{result.message}</div>
            {result.success && <div className="login-redirect">Please verify your email before logging in.</div>}
            {!result.success && <div className="login-redirect">You will be redirected to the login page in {seconds} seconds.</div>}
            <button type="button" className="login-submit" onClick={() => navigate("/login", { replace: true })}>
              <span className="login-submit-text">Go to login now</span>
            </button>
            {!result.success && (
              <button type="button" className="login-link" onClick={() => { setResult(null); setSeconds(8); }}>
                Back to sign up
              </button>
            )}
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">Full Name</label>
              <div className="login-input-wrap">
                <input className="login-input" placeholder="Full Name" value={form.fullName} onChange={set("fullName")} required />
              </div>
              {errors.fullName && <div className="login-field-error" role="alert">{errors.fullName}</div>}
            </div>

            <div className="login-field">
              <label className="login-label">Email</label>
              <div className="login-input-wrap">
                <input className="login-input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
              </div>
              <ImeNotice warn={imeWarn.email} />
              {errors.email && <div className="login-field-error" role="alert">{errors.email}</div>}
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="register-password">Password</label>
              <div className={`login-input-wrap${errors.password ? " login-input-wrap--error" : ""}`}>
                <input
                  id="register-password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 chars, upper, lower, digit, special"
                  value={form.password}
                  onChange={set("password")}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "register-password-error" : undefined}
                  required
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              <ImeNotice warn={imeWarn.password} />
              {errors.password && (
                <div id="register-password-error" className="login-field-error" role="alert">{errors.password}</div>
              )}
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="register-confirm">Confirm Password</label>
              <div className={`login-input-wrap${errors.confirmPassword ? " login-input-wrap--error" : ""}`}>
                <input
                  id="register-confirm"
                  className="login-input"
                  type="password"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
                  required
                />
              </div>
              <ImeNotice warn={imeWarn.confirmPassword} />
              {errors.confirmPassword && (
                <div id="register-confirm-error" className="login-field-error" role="alert">{errors.confirmPassword}</div>
              )}
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Creating..." : "Sign Up"}</span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>Already have account? Login</button>
        </div>
      </div>
    </div>
  );
}
