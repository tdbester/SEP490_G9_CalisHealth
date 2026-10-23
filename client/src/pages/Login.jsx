import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

function MailIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 28 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.6" y="0.6" width="26.8" height="19.8" rx="0.4" stroke="currentColor" strokeWidth="2.8" />
      <path d="M1.4 1.4L14 11.2L26.6 1.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 22 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.6" y="13.2" width="20.8" height="18.2" rx="0.4" stroke="currentColor" strokeWidth="2.8" />
      <path d="M4.2 13.2V9.4C4.2 5.7 7.3 2.7 11 2.7C14.7 2.7 17.8 5.7 17.8 9.4V13.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <circle cx="16.5" cy="13" r="5" stroke="currentColor" strokeWidth="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M2 2L31 24" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function Logo() {
  return (
    <svg width="25" height="37" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z" fill="url(#paint0_linear_89_80)" />
      <path d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051" strokeWidth="1.5162" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
      <defs>
        <linearGradient id="paint0_linear_89_80" x1="2.3826" y1="-2.22058e-07" x2="14.1558" y2="12.2638" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#FF77A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      // res.data = { token, email, fullName }
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify({ email: res.data.email, fullName: res.data.fullName }));
      navigate("/dashboard");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.response?.data ||
        "Đăng nhập thất bại. Vui lòng thử lại.";
      setError(typeof msg === "string" ? msg : "Email hoặc mật khẩu không đúng.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Logo />
          </div>
          <span className="login-logo-text">Calis</span>
          <span className="logo-gradient-text">Health</span>
        </div>

        <h1 className="login-title">Login</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">Email</label>
            <div className="login-input-wrap">
              <MailIcon />
              <input
                id="login-email"
                className="login-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <LockIcon />
              <input
                id="login-password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            <span className="login-submit-text">
              {loading ? "Signing in..." : "Login"}
            </span>
          </button>
        </form>

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/register")}>
            You don&apos;t have account? Register
          </button>
          <button type="button" className="login-link" onClick={() => navigate("/forgot-password")}>
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}
