import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import PasswordToggle from "../components/PasswordToggle";
import { PASSWORD_RULE_MESSAGE, fieldErrors, hasNonAscii, isStrongPassword } from "../utils/authInput";

const REDIRECT_SECONDS = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying");
  const [form, setForm] = useState({ newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("The token has expired, please sign up again");
      return;
    }
    api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("error");
        setError("The token has expired, please sign up again");
      });
  }, [token]);

  useEffect(() => {
    if (status !== "error" && !success) return undefined;
    if (seconds <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [status, success, seconds, navigate, token]);

  const imeWarn = {
    newPassword: hasNonAscii(form.newPassword),
    confirmNewPassword: hasNonAscii(form.confirmNewPassword),
  };

  const validateField = (key, value) => {
    if (key === "newPassword") return isStrongPassword(value) ? "" : PASSWORD_RULE_MESSAGE;
    if (key === "confirmNewPassword") {
      return value === form.newPassword ? "" : "The confirmation password does not match";
    }
    return "";
  };

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
    if (errors[key]) setErrors((current) => ({ ...current, [key]: validateField(key, value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (imeWarn.newPassword || imeWarn.confirmNewPassword) return;
    const local = {
      newPassword: validateField("newPassword", form.newPassword),
      confirmNewPassword: validateField("confirmNewPassword", form.confirmNewPassword),
    };
    setErrors(local);
    if (local.newPassword || local.confirmNewPassword) return;
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      setSuccess(true);
      setSeconds(REDIRECT_SECONDS);
    } catch (err) {
      // Password rule errors stay on the form; only a bad/expired token leaves it.
      const byField = fieldErrors(err);
      if (byField.newPassword || byField.confirmNewPassword) {
        setErrors(byField);
        return;
      }
      const data = err.response?.data;
      const msg =
        (data && typeof data === "object"
          ? Object.values(data).flat().join(" • ")
          : data) || "Unable to reset password. Please try again.";
      setError(typeof msg === "string" ? msg : "Unable to reset password. Please try again.");
      setStatus("error");
      setSeconds(REDIRECT_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">
          {status === "verifying" ? "Verifying..." : status === "error" ? "Verification failed" : "Reset Password"}
        </h1>

        {status === "verifying" && <div className="login-form"><div className="login-success">Checking token, please wait...</div></div>}
        {status === "error" && (
          <div className="login-form">
            <div className="login-error">{error}</div>
            <div className="login-redirect">Redirecting to the login page in {seconds} seconds.</div>
          </div>
        )}
        {status === "ready" && !success && (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="login-field">
              <label className="login-label" htmlFor="reset-password">New Password</label>
              <div className={`login-input-wrap${errors.newPassword ? " login-input-wrap--error" : ""}`}>
                <input
                  id="reset-password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 chars, upper, lower, digit, special"
                  value={form.newPassword}
                  onChange={set("newPassword")}
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={errors.newPassword ? "reset-password-error" : undefined}
                  required
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              <ImeNotice warn={imeWarn.newPassword} />
              {errors.newPassword && (
                <div id="reset-password-error" className="login-field-error" role="alert">{errors.newPassword}</div>
              )}
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="reset-confirm">Confirm New Password</label>
              <div className={`login-input-wrap${errors.confirmNewPassword ? " login-input-wrap--error" : ""}`}>
                <input
                  id="reset-confirm"
                  className="login-input"
                  type="password"
                  placeholder="Re-enter new password"
                  value={form.confirmNewPassword}
                  onChange={set("confirmNewPassword")}
                  aria-invalid={Boolean(errors.confirmNewPassword)}
                  aria-describedby={errors.confirmNewPassword ? "reset-confirm-error" : undefined}
                  required
                />
              </div>
              <ImeNotice warn={imeWarn.confirmNewPassword} />
              {errors.confirmNewPassword && (
                <div id="reset-confirm-error" className="login-field-error" role="alert">{errors.confirmNewPassword}</div>
              )}
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Processing..." : "Reset Password"}</span>
            </button>
          </form>
        )}
        {success && (
          <div className="login-form">
            <div className="login-success">Password reset successfully! Please log in again.</div>
            <div className="login-redirect">Redirecting to the login page in {seconds} seconds.</div>
          </div>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>Back to login</button>
        </div>
      </div>
    </div>
  );
}
