import { useEffect, useState } from "react";

import type { LauncherNotification } from "../services/notifications";
import { Icon } from "./Icon";

interface DisplayNotification extends LauncherNotification {
  readonly id: number;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<readonly DisplayNotification[]>([]);

  useEffect(() => {
    let nextId = 1;
    const listener = (event: Event) => {
      const notification = (event as CustomEvent<LauncherNotification>).detail;
      const id = nextId++;
      setNotifications((current) => [...current, { ...notification, id }].slice(-5));
      window.setTimeout(
        () => setNotifications((current) => current.filter((item) => item.id !== id)),
        5000,
      );
    };
    window.addEventListener("toolcenter:notification", listener);
    return () => window.removeEventListener("toolcenter:notification", listener);
  }, []);

  return (
    <section className="notification-center" aria-label="通知" aria-live="polite">
      {notifications.map((notification) => (
        <article className={`toast toast--${notification.level}`} key={notification.id}>
          <Icon name={notification.level === "error" ? "close" : notification.level === "success" ? "check" : notification.level === "warning" ? "warning" : "info"} />
          <div><strong>{notification.title}</strong>{notification.message ? <p>{notification.message}</p> : null}</div>
          <button
            className="button--icon"
            type="button"
            aria-label="关闭提示"
            onClick={() =>
              setNotifications((current) => current.filter((item) => item.id !== notification.id))
            }
          >
            <Icon name="close" />
          </button>
        </article>
      ))}
    </section>
  );
}
