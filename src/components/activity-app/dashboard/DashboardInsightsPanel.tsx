"use client";

import { Clock, Flame, Folder } from "lucide-react";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import type { StatsBundle } from "@/lib/stats";
import { formatWeeklyHoursLine } from "@/lib/activity-dashboard-format";
import { hapticLight } from "@/lib/haptics";

type Props = {
  stats: StatsBundle;
  totalLabel: string;
  weeklyPct: number;
  goalEdit: boolean;
  goalDraft: string;
  onGoalDraftChange: (v: string) => void;
  onBeginGoalEdit: () => void;
  onSaveWeeklyGoal: () => void;
};

export function DashboardInsightsPanel({
  stats,
  totalLabel,
  weeklyPct,
  goalEdit,
  goalDraft,
  onGoalDraftChange,
  onBeginGoalEdit,
  onSaveWeeklyGoal,
}: Props) {
  return (
    <div
      id="dash-section-progress"
      className="dash-section-anchor flex flex-col gap-6"
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
          <Clock className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
          <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
            {formatWeeklyHoursLine(stats?.weeklyLoggedMinutes ?? 0)}
          </p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
            This week
          </p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
          <Flame className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
          <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
            {stats?.streak ?? 0}
          </p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
            Day streak
          </p>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
          <Folder className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
          <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
            {stats?.activeProjectsCount ?? 1}
          </p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
            Areas
          </p>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="font-display text-lg text-[var(--foreground)]">
            Activity over time
          </h2>
          <span className="text-xs text-[var(--app-muted)]">{totalLabel}</span>
        </div>
        <ContributionHeatmap
          heatmap={stats.heatmap}
          rangeStartKey={stats.heatmapRangeStart}
        />
      </div>

      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg text-[var(--foreground)]">
              Weekly goal
            </h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              {weeklyPct}% of {stats?.weeklyGoalHours ?? 7}h target
            </p>
          </div>
          {!goalEdit ? (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBeginGoalEdit();
              }}
              className="app-pressable min-h-10 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-3 py-2 text-sm text-[var(--foreground)] active:opacity-90"
            >
              Edit goal
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="min-h-10 w-24 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-base text-[var(--foreground)]"
                value={goalDraft}
                onChange={(e) => onGoalDraftChange(e.target.value)}
              />
              <button
                type="button"
                className="app-pressable min-h-10 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white active:scale-[0.99]"
                onClick={() => {
                  hapticLight();
                  onSaveWeeklyGoal();
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--background)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--app-accent)] to-[var(--app-highlight)] motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
