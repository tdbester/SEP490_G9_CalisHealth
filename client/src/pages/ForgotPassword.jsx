import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { hasNonAscii } from "../utils/authInput";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      setError(typeof msg === "string" ? msg : t("auth.forgotPassword.fallbackError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-header">
          <AuthLogo />
          <LanguageSwitcher variant="select" className="login-lang" />
        </div>
        <h1 className="login-title">{t("auth.forgotPassword.title")}</h1>

        {sent ? (
          <div className="login-form">
            <div className="login-success">
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
                <input className="login-input" type="email" placeholder={t("auth.forgotPassword.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <ImeNotice warn={imeWarn} />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">
                {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
              </span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>
            {t("auth.forgotPassword.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}
