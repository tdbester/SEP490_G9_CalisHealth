import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii } from "../utils/authInput";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const imeWarn = hasNonAscii(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (imeWarn) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      setError(typeof msg === "string" ? msg : "Unable to send the password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
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
              <ImeNotice warn={imeWarn} />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Sending..." : "Send"}</span>
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
