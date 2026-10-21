import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function ResetPassword() {
  const { t } = useTranslation();
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
      setError(t("auth.resetPassword.mismatchError"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      setSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      let msg = null;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        msg = data.message || Object.values(data.errors || {}).flat().join(" • ");
      } else if (typeof data === "string") {
        msg = data;
      }
      if (!msg || msg.includes("[object Object]")) msg = t("auth.resetPassword.fallbackError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Không có token trong URL -> không cho gửi form, hiện hướng dẫn thay thế
  if (!token) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-logo-text">Calis</span>
            <span className="logo-gradient-text">Health</span>
          </div>
          <h1 className="login-title">{t("auth.resetPassword.missingTokenTitle")}</h1>

          <div className="login-form">
            <div className="login-error">{t("auth.resetPassword.missingTokenMessage")}</div>
            <button
              className="login-submit"
              onClick={() => navigate("/forgot-password")}
              type="button"
            >
              <span className="login-submit-text">{t("auth.resetPassword.requestNewLink")}</span>
            </button>
          </div>

          <div className="login-links">
            <button type="button" className="login-link" onClick={() => navigate("/login")}>
              {t("auth.resetPassword.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-text">Calis</span>
          <span className="logo-gradient-text">Health</span>
        </div>
        <h1 className="login-title">{t("auth.resetPassword.title")}</h1>

        {success ? (
          <div className="login-form">
            <div className="login-success">
              <strong>{t("auth.resetPassword.successTitle")}</strong>
              <br />
              {t("auth.resetPassword.successMessage")}
            </div>
            <button className="login-submit" onClick={() => navigate("/login")}>
              <span className="login-submit-text">{t("auth.resetPassword.goToLogin")}</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">{t("auth.resetPassword.newPassword")}</label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder={t("auth.resetPassword.passwordHint")}
                  value={form.newPassword}
                  onChange={set("newPassword")}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">
                {t("auth.resetPassword.confirmNewPassword")}
              </label>
              <div className="login-input-wrap">
                <input
                  className="login-input"
                  type="password"
                  placeholder={t("auth.resetPassword.confirmNewPassword")}
                  value={form.confirmNewPassword}
                  onChange={set("confirmNewPassword")}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">
                {loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
              </span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/login")}>
            {t("auth.resetPassword.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}