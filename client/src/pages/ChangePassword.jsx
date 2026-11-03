import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii } from "../utils/authInput";

/** Shown after an admin created the account with a temporary password. */
export default function ChangePassword() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If the account no longer needs a change, go to the role home instead.
  useEffect(() => {
    if (!hasToken) return;
    api.get("/auth/me").then(({ data }) => {
      if (!data.mustChangePassword) navigate("/", { replace: true });
    }).catch(() => {});
  }, [hasToken, navigate]);

  if (!hasToken) return <Navigate to="/login" replace />;

  const imeWarn = {
    oldPassword: hasNonAscii(form.oldPassword),
    newPassword: hasNonAscii(form.newPassword),
    confirmNewPassword: hasNonAscii(form.confirmNewPassword),
  };

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (Object.values(imeWarn).some(Boolean)) return;
    if (form.newPassword !== form.confirmNewPassword) {
      setError("The confirmation password does not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", form);
      // Password changed: sign in again with the new one.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, placeholder) => (
    <div className="login-field">
      <label className="login-label" htmlFor={`cp-${key}`}>{label}</label>
      <div className="login-input-wrap">
        <input
          id={`cp-${key}`}
          className="login-input"
          type="password"
          placeholder={placeholder}
          value={form[key]}
          onChange={set(key)}
          autoComplete={key === "oldPassword" ? "current-password" : "new-password"}
          required
        />
      </div>
      <ImeNotice warn={imeWarn[key]} />
    </div>
  );

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">Change password</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-success">
            Your account was created with the default password. Choose a new one to continue.
          </div>
          {error && <div className="login-error">{error}</div>}
          {field("oldPassword", "Current (default) password", "Default password")}
          {field("newPassword", "New password", "Min 8 chars, upper, lower, digit, special")}
          {field("confirmNewPassword", "Confirm new password", "Re-enter new password")}
          <button type="submit" className="login-submit" disabled={loading}>
            <span className="login-submit-text">{loading ? "Saving..." : "Change password"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
