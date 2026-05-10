/** Match server cap in `/api/me/focus-status`. */
export const MIN_TIMER_SEC = 60;
export const MAX_TIMER_SEC = 25 * 60 * 60;

export const PRESETS = [
  { label: "30m", seconds: 30 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "2h", seconds: 120 * 60 },
] as const;

export const CUSTOM_PRESET_IDX = PRESETS.length;

export const TIMER_STORAGE_KEY = "activity-tracker-timer-v2";

/** @deprecated Old key used v1 shapes; we still read them once for migration. */
export const LEGACY_TIMER_STORAGE_KEY = "activity-tracker-timer-v1";

export type PersistedTimerV2 = {
  v: 2;
  selectedId: string;
  durationSec: number;
  presetIdx: number;
  paused: boolean;
  remaining: number;
  endsAt: number | null;
  pausedSince: number | null;
};

type PersistedTimerV1 = {
  v: 1;
  endsAt: number;
  durationSec: number;
  presetIdx: number;
  selectedId: string;
};

export function clampDurationSec(sec: number): number {
  return Math.max(
    MIN_TIMER_SEC,
    Math.min(MAX_TIMER_SEC, Math.floor(sec)),
  );
}

export function parsePersisted(raw: string | null): PersistedTimerV2 | null {
  if (raw == null || typeof window === "undefined") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.v === 2) {
      const p = o as Partial<PersistedTimerV2>;
      if (typeof p.selectedId !== "string") return null;
      if (typeof p.durationSec !== "number" || typeof p.remaining !== "number")
        return null;
      if (typeof p.presetIdx !== "number") return null;
      if (typeof p.paused !== "boolean") return null;
      if (p.endsAt != null && typeof p.endsAt !== "number") return null;
      if (p.pausedSince != null && typeof p.pausedSince !== "number")
        return null;
      if (
        !Number.isFinite(p.durationSec) ||
        p.durationSec < MIN_TIMER_SEC ||
        p.presetIdx < 0 ||
        p.presetIdx > CUSTOM_PRESET_IDX
      ) {
        return null;
      }
      return {
        v: 2,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: p.paused,
        remaining: Math.max(0, Math.floor(p.remaining)),
        endsAt: p.endsAt ?? null,
        pausedSince: p.pausedSince ?? null,
      };
    }
    if (o.v === 1) {
      const p = o as Partial<PersistedTimerV1>;
      if (typeof p.endsAt !== "number" || typeof p.durationSec !== "number")
        return null;
      if (typeof p.presetIdx !== "number" || typeof p.selectedId !== "string")
        return null;
      if (
        !Number.isFinite(p.endsAt) ||
        p.durationSec < MIN_TIMER_SEC ||
        p.presetIdx < 0 ||
        p.presetIdx >= PRESETS.length
      ) {
        return null;
      }
      return {
        v: 2,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: false,
        remaining: Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000)),
        endsAt: p.endsAt,
        pausedSince: null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeTimerStorage(p: PersistedTimerV2) {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota */
  }
}

export function clearTimerStorage() {
  try {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function tryMigrateLegacyV1Key(): PersistedTimerV2 | null {
  try {
    const legacy = localStorage.getItem(LEGACY_TIMER_STORAGE_KEY);
    if (!legacy) return null;
    const p = parsePersisted(legacy);
    if (!p || p.paused || p.endsAt == null) {
      localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
      return null;
    }
    const left = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));
    localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
    if (left <= 0) return null;
    const record: PersistedTimerV2 = {
      ...p,
      remaining: left,
      paused: false,
      pausedSince: null,
    };
    writeTimerStorage(record);
    return record;
  } catch {
    try {
      localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
