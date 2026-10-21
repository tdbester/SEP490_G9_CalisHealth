import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

function Logo() {
  return (
    <svg width="25" height="37" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z"
        fill="url(#paint0_linear_89_80)"
      />
      <path
        d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051"
        strokeWidth="1.5162"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="white"
      />
      <defs>
        <linearGradient
          id="paint0_linear_89_80"
          x1="2.3826"
          y1="-2.22058e-07"
          x2="14.1558"
          y2="12.2638"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#FF77A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Login() {
  const { t } = useTranslation();
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
      // res.data = { token, email, fullName, role }
      // Luu token + thong tin user de dung o cac trang sau
      localStorage.setItem("token", res.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: res.data.email,
          fullName: res.data.fullName,
          role: res.data.role,
        })
      );
      navigate("/");
    } catch (err) {
      // Ưu tiên message từ backend (đã được dịch theo Accept-Language)
      const data = err.response?.data;
      let msg = null;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        msg = data.message || Object.values(data.errors || {}).flat().join(" • ");
      } else if (typeof data === "string") {
        msg = data;
      }
      if (!msg || msg.includes("[object Object]")) {
        const status = err.response?.status;
        msg = status === 401 || status === 403 ? t("auth.login.credentialsError") : t("auth.login.fallbackError");
      }
      setError(msg);
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

        <h1 className="login-title">{t("auth.login.title")}</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              {t("auth.login.email")}
            </label>
            <div className="login-input-wrap">
              <input
                id="login-email"
                className="login-input"
                type="email"
                placeholder={t("auth.login.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              {t("auth.login.password")}
            </label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.login.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
              >
                {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            <span className="login-submit-text">
              {loading ? t("auth.login.submitting") : t("auth.login.submit")}
            </span>
          </button>
        </form>

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/register")}>
            {t("auth.login.noAccount")}
          </button>
          <button type="button" className="login-link" onClick={() => navigate("/forgot-password")}>
            {t("auth.login.forgotPassword")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="13" r="5" stroke="currentColor" strokeWidth="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path d="M2 2L31 24" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}