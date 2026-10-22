import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { STREAK_DAYS } from "../../data/dashboard";
import "./Topbar.css";

function Logo() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z" fill="url(#paint0_linear_89_80)" />
      <path d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051" strokeWidth="1.5162" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
      <defs>
        <linearGradient id="paint0_linear_89_80" x1="2.3826" y1="-2.22058e-07" x2="14.1558" y2="12.2638" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B44CFF" />
          <stop offset="1" stopColor="#FF77A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Topbar() {
  const navigate = useNavigate();
  const topbarRef = useRef(null);
  const [user, setUser] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("language") || "en",
  );

  useEffect(() => {
    const cached = localStorage.getItem("user");
    if (cached) setUser(JSON.parse(cached));
  }, []);

  useEffect(() => {
    const closePanel = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpenPanel(null);
      } else if (
        event.type === "pointerdown" &&
        !topbarRef.current?.contains(event.target)
      ) {
        setOpenPanel(null);
      }
    };
    document.addEventListener("pointerdown", closePanel);
    document.addEventListener("keydown", closePanel);
    return () => {
      document.removeEventListener("pointerdown", closePanel);
      document.removeEventListener("keydown", closePanel);
    };
  }, []);

  const changeLanguage = (event) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    localStorage.setItem("language", nextLanguage);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navigateFromPanel = (path) => {
    setOpenPanel(null);
    navigate(path);
  };

  const initials =
    user?.fullName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "HV";

  return (
    <header className="topbar" ref={topbarRef}>
      <button
        type="button"
        className="topbar-logo"
        aria-label="Go to dashboard"
        onClick={() => navigateFromPanel("/")}
      >
        <div className="topbar-logo-icon">
          <Logo />
        </div>
        <span className="topbar-logo-text">Calis</span>
        <span className="gradient-text">Health</span>
      </button>

      {openPanel === "settings" && (
        <div className="topbar-popover topbar-settings-popover" role="menu">
          <div className="topbar-popover-heading">Account &amp; settings</div>
          <button
            type="button"
            className="topbar-menu-item"
            role="menuitem"
            onClick={() => navigateFromPanel("/profile")}
          >
            <PersonOutlineRoundedIcon />
            <span>Profile</span>
          </button>
          <label className="topbar-language">
            <span>Change language</span>
            <select value={language} onChange={changeLanguage} aria-label="Change language">
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </label>
          <button
            type="button"
            className="topbar-menu-item"
            role="menuitem"
            onClick={() => navigateFromPanel("/settings")}
          >
            <SettingsOutlinedIcon />
            <span>Settings</span>
          </button>
        </div>
      )}

      <div className="topbar-spacer" />

      <div className="topbar-right">
        {/* Streak badge */}
        <button
          type="button"
          className="topbar-streak"
          title={`${STREAK_DAYS} day training streak`}
          onClick={() => navigateFromPanel("/day-streak")}
        >
          <LocalFireDepartmentRoundedIcon className="topbar-streak-icon" />
          <span className="topbar-streak-days">{STREAK_DAYS} days</span>
        </button>

        {/* Notifications */}
        <div className="topbar-notification-wrap">
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Notifications"
            aria-expanded={openPanel === "notifications"}
            onClick={() =>
              setOpenPanel(openPanel === "notifications" ? null : "notifications")
            }
          >
            <NotificationsNoneRoundedIcon />
            <span className="topbar-notification-dot" />
          </button>
          {openPanel === "notifications" && (
            <section className="topbar-popover topbar-notification-popover">
              <div className="topbar-popover-heading">Notifications</div>
              <article className="topbar-notification-item">
                <span className="topbar-notification-mark" />
                <div>
                  <strong>Your workout is ready</strong>
                  <p>Today&apos;s full-body plan is waiting for you.</p>
                  <time>Today</time>
                </div>
              </article>
              <article className="topbar-notification-item">
                <span className="topbar-notification-mark" />
                <div>
                  <strong>Keep your streak going</strong>
                  <p>You&apos;re on a {STREAK_DAYS}-day training streak.</p>
                  <time>Today</time>
                </div>
              </article>
            </section>
          )}
        </div>

        {/* Avatar */}
        <button
          type="button"
          className="topbar-avatar"
          title={user?.fullName || "Profile"}
          aria-label="Open account menu"
          aria-expanded={openPanel === "settings"}
          onClick={() => setOpenPanel(openPanel === "settings" ? null : "settings")}
        >
          {initials}
        </button>

        {user ? (
          <button type="button" className="topbar-login-btn" onClick={handleLogout}>
            <span>Logout</span>
          </button>
        ) : (
          <button
            type="button"
            className="topbar-login-btn"
            onClick={() => navigate("/login")}
          >
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
}
