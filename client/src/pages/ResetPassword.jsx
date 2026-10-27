import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [form, setForm] = useState({ newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmNewPassword) {
      setError("The confirmation password does not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        (data && typeof data === "object"
          ? Object.values(data).flat().join(" • ")
          : data) || "Could not reset the password.";
      setError(typeof msg === "string" ? msg : "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-text">Calis</span>
          <span className="logo-gradient-text">Health</span>
        </div>
        <h1 className="login-title">Reset password</h1>

        {success ? (
          <div className="login-form">
            <div className="login-success">Password reset successfully! Please sign in again.</div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">Sign in</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">New password</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder="Min 8 chars, upper, lower, digit, special"
                  value={form.newPassword}
                  onChange={set("newPassword")}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Confirm new password</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder="Re-enter new password"
                  value={form.confirmNewPassword}
                  onChange={set("confirmNewPassword")}
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Processing..." : "Reset password"}</span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>Back to login</button>
        </div>
      </div>
    </div>
  );
}