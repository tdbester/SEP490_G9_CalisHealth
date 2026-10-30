import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { markOnboardingPrompted, needsOnboarding } from "../api/survey";
import "./Login.css";
import AuthLogo from "../components/AuthLogo";
import ImeNotice from "../components/ImeNotice";
import { hasNonAscii } from "../utils/authInput";

function MailIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 28 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.6" y="0.6" width="26.8" height="19.8" rx="0.4" stroke="currentColor" strokeWidth="2.8" />
      <path d="M1.4 1.4L14 11.2L26.6 1.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 22 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.6" y="13.2" width="20.8" height="18.2" rx="0.4" stroke="currentColor" strokeWidth="2.8" />
      <path d="M4.2 13.2V9.4C4.2 5.7 7.3 2.7 11 2.7C14.7 2.7 17.8 5.7 17.8 9.4V13.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <circle cx="16.5" cy="13" r="5" stroke="currentColor" strokeWidth="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 33 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.4 13C1.4 13 6.4 1 16.5 1C26.6 1 31.6 13 31.6 13C31.6 13 26.6 25 16.5 25C6.4 25 1.4 13 1.4 13Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M2 2L31 24" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [existingRole, setExistingRole] = useState(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    let cancelled = false;
    api.get("/auth/me").then(({ data }) => {
      if (cancelled) return;
      setExistingRole(data.role);
      localStorage.setItem(
        "user",
        JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
      );
    }).catch(() => {
      if (!cancelled) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [imeWarn, setImeWarn] = useState({ email: false, password: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Inputs are uncontrolled (browser autofill), so read both values from the form.
  const handleChange = (e) => {
    const { email, password } = e.currentTarget.form.elements;
    setImeWarn({ email: hasNonAscii(email.value), password: hasNonAscii(password.value) });
  };

  if (existingRole === "CONTENT_MANAGER") {
    return <Navigate to="/content/dashboard" replace />;
  }
  if (existingRole === "ADMIN") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const loginEmail = String(formData.get("email") || "");
    const loginPassword = String(formData.get("password") || "");

    const warn = { email: hasNonAscii(loginEmail), password: hasNonAscii(loginPassword) };
    if (warn.email || warn.password) {
      setImeWarn(warn);
      return;
    }
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      // res.data = { token, email, fullName, role }
      localStorage.setItem("token", res.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: res.data.email,
          fullName: res.data.fullName,
          role: res.data.role,
        }),
      );
      // Member chưa hoàn thành / chưa bỏ qua khảo sát onboarding -> vào survey trước,
      // kể cả khi có returnTo (vd vào "/" lúc chưa đăng nhập bị chuyển sang /login?returnTo=/)
      if (res.data.role === "MEMBER" && (await needsOnboarding())) {
        markOnboardingPrompted();
        navigate("/survey", { replace: true });
        return;
      }
      const returnTo = new URLSearchParams(location.search).get("returnTo");
      const isSafeReturnTo =
        returnTo?.startsWith("/") && !returnTo.startsWith("//") && returnTo !== "/login";
      let destination = isSafeReturnTo ? returnTo : "/";
      if (res.data.role === "CONTENT_MANAGER") {
        destination = "/content/dashboard";
      } else if (res.data.role === "ADMIN") {
        // Admins only land inside the admin area; honour returnTo only when it points there.
        destination = isSafeReturnTo && returnTo.startsWith("/admin") ? returnTo : "/admin/dashboard";
      }
      navigate(destination, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (err.response?.status === 401
          ? "Incorrect email or password."
          : err.response?.status === 403
            ? "This account has not been verified or is not allowed to sign in."
            : "Could not sign in. Please try again.");
      setError(typeof msg === "string" ? msg : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <button type="button" className="login-back" onClick={() => navigate("/")}>
          &larr; Home
        </button>
        <AuthLogo />

        <h1 className="login-title">Login</h1>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">Email</label>
            <div className="login-input-wrap">
              <MailIcon />
              <input
                id="login-email"
                name="email"
                className="login-input"
                type="email"
                placeholder="Email"
                defaultValue=""
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            <ImeNotice warn={imeWarn.email} />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <LockIcon />
              <input
                id="login-password"
                name="password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                defaultValue=""
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-pw"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
              </button>
            </div>
            <ImeNotice warn={imeWarn.password} />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            <span className="login-submit-text">
              {loading ? "Signing in..." : "Login"}
            </span>
          </button>
        </form>

        <div className="login-links">
          <button type="button" className="login-link" onClick={() => navigate("/register")}>
            You don&apos;t have account? Register
          </button>
          <button type="button" className="login-link" onClick={() => navigate("/forgot-password")}>
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}
