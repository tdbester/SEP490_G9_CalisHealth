import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii } from "../utils/authInput";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [seconds, setSeconds] = useState(8);

  useEffect(() => {
    if (!result || result.success) return undefined;
    if (seconds <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [result, seconds, navigate]);

  // Full name may contain accents; email and passwords must be ASCII.
  const imeWarn = {
    email: hasNonAscii(form.email),
    password: hasNonAscii(form.password),
    confirmPassword: hasNonAscii(form.confirmPassword),
  };

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [k]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (imeWarn.email || imeWarn.password || imeWarn.confirmPassword) return;
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setResult({ success: true, message: "Đã gửi email xác thực thành công. Vui lòng kiểm tra hộp thư để xác thực tài khoản." });
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.message || data?.error || data?.detail || (data && typeof data === "object"
          ? Object.values(data).flat().filter((value) => typeof value === "string").join(" • ")
          : "");
      const message = msg || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin và thử lại.";
      if (message.toLowerCase().includes("email đã được đăng ký")) {
        setError(message);
      } else {
        setResult({ success: false, message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <AuthLogo />
        <h1 className="login-title">Create Account</h1>

        {result ? (
          <div className="login-form">
            {result.success && <h2 className="login-title">Email xác thực đã được gửi</h2>}
            <div className={result.success ? "login-success" : "login-error"}>{result.message}</div>
            {result.success && <div className="login-redirect">Hãy xác thực email trước khi đăng nhập.</div>}
            {!result.success && <div className="login-redirect">Bạn sẽ được chuyển về màn hình đăng nhập sau {seconds} giây.</div>}
            <button type="button" className="login-submit" onClick={() => navigate("/login", { replace: true })}>
              <span className="login-submit-text">Về đăng nhập ngay</span>
            </button>
            {!result.success && (
              <button type="button" className="login-link" onClick={() => { setResult(null); setSeconds(8); }}>
                Quay lại đăng ký
              </button>
            )}
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="login-field">
              <label className="login-label">Full Name</label>
              <div className="login-input-wrap">
                <input className="login-input" placeholder="Full Name" value={form.fullName} onChange={set("fullName")} required />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Email</label>
              <div className="login-input-wrap">
                <input className="login-input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
              </div>
              <ImeNotice warn={imeWarn.email} />
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input className="login-input" type="password" placeholder="Min 8 chars, upper, lower, digit, special" value={form.password} onChange={set("password")} required />
              </div>
              <ImeNotice warn={imeWarn.password} />
            </div>

            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <div className="login-input-wrap">
                <input className="login-input" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
              </div>
              <ImeNotice warn={imeWarn.confirmPassword} />
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span className="login-submit-text">{loading ? "Creating..." : "Sign Up"}</span>
            </button>
          </form>
        )}

        <div className="login-links">
          <button className="login-link" onClick={() => navigate("/login")}>Already have account? Login</button>
        </div>
      </div>
    </div>
  );
}
