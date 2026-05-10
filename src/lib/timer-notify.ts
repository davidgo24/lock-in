/**
 * Browser notifications when the focus timer ends (best-effort; iOS Safari is limited).
 * Permission is requested from the same user gesture that starts the timer when possible.
 */

export function requestTimerNotifyPermissionIfNeeded(): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  void Notification.requestPermission();
}

export function notifyTimerComplete(): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Time’s up", {
      body: "Your focus block ended — save a quick note when you’re ready.",
      tag: "focus-timer-done",
      requireInteraction: true,
    });
  } catch {
    /* ignored */
  }
}
