import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import AuthLogo from "../components/AuthLogo";
import "./Login.css";

const REDIRECT_SECONDS = 8;

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  // The token is single-use, so guard against React StrictMode running the effect twice
  // (the second POST would fail and wrongly show an error).
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t("common.auth.verifyEmailFlow.invalidLink"));
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    api.post(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || t("common.auth.verifyEmailFlow.successTitle"));
        setSeconds(REDIRECT_SECONDS);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || t("common.auth.verifyEmailFlow.fallbackError"));
        setSeconds(REDIRECT_SECONDS);
      });
  }, [token, t]);

  useEffect(() => {
    if (status === "verifying") return undefined;
    if (seconds <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [status, seconds, navigate]);

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">
          {status === "verifying"
            ? t("common.auth.verifyEmail.verifying")
            : status === "success"
              ? t("common.auth.verifyEmailFlow.successTitle")
              : t("common.auth.verifyEmailFlow.errorTitle")}
        </h1>
        <div className="login-form">
          {status === "verifying" && <div className="login-success">{t("common.auth.verifyEmail.verifyingMessage")}</div>}
          {status === "success" && <div className="login-success">{message}</div>}
          {status === "error" && <div className="login-error">{message}</div>}
          {(status === "success" || status === "error") && (
            <div className="login-redirect">{t("common.auth.verifyEmailFlow.redirecting", { seconds })}</div>
          )}
        </div>
      </div>
    </div>
  );
}
