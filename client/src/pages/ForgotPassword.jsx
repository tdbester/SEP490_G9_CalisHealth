import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
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
        <h1 className="login-title">Forgot Password</h1>

        {sent ? (
          <div className="login-form">
            <div className="login-success">
              If the email exists, we have sent a password reset link. Please check your inbox.
            </div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">Back to Login</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Email</label>
              <div className="login-input-wrap">
                <input className="login-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Sending..." : "Send Reset Link"}</span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    </div>
  );
}
