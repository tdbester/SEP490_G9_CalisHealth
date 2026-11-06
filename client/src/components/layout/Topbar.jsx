import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import api from "../../api/client";
import { avatarUrl, profileApi } from "../../api/profile";
import BrandLogo from "../BrandLogo";
import "./Topbar.css";

function Logo() {
  return <BrandLogo width={12} height={18} />;
}

export default function Topbar() {
  const navigate = useNavigate();
  const topbarRef = useRef(null);
  const [user, setUser] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("language") || "en",
  );

  useEffect(() => {
    const cached = localStorage.getItem("token")
      ? localStorage.getItem("user")
      : null;
    if (cached) setUser(JSON.parse(cached));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    profileApi
      .get()
      .then((profile) => {
        if (cancelled) return;
        setUser((current) => ({ ...current, ...profile }));
        localStorage.setItem(
          "user",
          JSON.stringify({
            email: profile.email,
            fullName: profile.fullName,
            role: profile.role,
            avatarUrl: profile.avatarUrl || null,
          }),
        );
      })
      .catch(() => {
        // The topbar keeps the cached account when the profile refresh is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      setUser((current) => ({ ...current, ...event.detail }));
    };
    const handleStorageUpdated = (event) => {
      if (event.key !== "user" || !event.newValue) return;
      try {
        setUser(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed cache updates and keep the current account.
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdated);
    window.addEventListener("storage", handleStorageUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
      window.removeEventListener("storage", handleStorageUpdated);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCurrentStreak(null);
      return undefined;
    }

    let cancelled = false;
    const today = new Date();
    api.get("/member/day-streak", {
      params: { year: today.getFullYear(), month: today.getMonth() + 1 },
    })
      .then(({ data }) => {
        if (!cancelled) setCurrentStreak(data?.currentStreak ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCurrentStreak(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

      {user && openPanel === "settings" && (
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
        {user && (
          <>
            <button
              type="button"
              className="topbar-streak"
              title={`Open your ${currentStreak ?? "current"} day training streak`}
              aria-label={`Open your ${currentStreak ?? "current"} day training streak`}
              onClick={() => navigateFromPanel("/day-streak")}
            >
              <LocalFireDepartmentRoundedIcon className="topbar-streak-icon" />
              <span className="topbar-streak-days">{currentStreak ?? "-"} days</span>
            </button>

            <div className="topbar-notification-wrap">
              <button
                type="button"
                className="topbar-icon-btn"
                aria-label="Notifications"
                aria-expanded={openPanel === "notifications"}
                onClick={() =>
                  setOpenPanel(
                    openPanel === "notifications" ? null : "notifications",
                  )
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
                      <p>Complete a workout to keep your streak going.</p>
                      <time>Today</time>
                    </div>
                  </article>
                </section>
              )}
            </div>
          </>
        )}

        {user ? (
          <>
            <button
              type="button"
              className="topbar-avatar"
              title={user.fullName || "Profile"}
              aria-label="Open account menu"
              aria-expanded={openPanel === "settings"}
              onClick={() => {
                setOpenPanel(openPanel === "settings" ? null : "settings");
                profileApi.get().then((profile) => {
                  setUser((current) => ({ ...current, ...profile }));
                  localStorage.setItem(
                    "user",
                    JSON.stringify({
                      email: profile.email,
                      fullName: profile.fullName,
                      role: profile.role,
                      avatarUrl: profile.avatarUrl || null,
                    }),
                  );
                }).catch(() => {});
              }}
            >
              {user.avatarUrl ? (
                <img src={avatarUrl(user.avatarUrl)} alt="" className="topbar-avatar-image" />
              ) : (
                initials
              )}
            </button>
            <button type="button" className="topbar-logout-btn" onClick={handleLogout}>
              <LogoutRoundedIcon />
              <span>Logout</span>
            </button>
          </>
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
