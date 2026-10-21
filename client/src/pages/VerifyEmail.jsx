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
      setMessage("Thiếu token xác thực.");
      return;
    }
    api.get(`/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.message || "Xác thực email thành công!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || err.response?.data?.detail || "Link không hợp lệ hoặc đã hết hạn.");
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
          {status === "verifying" ? "Đang xác thực..." : status === "success" ? "Thành công!" : "Thất bại"}
        </h1>

        <div className="login-form">
          {status === "verifying" && <div className="login-success">Đang xác thực email của bạn, vui lòng chờ...</div>}
          {status === "success" && (
            <>
              <div className="login-success">{message}</div>
              <button className="login-submit" onClick={() => navigate("/login")}>
                <span className="login-submit-text">Đăng nhập ngay</span>
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="login-error">{message}</div>
              <button className="login-submit" onClick={() => navigate("/login")}>
                <span className="login-submit-text">Về trang đăng nhập</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}