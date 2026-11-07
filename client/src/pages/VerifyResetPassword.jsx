import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import AuthLogo from "../components/AuthLogo";
import "./Login.css";

const REDIRECT_SECONDS = 8;

export default function VerifyResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying");
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  useEffect(() => {
    if (status === "verifying") return undefined;
    if (seconds <= 0) {
      navigate(status === "success" ? `/reset-password?token=${encodeURIComponent(token)}` : "/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [status, seconds, navigate, token]);

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">
          {status === "verifying"
            ? t("common.auth.verifyResetPassword.verifying")
            : status === "success"
              ? t("common.auth.verifyResetPassword.successTitle")
              : t("common.auth.verifyResetPassword.errorTitle")}
        </h1>
        <div className="login-form">
          {status === "verifying" && <div className="login-success">{t("common.auth.verifyResetPassword.checkingLink")}</div>}
          {status === "success" && <div className="login-success">{t("common.auth.verifyResetPassword.validToken", { seconds })}</div>}
          {status === "error" && <div className="login-error">{t("common.auth.verifyResetPassword.expiredToken", { seconds })}</div>}
        </div>
      </div>
    </div>
  );
}
