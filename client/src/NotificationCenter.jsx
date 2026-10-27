import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl } from "./api.js";

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/notifications?limit=25`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load notifications.");
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  async function markRead(notification) {
    if (notification.readAt || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to mark the notification as read.");
      await loadNotifications();
    } catch (readError) {
      setError(readError.message || "Unable to mark the notification as read.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to mark notifications as read.");
      await loadNotifications();
    } catch (readError) {
      setError(readError.message || "Unable to mark notifications as read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="notification-center" aria-label="Notifications">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="notification-list"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) loadNotifications();
        }}
      >
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>
      {open && (
        <section id="notification-list" aria-labelledby="notification-heading">
          <h3 id="notification-heading">Notifications</h3>
          {unreadCount > 0 && (
            <button type="button" disabled={busy} onClick={markAllRead}>
              Mark all as read
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          {loading ? (
            <p role="status">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p>You have no notifications.</p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id} aria-label={notification.readAt ? "Read notification" : "Unread notification"}>
                  <a
                    href={notification.link}
                    onClick={() => markRead(notification)}
                    aria-current={notification.readAt ? undefined : "false"}
                  >
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{new Date(notification.createdAt).toLocaleString("en-IN")}</small>
                  </a>
                  {!notification.readAt && (
                    <button type="button" disabled={busy} onClick={() => markRead(notification)}>
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  );
}

export default NotificationCenter;
