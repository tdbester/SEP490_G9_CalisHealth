import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("The confirmation password does not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        (data && typeof data === "object"
          ? Object.values(data).flat().join(" • ")
          : data) || "Registration failed.";
      setError(typeof msg === "string" ? msg : "Registration failed.");
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
        <h1 className="login-title">Create Account</h1>

        {success ? (
          <div className="login-form">
            <div className="login-success">
              Registration successful! Check your email to verify your account.
            </div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">Go to Login</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">Full Name</label>
              <div className="login-input-wrap">
                <input className="login-input" placeholder="Full Name" value={form.fullName} onChange={set("fullName")} required />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Email</label>
              <div className="login-input-wrap">
                <input className="login-input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input className="login-input" type="password" placeholder="Min 8 chars, upper, lower, digit, special" value={form.password} onChange={set("password")} required />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <div className="login-input-wrap">
                <input className="login-input" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
              </div>
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
