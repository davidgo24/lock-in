"use client";

import { Clock, Coffee, Pause, Play, RotateCcw } from "lucide-react";
import {
  CUSTOM_PRESET_IDX,
  MAX_TIMER_SEC,
  MIN_TIMER_SEC,
  PRESETS,
  type SessionPhase,
} from "@/lib/activity-timer-local";
import { formatClock } from "@/lib/activity-dashboard-format";
import type { DashboardProject } from "@/lib/activity-dashboard-format";
import { hapticLight, hapticMedium, hapticWarning } from "@/lib/haptics";

type Props = {
  selectedProject: DashboardProject | undefined;
  projects: DashboardProject[];
  selectedId: string;
  onSelectProject: (id: string) => void;
  arming: boolean;
  remaining: number;
  durationSec: number;
  running: boolean;
  paused: boolean;
  sessionPhase: SessionPhase;
  overtimeSec: number;
  breakRemaining: number;
  breakTotalSec: number;
  presetIdx: number;
  onApplyPreset: (idx: number) => void;
  customHours: number;
  customMinutes: number;
  onCustomHoursMinutesChange: (h: number, m: number) => void;
  onStartSession: () => void;
  onPauseOrResume: () => void;
  onStopAndLog: () => void;
  onDiscardTap: () => void;
  onEndBreakEarly: () => void;
  onOpenBreakOffer: () => void;
  pendingDiscard: boolean;
};

