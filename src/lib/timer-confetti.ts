"use client";

/** One-shot celebration when the focus block hits zero (respects reduced motion). */
export function fireFocusCompleteConfetti(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch {
    /* ignore */
  }

  void import("canvas-confetti").then((mod) => {
    const confetti = mod.default;
    const count = 130;
    const base = {
      particleCount: Math.floor(count * 0.45),
      spread: 62,
      startVelocity: 38,
      ticks: 140,
      gravity: 1.05,
      scalar: 0.95,
      origin: { x: 0.5, y: 0.35 },
    };
    confetti({ ...base, angle: 55 });
    confetti({ ...base, angle: 125 });
  });
}
