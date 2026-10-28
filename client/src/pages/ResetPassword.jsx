import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii } from "../utils/authInput";

const REDIRECT_SECONDS = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying");
  const [form, setForm] = useState({ newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("token đã hết hạn, vui lòng đăng kí lại");
      return;
    }
    api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("error");
        setError("token đã hết hạn, vui lòng đăng kí lại");
      });
  }, [token]);

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

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (imeWarn.newPassword || imeWarn.confirmNewPassword) return;
    if (form.newPassword !== form.confirmNewPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, ...form });
      setSuccess(true);
      setSeconds(REDIRECT_SECONDS);
    } catch (err) {
      setError("token đã hết hạn, vui lòng đăng kí lại");
      setStatus("error");
      setSeconds(REDIRECT_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">
          {status === "verifying" ? "Đang xác thực..." : status === "error" ? "Xác thực thất bại" : "Đặt lại mật khẩu"}
        </h1>

        {status === "verifying" && <div className="login-form"><div className="login-success">Đang kiểm tra token, vui lòng chờ...</div></div>}
        {status === "error" && (
          <div className="login-form">
            <div className="login-error">{error}</div>
            <div className="login-redirect">Tự động chuyển về trang đăng nhập sau {seconds} giây.</div>
          </div>
        )}
        {status === "ready" && !success && (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="login-field">
              <label className="login-label">Mật khẩu mới</label>
              <div className="login-input-wrap"><input className="login-input" type="password" value={form.newPassword} onChange={set("newPassword")} required /></div>
              <ImeNotice warn={imeWarn.newPassword} />
            </div>
            <div className="login-field">
              <label className="login-label">Xác nhận mật khẩu mới</label>
              <div className="login-input-wrap"><input className="login-input" type="password" value={form.confirmNewPassword} onChange={set("confirmNewPassword")} required /></div>
              <ImeNotice warn={imeWarn.confirmNewPassword} />
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}</span>
            </button>
          </form>
        )}
        {success && (
          <div className="login-form">
            <div className="login-success">Đặt lại mật khẩu thành công! Hãy đăng nhập lại.</div>
            <div className="login-redirect">Tự động chuyển đến màn hình reset password sau {seconds} giây.</div>
          </div>
        )}
      </div>
    </div>
  );
}
