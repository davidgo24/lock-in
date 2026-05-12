import {
  CUSTOM_PRESET_IDX,
  clampDurationSec,
  PRESETS,
} from "@/lib/activity-timer-local";

export type DashboardProject = {
  id: string;
  name: string;
  isMisc: boolean;
  totalSec?: number;
  lastSessionAt?: string | null;
};

export function projectHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function formatProjectTotal(sec: number): string {
  if (sec <= 0) return "No time yet";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m total`;
  return `${m}m total`;
}

export function formatWeeklyHoursLine(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatRelativeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return "a while ago";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}

export function localYmdFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Elapsed seconds when stopping early — save real time focused, at least 1 second. */
export function durationSecToStore(raw: number): number {
  return Math.max(1, Math.round(raw));
}

export function formatDurationLabel(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return m === 1 ? "1 min" : `${m} min`;
  return `${m} min ${s} sec`;
}

export function defaultSelectedId(projects: DashboardProject[]) {
  const misc = projects.find((p) => p.isMisc);
  return misc?.id ?? projects[0]?.id ?? "";
}

export function presetIdxForDuration(totalSec: number): number {
  const i = PRESETS.findIndex((p) => p.seconds === totalSec);
  return i >= 0 ? i : CUSTOM_PRESET_IDX;
}

export function splitHoursMinutes(totalSec: number): { h: number; m: number } {
  const s = clampDurationSec(totalSec);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) };
}