export function FocusTimerPanel({
  selectedProject,
  projects,
  selectedId,
  onSelectProject,
  arming,
  remaining,
  durationSec,
  running,
  paused,
  sessionPhase,
  overtimeSec,
  breakRemaining,
  breakTotalSec,
  presetIdx,
  onApplyPreset,
  customHours,
  customMinutes,
  onCustomHoursMinutesChange,
  onStartSession,
  onPauseOrResume,
  onStopAndLog,
  onDiscardTap,
  onEndBreakEarly,
  onOpenBreakOffer,
  pendingDiscard,
}: Props) {
  const progress =
    sessionPhase === "focus" && durationSec > 0
      ? 1 - remaining / durationSec
      : sessionPhase === "overtime"
        ? 1
        : sessionPhase === "break" && breakTotalSec > 0
          ? 1 - breakRemaining / breakTotalSec
          : 0;

  const clockMain =
    sessionPhase === "break"
      ? formatClock(breakRemaining)
      : sessionPhase === "overtime"
        ? `+${formatClock(overtimeSec)}`
        : formatClock(remaining);

  const showArmingEllipsis = arming && sessionPhase === "focus";

  const phaseLabel =
    sessionPhase === "break"
      ? paused
        ? "Break paused"
        : "On break"
      : sessionPhase === "overtime"
        ? paused
          ? "Overtime paused"
          : "Overtime"
        : paused
          ? "Paused"
          : "In progress";

  const ringClass =
    sessionPhase === "break"
      ? "stroke-amber-500"
      : sessionPhase === "overtime"
        ? "stroke-emerald-500"
        : "stroke-[var(--app-accent)]";

  const circ = 2 * Math.PI * 44;

  return (
    <div
      id="dash-section-timer"
      className="dash-section-anchor rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10 sm:p-7"
    >
      <p className="font-display text-lg text-[var(--foreground)] sm:text-xl">
        What are you focusing on?
      </p>
      {selectedProject ? (
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          On{" "}
          <span className="font-medium text-[var(--foreground)]/80">
            {selectedProject.isMisc ? "General" : selectedProject.name}
          </span>
        </p>
      ) : null}

      <div className="mt-5 flex justify-center">
        <div className="relative h-40 w-40 max-w-[min(100%,10rem)] shrink-0">
          <svg className="-rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              className="stroke-[var(--background)]"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              className={`${ringClass} motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={circ * (1 - progress)}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`text-3xl font-semibold tabular-nums text-[var(--foreground)] ${sessionPhase === "overtime" ? "text-emerald-500 dark:text-emerald-400" : ""}`}
            >
              {showArmingEllipsis ? "…" : clockMain}
            </div>
            {running ? (
              <span
                className={`mt-0.5 text-[10px] font-medium uppercase tracking-wider sm:text-xs ${
                  paused
                    ? "text-amber-600 dark:text-amber-400"
                    : sessionPhase === "break"
                      ? "text-amber-600 dark:text-amber-400"
                      : sessionPhase === "overtime"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[var(--app-accent)]"
                }`}
              >
                {phaseLabel}
              </span>
            ) : null}
            {sessionPhase === "break" ? (
              <Coffee className="mt-1 h-4 w-4 text-[var(--app-muted)]" />
            ) : (
              <Clock className="mt-1 h-4 w-4 text-[var(--app-muted)]" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
          Focus area
        </label>
        <p className="mt-1 text-[11px] leading-snug text-[var(--app-muted)]">
          You can switch focus area while the timer runs — your save will use
          whichever area is selected when you finish.
        </p>
        <select
          className="mt-1 min-h-11 w-full appearance-none rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-60"
          value={selectedId}
          disabled={arming}
          onChange={(e) => {
            hapticLight();
            onSelectProject(e.target.value);
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isMisc ? "General" : p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            disabled={running || arming}
            onClick={() => {
              hapticLight();
              onApplyPreset(i);
            }}
            className={`app-pressable min-h-11 flex-1 rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
              presetIdx === i
                ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white shadow-md shadow-[var(--app-accent)]/30"
                : "border-[var(--app-border)] bg-[var(--background)]/50 text-[var(--foreground)] active:opacity-90"
            } disabled:opacity-50`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--background)]/30 p-3 sm:p-4">
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
          Custom length
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            disabled={running || arming}
            aria-label="Hours"
            className="min-h-11 w-[4.5rem] rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-center text-base tabular-nums text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-50"
            value={customHours}
            onChange={(e) =>
              onCustomHoursMinutesChange(
                parseInt(e.target.value, 10) || 0,
                customMinutes,
              )
            }
          />
          <span className="text-sm text-[var(--app-muted)]">h</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            disabled={running || arming}
            aria-label="Minutes"
            className="min-h-11 w-[4.5rem] rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-center text-base tabular-nums text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-50"
            value={customMinutes}
            onChange={(e) =>
              onCustomHoursMinutesChange(
                customHours,
                parseInt(e.target.value, 10) || 0,
              )
            }
          />
          <span className="text-sm text-[var(--app-muted)]">m</span>
          {presetIdx === CUSTOM_PRESET_IDX && !(running || arming) ? (
            <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-[var(--app-accent)]">
              Custom
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
          Between {MIN_TIMER_SEC / 60} minute and {MAX_TIMER_SEC / 3600} hours.
          Values are clipped to that range.
        </p>
      </div>

      {!running ? (
        <button
          type="button"
          disabled={!selectedId || arming}
          onClick={() => {
            hapticMedium();
            onStartSession();
          }}
          className="app-pressable mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] py-3.5 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/30 transition hover:bg-[var(--app-accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4 shrink-0 fill-current" />
          {arming ? "Get ready…" : "Start session"}
        </button>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {sessionPhase === "overtime" ? (
            <button
              type="button"
              disabled={arming}
              onClick={() => {
                hapticLight();
                onOpenBreakOffer();
              }}
              className="app-pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/45 bg-amber-500/10 py-3.5 text-sm font-medium text-amber-800 dark:text-amber-200 active:scale-[0.99] disabled:opacity-50"
            >
              <Coffee className="h-4 w-4 shrink-0" />
              Take a break
            </button>
          ) : null}
          {sessionPhase === "break" ? (
            <button
              type="button"
              disabled={arming}
              onClick={() => {
                hapticMedium();
                onEndBreakEarly();
              }}
              className="app-pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/10 py-3.5 text-sm font-medium text-emerald-800 dark:text-emerald-200 active:scale-[0.99] disabled:opacity-50"
            >
              End break
            </button>
          ) : null}
          <button
            type="button"
            disabled={arming}
            onClick={() => {
              hapticLight();
              onPauseOrResume();
            }}
            className="app-pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 py-3.5 text-sm font-medium text-[var(--foreground)] active:scale-[0.99] disabled:opacity-50"
          >
            {paused ? (
              <>
                <Play className="h-4 w-4 shrink-0 fill-current" />
                {arming ? "…" : "Resume"}
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 shrink-0" />
                Pause
              </>
            )}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onStopAndLog();
              }}
              className="app-pressable flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] py-3.5 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 active:scale-[0.99]"
            >
              Stop &amp; log
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDiscard) hapticWarning();
                else hapticLight();
                onDiscardTap();
              }}
              className={`app-pressable flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-medium active:opacity-90 ${
                pendingDiscard
                  ? "border-[var(--app-accent)] bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "border-[var(--app-border)] bg-[var(--background)]/50 text-[var(--foreground)]"
              }`}
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              {pendingDiscard ? "Tap again to discard" : "Discard"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
        When your block ends you&apos;ll get confetti and an overtime clock — tap{" "}
        <span className="font-medium text-[var(--foreground)]/90">
          Stop &amp; log
        </span>{" "}
        to save (planned time + overtime; breaks don&apos;t count). Pause anytime;
        after 5 minutes paused we nudge you. Turn volume up for the chime when
        the block completes.
      </p>
    </div>
  );
}
