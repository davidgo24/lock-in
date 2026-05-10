/**
 * WebAudio helpers for timer feedback (call from a user gesture for best autoplay behavior).
 */

/** Three short tones (3 → 2 → 1) spaced ~1s apart, then resolves so the work timer can start. */
export async function playStartCountdown(): Promise<void> {
  const ctx = new AudioContext();
  await ctx.resume().catch(() => {});

  const t0 = ctx.currentTime;
  const hz = [880, 660, 440];

  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = hz[i] ?? 440;
    const start = t0 + i * 1.0;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.055, start + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + 0.18);
  }

  await new Promise((r) => setTimeout(r, 3100));
  await ctx.close();
}

/** Stronger chime + haptics — phones often need volume up; user must start timer from a tap for audio unlock. */
export async function playTimerCompleteRing(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([160, 90, 160, 90, 220, 120, 280]);
    }
  } catch {
    /* ignore */
  }

  const ctx = new AudioContext();
  await ctx.resume().catch(() => {});

  const t = ctx.currentTime;
  const ring = (freq: number, at: number, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.022);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.38);
  };

  const volMain = 0.075;
  const volEcho = 0.045;
  /* Two short phrases so it’s noticeable on phone speakers. */
  ring(880, t, volMain);
  ring(1174.66, t + 0.18, volEcho);
  ring(880, t + 0.4, volMain);
  ring(1318.51, t + 0.58, volEcho);

  await new Promise((r) => setTimeout(r, 1200));
  await ctx.close().catch(() => {});
}
