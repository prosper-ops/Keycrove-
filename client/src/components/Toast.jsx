import { useEffect } from "react";

/**
 * KeyCrove Toast Notification
 *
 * Displays temporary feedback messages to users.
 *
 * Supported types:
 * - success
 * - error
 * - warning
 * - info
 *
 * Props:
 * - message: The notification text.
 * - type: The notification style.
 * - onClose: Function called when the toast closes.
 * - duration: Time before automatic dismissal, in milliseconds.
 */

export default function Toast({
  message,
  type = "info",
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (!message || duration <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onClose?.();
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message, duration, onClose]);

  if (!message) {
    return null;
  }

  const allowedTypes = ["success", "error", "warning", "info"];

  const toastType = allowedTypes.includes(type) ? type : "info";

  const icons = {
    success: "✓",
    error: "!",
    warning: "⚠",
    info: "i",
  };

  const accessibleRole = toastType === "error" ? "alert" : "status";

  return (
    <div
      className={`toast toast-${toastType}`}
      role={accessibleRole}
      aria-live={toastType === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="toast-icon" aria-hidden="true">
        {icons[toastType]}
      </span>

      <p className="toast-message">{message}</p>

      <button
        type="button"
        className="toast-close"
        onClick={() => onClose?.()}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
