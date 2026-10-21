import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError(t("auth.common.mismatchError"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      let msg = null;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        msg = data.message || Object.values(data.errors || {}).flat().join(" • ");
      } else if (typeof data === "string") {
        msg = data;
      }
      if (!msg || msg.includes("[object Object]")) msg = t("auth.register.fallbackError");
      setError(msg);
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
        <h1 className="login-title">{t("auth.register.title")}</h1>

        {success ? (
          <div className="login-form">
            <div className="login-success">
              <strong>{t("auth.register.successTitle")}</strong>
              <br />
              {t("auth.register.successMessage")}
            </div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">{t("auth.register.goToLogin")}</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">{t("auth.register.fullName")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  placeholder={t("auth.register.fullName")}
                  value={form.fullName}
                  onChange={set("fullName")}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">{t("auth.register.email")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="email"
                  placeholder={t("auth.register.email")}
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">{t("auth.register.password")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder={t("auth.register.passwordHint")}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">{t("auth.register.confirmPassword")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder={t("auth.register.confirmPassword")}
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">
                {loading ? t("auth.register.submitting") : t("auth.register.submit")}
              </span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/login")}>
            {t("auth.register.hasAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}