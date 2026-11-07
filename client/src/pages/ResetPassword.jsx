import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import LanguageSwitcher from "../components/LanguageSwitcher";
import PasswordToggle from "../components/PasswordToggle";
import { fieldErrors, hasNonAscii, isStrongPassword } from "../utils/authInput";

const REDIRECT_SECONDS = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying");
  const [form, setForm] = useState({ newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError(t("auth.resetPassword.missingTokenMessage"));
      return;
    }
    api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("error");
        setError(t("auth.resetPassword.missingTokenMessage"));
      });
  }, [token, t]);

  useEffect(() => {
    if (status !== "error" && !success) return undefined;
    if (seconds <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [status, success, seconds, navigate, token]);

  const imeWarn = {
    newPassword: hasNonAscii(form.newPassword),
    confirmNewPassword: hasNonAscii(form.confirmNewPassword),
  };

  const validateField = (key, value) => {
    if (key === "newPassword") return isStrongPassword(value) ? "" : t("common.passwordRule");
    if (key === "confirmNewPassword") {
      return value === form.newPassword ? "" : t("auth.resetPassword.mismatchError");
    }
    return "";
  };

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
    if (errors[key]) setErrors((current) => ({ ...current, [key]: validateField(key, value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (imeWarn.newPassword || imeWarn.confirmNewPassword) return;
    const local = {
      newPassword: validateField("newPassword", form.newPassword),
      confirmNewPassword: validateField("confirmNewPassword", form.confirmNewPassword),
    };
    setErrors(local);
    if (local.newPassword || local.confirmNewPassword) return;
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      setSuccess(true);
      setSeconds(REDIRECT_SECONDS);
    } catch (err) {
      // Password rule errors stay on the form; only a bad/expired token leaves it.
      const byField = fieldErrors(err);
      if (byField.newPassword || byField.confirmNewPassword) {
        setErrors(byField);
        return;
      }
      const data = err.response?.data;
      const msg =
        (data && typeof data === "object"
          ? Object.values(data).flat().join(" • ")
          : data) || t("auth.resetPassword.fallbackError");
      setError(typeof msg === "string" ? msg : t("auth.resetPassword.fallbackError"));
      setStatus("error");
      setSeconds(REDIRECT_SECONDS);
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
        <h1 className="login-title">
          {status === "verifying"
            ? t("auth.verifyEmail.verifying")
            : status === "error"
            ? t("auth.resetPassword.missingTokenTitle")
            : t("auth.resetPassword.title")}
        </h1>

        {status === "verifying" && (
          <div className="login-form">
            <div className="login-success">{t("auth.resetPassword.checkingToken")}</div>
          </div>
        )}
        {status === "error" && (
          <div className="login-form">
            <div className="login-error">{error}</div>
            <div className="login-redirect">{t("common.redirectIn", { seconds })}</div>
          </div>
        )}
        {status === "ready" && !success && (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="login-field">
              <label className="login-label" htmlFor="reset-password">{t("auth.resetPassword.newPassword")}</label>
              <div className={`login-input-wrap${errors.newPassword ? " login-input-wrap--error" : ""}`}>
                <input
                  id="reset-password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.resetPassword.passwordHint")}
                  value={form.newPassword}
                  onChange={set("newPassword")}
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={errors.newPassword ? "reset-password-error" : undefined}
                  required
                />
                <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              <ImeNotice warn={imeWarn.newPassword} />
              {errors.newPassword && (
                <div id="reset-password-error" className="login-field-error" role="alert">{errors.newPassword}</div>
              )}
            </div>
            <div className="login-field">
              <label className="login-label" htmlFor="reset-confirm">{t("auth.resetPassword.confirmPassword")}</label>
              <div className={`login-input-wrap${errors.confirmNewPassword ? " login-input-wrap--error" : ""}`}>
                <input
                  id="reset-confirm"
                  className="login-input"
                  type="password"
                  placeholder={t("auth.resetPassword.confirmPassword")}
                  value={form.confirmNewPassword}
                  onChange={set("confirmNewPassword")}
                  aria-invalid={Boolean(errors.confirmNewPassword)}
                  aria-describedby={errors.confirmNewPassword ? "reset-confirm-error" : undefined}
                  required
                />
              </div>
              <ImeNotice warn={imeWarn.confirmNewPassword} />
              {errors.confirmNewPassword && (
                <div id="reset-confirm-error" className="login-field-error" role="alert">{errors.confirmNewPassword}</div>
              )}
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">
                {loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
              </span>
            </button>
          </form>
        )}
        {success && (
          <div className="login-form">
            <div className="login-success">
              {t("auth.resetPassword.successTitle")} {t("auth.resetPassword.successMessage")}
            </div>
            <div className="login-redirect">{t("common.redirectIn", { seconds })}</div>
          </div>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>
            {t("auth.resetPassword.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}
