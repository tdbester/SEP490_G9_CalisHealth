import { useCallback, useEffect, useRef, useState } from "react";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import notificationToast from "../../utils/notificationToast";
import NotificationDetailModal from "./NotificationDetailModal";
import NotificationPopoverItem from "./NotificationPopoverItem";
import "./NotificationBell.css";

export default function NotificationBell({
  apiClient,
  onOpen,
  ariaLabel = "Notifications",
}) {
  const bellRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get("/notifications");
      const items = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(items);
      setUnreadCount(
        Number.isFinite(data?.unreadCount)
          ? data.unreadCount
          : items.filter((notification) => !notification.read).length,
      );
      setNotificationError("");
    } catch (error) {
      console.error("Could not load notifications:", error);
      setNotificationError("Could not load notifications. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 10000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    window.addEventListener("member-notifications-updated", loadNotifications);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("member-notifications-updated", loadNotifications);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const closePopover = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        setIsOpen(false);
      } else if (
        event.type === "pointerdown" &&
        !bellRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closePopover);
    document.addEventListener("keydown", closePopover);
    return () => {
      document.removeEventListener("pointerdown", closePopover);
      document.removeEventListener("keydown", closePopover);
    };
  }, []);

  const togglePopover = () => {
    setIsOpen((current) => !current);
    onOpen?.();
    void loadNotifications();
  };

  const viewNotification = async (notification) => {
    setIsOpen(false);
    setSelectedNotification(notification);
    if (notification.read) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await apiClient.post(`/notifications/${notification.id}/read`);
    } catch (error) {
      console.error("Could not mark notification as read:", error);
      notificationToast.error("Could not update notification status. Please try again.");
      void loadNotifications();
    }
  };

  return (
    <>
      <div className="notification-bell" ref={bellRef}>
        <button
          type="button"
          className="notification-bell-trigger"
          aria-label={`${ariaLabel}${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={togglePopover}
        >
          <NotificationsNoneRoundedIcon />
          {unreadCount > 0 && (
            <span className="notification-bell-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
        {isOpen && (
          <section
            className="notification-bell-popover"
            role="menu"
            aria-label="Notifications"
          >
            <div className="notification-bell-heading">Notifications</div>
            {notificationError ? (
              <div className="notification-bell-empty" role="alert">
                <p>{notificationError}</p>
                <button
                  type="button"
                  className="notification-bell-retry"
                  onClick={() => void loadNotifications()}
                  disabled={isLoading}
                >
                  {isLoading ? "Retrying…" : "Retry"}
                </button>
              </div>
            ) : isLoading && notifications.length === 0 ? (
              <p className="notification-bell-empty" role="status">
                Loading notifications…
              </p>
            ) : notifications.length === 0 ? (
              <p className="notification-bell-empty">No notifications yet.</p>
            ) : (
              <div className="notification-popover-list">
                {notifications.map((notification) => (
                  <NotificationPopoverItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => void viewNotification(notification)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </>
  );
}
