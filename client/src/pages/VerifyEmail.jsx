import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import AuthLogo from "../components/AuthLogo";
import "./Login.css";

const REDIRECT_SECONDS = 8;

export default function VerifyEmail() {
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
      setMessage("The verification link is invalid or missing a verification code.");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    api.post(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || "Email verified successfully!");
        setSeconds(REDIRECT_SECONDS);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Unable to verify email. Please try again.");
        setSeconds(REDIRECT_SECONDS);
      });
  }, [token]);

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
          {status === "verifying" ? "Verifying..." : status === "success" ? "Verification successful" : "Verification failed"}
        </h1>
        <div className="login-form">
          {status === "verifying" && <div className="login-success">Verifying your email, please wait...</div>}
          {status === "success" && <div className="login-success">{message}</div>}
          {status === "error" && <div className="login-error">{message}</div>}
          {(status === "success" || status === "error") && (
            <div className="login-redirect">Redirecting to the login page in {seconds} seconds.</div>
          )}
        </div>
      </div>
    </div>
  );
}
