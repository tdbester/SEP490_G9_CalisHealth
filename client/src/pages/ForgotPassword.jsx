import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function ForgotPassword() {
  const { t } = useTranslation();
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
        <h1 className="login-title">{t("auth.forgotPassword.title")}</h1>

        {sent ? (
          <div className="login-form">
            <div className="login-success">
              <strong>{t("auth.forgotPassword.successTitle")}</strong>
              <br />
              {t("auth.forgotPassword.successMessage")}
            </div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">{t("auth.forgotPassword.backToLogin")}</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">{t("auth.forgotPassword.email")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="email"
                  placeholder={t("auth.forgotPassword.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">
                {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
              </span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/login")}>
            {t("auth.forgotPassword.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}