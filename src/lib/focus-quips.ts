export const FOCUS_QUIPS = [
  "Main-character focus mode…",
  "Loading discipline.exe ████████░░",
  "Brain: do not disturb",
  "Currently unavailable — leveling up",
  "Deep work — please hold the line",
  "Focus session: LIVE",
  "Neurons: we have a situation (a good one)",
  "Work.exe is not responding to distractions",
  "Hold pls — pixel / paper / people stuff",
] as const;

export function focusQuipForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return FOCUS_QUIPS[Math.abs(h) % FOCUS_QUIPS.length] ?? FOCUS_QUIPS[0];
}

/** Short “~N min left” from an ISO end time. */
export function focusMinutesLeftLabel(endsAtIso: string): string {
  const ms = new Date(endsAtIso).getTime() - Date.now();
  if (ms <= 0) return "";
  const m = Math.max(1, Math.ceil(ms / 60_000));
  if (m === 1) return "~1 min left";
  return `~${m} min left`;
}
