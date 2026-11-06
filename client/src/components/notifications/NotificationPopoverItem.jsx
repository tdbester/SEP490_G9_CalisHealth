import "./NotificationPopoverItem.css";

function formatNotificationDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US");
}

export default function NotificationPopoverItem({ notification, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`notification-popover-item${notification.read ? " is-read" : ""}`}
      onClick={onClick}
    >
      <span className="notification-popover-dot" aria-hidden="true" />
      <span className="notification-popover-content">
        <strong className="notification-popover-title">{notification.title}</strong>
        <span className="notification-popover-message">{notification.message}</span>
        <time className="notification-popover-meta">
          {String(notification.type || "SYSTEM").toUpperCase()}
          {" · "}
          {formatNotificationDate(notification.createdAt)}
        </time>
      </span>
    </button>
  );
}
