import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("The verification token is missing.");
      return;
    }
    api.get(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || "Email verified successfully!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || err.response?.data?.detail || "The link is invalid or has expired.");
      });
  }, [params]);

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-text">Calis</span>
          <span className="logo-gradient-text">Health</span>
        </div>
        <h1 className="login-title">
          {status === "verifying" ? "Verifying..." : status === "success" ? "Success!" : "Failed"}
        </h1>

        <div className="login-form">
          {status === "verifying" && <div className="login-success">Verifying your email, please wait...</div>}
          {status === "success" && (
            <>
              <div className="login-success">{message}</div>
              <button className="login-submit" onClick={() => navigate("/login")}>
                <span className="login-submit-text">Sign in now</span>
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="login-error">{message}</div>
              <button className="login-submit" onClick={() => navigate("/login")}>
                <span className="login-submit-text">Back to login</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}