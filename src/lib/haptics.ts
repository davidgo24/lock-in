/**
 * Best-effort vibration for supported mobile browsers.
 * Skips when `prefers-reduced-motion: reduce` is set.
 */

function motionReduced(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function vibrate(pattern: number | number[]): void {
  if (motionReduced()) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Selections, tabs, small toggles */
export function hapticLight(): void {
  vibrate(10);
}

/** Primary actions (start timer, stop & log) */
export function hapticMedium(): void {
  vibrate([12, 28, 14]);
}

/** Successful save / completion */
export function hapticSuccess(): void {
  vibrate([14, 26, 14, 26, 40]);
}

/** Second-step confirm, errors worth a bump */
export function hapticWarning(): void {
  vibrate([28, 45, 28]);
}
