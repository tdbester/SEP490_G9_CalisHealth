import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import api from "../../api/client";
import NotificationBell from "../notifications/NotificationBell";
import { avatarUrl, profileApi } from "../../api/profile";
import BrandLogo from "../BrandLogo";
import { changeLanguage, currentLanguage } from "../../i18n";
import { notifyAuthSessionChanged } from "../../utils/authSession";
import "./Topbar.css";

function Logo() {
  return <BrandLogo width={12} height={18} />;
}

export default function Topbar() {
  const navigate = useNavigate();
  const topbarRef = useRef(null);
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [currentStreak, setCurrentStreak] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem("token")
      ? localStorage.getItem("user")
      : null;
    if (!cached) return;
    try {
      setUser(JSON.parse(cached));
    } catch (error) {
      console.error("Could not read the cached member profile:", error);
      setUser(null);
    }
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    notifyAuthSessionChanged();
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
        aria-label={t("common.ui.goToDashboard")}
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
          <div className="topbar-popover-heading">{t("common.ui.accountAndSettings")}</div>
          <button
            type="button"
            className="topbar-menu-item"
            role="menuitem"
            onClick={() => navigateFromPanel("/profile")}
          >
            <PersonOutlineRoundedIcon />
            <span>{t("nav.profile")}</span>
          </button>
          <label className="topbar-language">
            <span>{t("common.changeLanguage")}</span>
            <select
              value={currentLanguage()}
              onChange={(event) => changeLanguage(event.target.value)}
              aria-label={t("common.changeLanguage")}
            >
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
            <span>{t("nav.settings")}</span>
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

            <NotificationBell
              apiClient={api}
              onOpen={() => setOpenPanel(null)}
            />
          </>
        )}

        {user ? (
          <>
            <button
              type="button"
              className="topbar-avatar"
              title={user.fullName || "Profile"}
              aria-label={t("common.ui.openAccountMenu")}
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
              <span>{t("nav.logout")}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="topbar-login-btn"
            onClick={() => navigate("/login")}
          >
            <span>{t("nav.login")}</span>
          </button>
        )}
      </div>
    </header>
  );
}
