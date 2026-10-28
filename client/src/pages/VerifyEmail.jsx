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
      setMessage("Link xác thực không hợp lệ hoặc thiếu mã xác thực.");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    api.post(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || "Xác thực email thành công!");
        setSeconds(REDIRECT_SECONDS);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "Không thể xác thực email. Vui lòng thử lại.");
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
          {status === "verifying" ? "Đang xác thực..." : status === "success" ? "Xác thực thành công" : "Xác thực thất bại"}
        </h1>
        <div className="login-form">
          {status === "verifying" && <div className="login-success">Đang xác thực email của bạn, vui lòng chờ...</div>}
          {status === "success" && <div className="login-success">{message}</div>}
          {status === "error" && <div className="login-error">{message}</div>}
          {(status === "success" || status === "error") && (
            <div className="login-redirect">Tự động chuyển về trang đăng nhập sau {seconds} giây.</div>
          )}
        </div>
      </div>
    </div>
  );
}
