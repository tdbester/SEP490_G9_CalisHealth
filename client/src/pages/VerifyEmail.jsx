import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t("auth.verifyEmail.missingToken"));
      return;
    }
    api
      .get(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || t("auth.verifyEmail.defaultError"));
      });
    // Chỉ chạy lại khi token thực sự đổi, không phụ thuộc object params
  }, [token, t]);

  const title =
    status === "verifying"
      ? t("auth.verifyEmail.verifying")
      : status === "success"
      ? t("auth.verifyEmail.successTitle")
      : t("auth.verifyEmail.errorTitle");

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-text">Calis</span>
          <span className="logo-gradient-text">Health</span>
        </div>
        <h1 className="login-title">{title}</h1>

        <div className="login-form">
          {status === "verifying" && (
            <div className="login-success">{t("auth.verifyEmail.verifyingMessage")}</div>
          )}

          {status === "success" && (
            <>
              <div className="login-success">{t("auth.verifyEmail.successTitle")}</div>
              <button
                className="login-submit"
                onClick={() => navigate("/login")}
                type="button"
              >
                <span className="login-submit-text">{t("auth.verifyEmail.loginNow")}</span>
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="login-error">{message}</div>
              <button
                className="login-submit"
                onClick={() => navigate("/login")}
                type="button"
              >
                <span className="login-submit-text">{t("auth.verifyEmail.backToLogin")}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}