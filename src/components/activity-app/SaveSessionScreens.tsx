"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDurationLabel } from "@/lib/activity-dashboard-format";

type SaveProject = { id: string; name: string; isMisc: boolean };

type Props = {
  /** When true, `saveProject` may be undefined (archived/missing focus area). */
  missingProject: boolean;
  saveProject?: SaveProject;
  sessionSaveHint: { durationSec: number; early: boolean } | null;
  summary: string;
  onSummaryChange: (v: string) => void;
  saving: boolean;
  onSaveSession: () => void;
  onLogout: () => void | Promise<void>;
  onBackToDashboard: () => void;
};

export function SaveSessionScreens({
  missingProject,
  saveProject,
  sessionSaveHint,
  summary,
  onSummaryChange,
  saving,
  onSaveSession,
  onLogout,
  onBackToDashboard,
}: Props) {
  if (missingProject || !saveProject) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-[var(--app-muted)]">
          This focus area is no longer available. Discard and return to the
          dashboard.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white active:scale-[0.99]"
          onClick={onBackToDashboard}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6 sm:py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-tight text-[var(--foreground)] sm:text-3xl">
              Log this session
            </h1>
            <p className="mt-1 text-sm text-[var(--app-muted)] sm:text-base">
              A few words about what you did — that&apos;s your accountability
              trail.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void onLogout()}
              className="min-h-11 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2.5 text-sm text-[var(--foreground)] active:opacity-90"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-6 shadow-xl shadow-black/15 backdrop-blur-sm sm:p-8">
        <h2 className="text-center text-base font-medium text-[var(--foreground)] sm:text-lg">
          Session for{" "}
          <span className="font-semibold text-[var(--app-accent)]">
            {saveProject.name}
          </span>
        </h2>
        {sessionSaveHint ? (
          <p className="mt-2 text-center text-sm text-[var(--app-muted)]">
            {sessionSaveHint.early
              ? `Saving ${formatDurationLabel(sessionSaveHint.durationSec)} — the time you focused before stopping.`
              : `Full block: ${formatDurationLabel(sessionSaveHint.durationSec)}.`}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-semibold text-[var(--foreground)] sm:mt-8">
          What did you work on?
        </label>
        <textarea
          className="mt-2 min-h-[140px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-3 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 placeholder:text-[var(--app-muted)] focus:ring-2"
          placeholder="Reading, coursework, clients, admin — whatever you focused on…"
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
        />

        <button
          type="button"
          disabled={saving || summary.trim().length < 1}
          onClick={() => void onSaveSession()}
          className="mt-6 min-h-11 w-full rounded-xl bg-[var(--app-accent)] py-3 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 transition hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}
