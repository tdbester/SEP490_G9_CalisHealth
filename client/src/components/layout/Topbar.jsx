import { useNavigate } from "react-router-dom";
import { useCallback, useState, useEffect, useRef } from "react";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import api from "../../api/client";
import notificationToast from "../../utils/notificationToast";
import "../../styles/notification.css";
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
  const [currentStreak, setCurrentStreak] = useState(null);
  const [memberNotifications, setMemberNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [openPanel, setOpenPanel] = useState(null);
  const [language, setLanguage] = useState(
    () => localStorage.getItem("language") || "en",
  );

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

  const loadMemberNotifications = useCallback(async () => {
    if (!user || !localStorage.getItem("token")) return;
    setNotificationsLoading(true);
    setNotificationLoadError("");
    try {
      const { data } = await api.get("/notifications");
      const receivedNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
      setMemberNotifications(receivedNotifications);
      setUnreadNotificationCount(
        Number.isFinite(data?.unreadCount)
          ? data.unreadCount
          : receivedNotifications.filter((notification) => !notification.read).length,
      );
    } catch (error) {
      console.error("Could not load member notifications:", error);
      setNotificationLoadError(
        error.response?.status === 404
          ? "Notification service is unavailable. Restart the backend and try again."
          : "Could not load notifications. Check the backend connection and try again.",
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    loadMemberNotifications();
    const intervalId = window.setInterval(loadMemberNotifications, 10000);
    const refreshOnPublish = () => loadMemberNotifications();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadMemberNotifications();
    };
    window.addEventListener("member-notifications-updated", refreshOnPublish);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("member-notifications-updated", refreshOnPublish);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadMemberNotifications, user]);

  const toggleNotifications = () => {
    const opening = openPanel !== "notifications";
    setOpenPanel(opening ? "notifications" : null);
    if (opening) loadMemberNotifications();
  };

  const markNotificationAsRead = async (notification) => {
    if (notification.read) return;
    setMemberNotifications((current) =>
      current.map((item) => item.id === notification.id ? { ...item, read: true } : item),
    );
    setUnreadNotificationCount((count) => Math.max(0, count - 1));
    try {
      await api.post(`/notifications/${notification.id}/read`);
    } catch (error) {
      console.error("Could not mark member notification as read:", error);
      notificationToast.error("Could not update notification status. Please try again.");
      loadMemberNotifications();
    }
  };

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
                onClick={toggleNotifications}
              >
                <NotificationsNoneRoundedIcon />
                {unreadNotificationCount > 0 && (
                  <span className="topbar-notification-badge">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>
              {openPanel === "notifications" && (
                <section className="topbar-popover topbar-notification-popover">
                  <div className="topbar-popover-heading">Notifications</div>
                  {notificationLoadError ? (
                    <div className="topbar-notification-empty" role="alert">
                      <p>{notificationLoadError}</p>
                      <button
                        type="button"
                        className="topbar-notification-retry"
                        onClick={loadMemberNotifications}
                        disabled={notificationsLoading}
                      >
                        {notificationsLoading ? "Retrying…" : "Retry"}
                      </button>
                    </div>
                  ) : notificationsLoading && memberNotifications.length === 0 ? (
                    <p className="topbar-notification-empty" role="status">Loading notifications…</p>
                  ) : memberNotifications.length === 0 ? (
                    <p className="topbar-notification-empty">No notifications yet.</p>
                  ) : memberNotifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={`topbar-notification-item ${notification.read ? "is-read" : ""}`}
                      onClick={() => markNotificationAsRead(notification)}
                    >
                      {!notification.read && <span className="topbar-notification-mark" />}
                      <span className="topbar-notification-content">
                        <strong>{notification.title}</strong>
                        <span className="topbar-notification-message">{notification.message}</span>
                        <time>{notification.type} · {new Date(notification.createdAt).toLocaleDateString("en-US")}</time>
                      </span>
                    </button>
                  ))}
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
              onClick={() =>
                setOpenPanel(openPanel === "settings" ? null : "settings")
              }
            >
              {initials}
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
