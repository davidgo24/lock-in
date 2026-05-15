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

export type SessionPhase = "focus" | "overtime" | "break";

export type PersistedTimerV3 = {
  v: 3;
  selectedId: string;
  durationSec: number;
  presetIdx: number;
  paused: boolean;
  sessionPhase: SessionPhase;
  remaining: number;
  endsAt: number | null;
  pausedSince: number | null;
  /**
   * With `sessionPhase === "overtime"` and not paused: seconds accumulated before
   * `overtimeRunStartedAt` (wall-clock segment). When paused or in `break`, this is
   * the full overtime total (same as displayed).
   */
  overtimeSec: number;
  /**
   * Epoch ms when the current overtime *running* segment began; null if overtime is
   * paused or not counting (e.g. during break). Omit in older stored data → hydrate
   * treats as legacy tick-based total in `overtimeSec`.
   */
  overtimeRunStartedAt: number | null;
  breakEndsAt: number | null;
  /** When `sessionPhase === "break"` and paused: frozen seconds left on the break timer. */
  breakRemainingSec: number | null;
  /** Total break length when in `break` (for progress ring). */
  breakTotalSec: number;
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

function isSessionPhase(x: unknown): x is SessionPhase {
  return x === "focus" || x === "overtime" || x === "break";
}

export function parsePersisted(raw: string | null): PersistedTimerV3 | null {
  if (raw == null || typeof window === "undefined") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.v === 3) {
      const p = o as Partial<PersistedTimerV3>;
      if (typeof p.selectedId !== "string") return null;
      if (typeof p.durationSec !== "number" || typeof p.remaining !== "number")
        return null;
      if (typeof p.presetIdx !== "number") return null;
      if (typeof p.paused !== "boolean") return null;
      if (!isSessionPhase(p.sessionPhase)) return null;
      if (p.endsAt != null && typeof p.endsAt !== "number") return null;
      if (p.pausedSince != null && typeof p.pausedSince !== "number")
        return null;
      if (typeof p.overtimeSec !== "number") return null;
      if (p.breakEndsAt != null && typeof p.breakEndsAt !== "number")
        return null;
      const brRem = p.breakRemainingSec;
      if (brRem != null && typeof brRem !== "number") return null;
      const bTot = p.breakTotalSec;
      if (bTot != null && typeof bTot !== "number") return null;
      if (
        !Number.isFinite(p.durationSec) ||
        p.durationSec < MIN_TIMER_SEC ||
        p.presetIdx < 0 ||
        p.presetIdx > CUSTOM_PRESET_IDX
      ) {
        return null;
      }
      const ortRaw = (
        p as Partial<{ overtimeRunStartedAt: unknown }>
      ).overtimeRunStartedAt;
      const overtimeRunStartedAt =
        ortRaw == null
          ? null
          : typeof ortRaw === "number" && Number.isFinite(ortRaw)
            ? ortRaw
            : null;
      return {
        v: 3,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: p.paused,
        sessionPhase: p.sessionPhase,
        remaining: Math.max(0, Math.floor(p.remaining)),
        endsAt: p.endsAt ?? null,
        pausedSince: p.pausedSince ?? null,
        overtimeSec: Math.max(0, Math.floor(p.overtimeSec)),
        overtimeRunStartedAt,
        breakEndsAt: p.breakEndsAt ?? null,
        breakRemainingSec:
          brRem == null ? null : Math.max(0, Math.floor(brRem)),
        breakTotalSec:
          typeof bTot === "number" ? Math.max(0, Math.floor(bTot)) : 0,
      };
    }
    if (o.v === 2) {
      const p = o as Partial<{
        selectedId: string;
        durationSec: number;
        presetIdx: number;
        paused: boolean;
        remaining: number;
        endsAt: number | null;
        pausedSince: number | null;
      }> & { v?: number };
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
        v: 3,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: p.paused,
        sessionPhase: "focus",
        remaining: Math.max(0, Math.floor(p.remaining)),
        endsAt: p.endsAt ?? null,
        pausedSince: p.pausedSince ?? null,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
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
        v: 3,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: false,
        sessionPhase: "focus",
        remaining: Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000)),
        endsAt: p.endsAt,
        pausedSince: null,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeTimerStorage(p: PersistedTimerV3) {
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

export function tryMigrateLegacyV1Key(): PersistedTimerV3 | null {
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
    const record: PersistedTimerV3 = {
      ...p,
      v: 3,
      remaining: left,
      paused: false,
      pausedSince: null,
      sessionPhase: "focus",
      overtimeSec: 0,
      overtimeRunStartedAt: null,
      breakEndsAt: null,
      breakRemainingSec: null,
      breakTotalSec: 0,
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
