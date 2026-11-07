import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii, isStrongPassword } from "../utils/authInput";

/** Shown after an admin created the account with a temporary password. */
export default function ChangePassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If the account no longer needs a change, go to the role home instead.
  useEffect(() => {
    if (!hasToken) return;
    api.get("/auth/me").then(({ data }) => {
      if (!data.mustChangePassword) navigate("/", { replace: true });
    }).catch(() => {});
  }, [hasToken, navigate]);

  if (!hasToken) return <Navigate to="/login" replace />;

  const imeWarn = {
    oldPassword: hasNonAscii(form.oldPassword),
    newPassword: hasNonAscii(form.newPassword),
    confirmNewPassword: hasNonAscii(form.confirmNewPassword),
  };

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (Object.values(imeWarn).some(Boolean)) return;
    if (!isStrongPassword(form.newPassword)) {
      setError(t("common.passwordRule"));
      return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setError(t("common.changePassword.mismatch"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", form);
      // Password changed: sign in again with the new one.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t("common.changePassword.fallbackError"));
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, placeholder) => (
    <div className="login-field">
      <label className="login-label" htmlFor={`cp-${key}`}>{label}</label>
      <div className="login-input-wrap">
        <input
          id={`cp-${key}`}
          className="login-input"
          type="password"
          placeholder={placeholder}
          value={form[key]}
          onChange={set(key)}
          autoComplete={key === "oldPassword" ? "current-password" : "new-password"}
          required
        />
      </div>
      <ImeNotice warn={imeWarn[key]} />
    </div>
  );

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">{t("common.changePassword.title")}</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-success">
            {t("common.changePassword.notice")}
          </div>
          {error && <div className="login-error">{error}</div>}
          {field(
            "oldPassword",
            t("common.changePassword.oldPassword"),
            t("common.changePassword.oldPasswordPlaceholder"),
          )}
          {field(
            "newPassword",
            t("common.changePassword.newPassword"),
            t("common.changePassword.newPasswordPlaceholder"),
          )}
          {field(
            "confirmNewPassword",
            t("common.changePassword.confirmNewPassword"),
            t("common.changePassword.confirmNewPasswordPlaceholder"),
          )}
          <button type="submit" className="login-submit" disabled={loading}>
            <span className="login-submit-text">
              {loading ? t("common.changePassword.submitting") : t("common.changePassword.submit")}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
