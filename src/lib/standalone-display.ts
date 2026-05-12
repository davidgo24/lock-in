/**
 * True when the app runs as an installed / “Add to Home Screen” web app
 * (`display-mode: standalone`), not inside the normal browser chrome.
 * iOS Safari also exposes legacy `navigator.standalone`.
 */
export function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const n = window.navigator as Navigator & { standalone?: boolean };
  return n.standalone === true;
}
