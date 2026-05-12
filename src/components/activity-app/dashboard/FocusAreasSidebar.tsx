"use client";

import { Archive, Plus } from "lucide-react";
import {
  formatProjectTotal,
  formatRelativeShort,
  projectHue,
  type DashboardProject,
} from "@/lib/activity-dashboard-format";
import { hapticLight } from "@/lib/haptics";

type Props = {
  projects: DashboardProject[];
  archivedProjects: DashboardProject[];
  selectedId: string;
  onSelectProject: (id: string) => void;
  arming: boolean;
  running: boolean;
  newProjectName: string;
  onNewProjectNameChange: (v: string) => void;
  addingProject: boolean;
  onAddingProjectChange: (v: boolean) => void;
  onAddProject: () => void;
  onArchiveFocusArea: (id: string) => void;
  onRestoreArchived: (id: string) => void;
  pendingArchiveId: string | null;
};

export function FocusAreasSidebar({
  projects,
  archivedProjects,
  selectedId,
  onSelectProject,
  arming,
  running,
  newProjectName,
  onNewProjectNameChange,
  addingProject,
  onAddingProjectChange,
  onAddProject,
  onArchiveFocusArea,
  onRestoreArchived,
  pendingArchiveId,
}: Props) {
  return (
    <aside
      id="dash-section-areas"
      className="dash-section-anchor order-2 min-w-0 xl:sticky xl:top-4 xl:order-1 xl:self-start"
    >
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
        <h2 className="font-display text-lg text-[var(--foreground)]">
          Focus areas
        </h2>
        <p className="mt-0.5 text-xs text-[var(--app-muted)]">
          Classes, placements, thesis, life admin — tap one for the timer
        </p>
        <ul className="mt-4 space-y-2">
          {projects.map((p) => {
            const label = p.isMisc ? "General" : p.name;
            const active = p.id === selectedId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={arming}
                  onClick={() => {
                    hapticLight();
                    onSelectProject(p.id);
                  }}
                  className={`flex w-full min-h-[4.25rem] items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition app-pressable ${
                    active
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)]/10"
                      : "border-[var(--app-border)] bg-[var(--background)]/40 hover:border-[var(--app-accent-muted)]"
                  } disabled:opacity-50`}
                >
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: `hsl(${projectHue(label)} 50% 52%)`,
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {label}
                    </p>
                    <p className="text-xs text-[var(--app-muted)]">
                      {formatProjectTotal(p.totalSec ?? 0)}
                      <span className="opacity-50"> · </span>
                      {formatRelativeShort(p.lastSessionAt)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-[var(--app-border)] pt-4">
          {!addingProject ? (
            <button
              type="button"
              disabled={running || arming}
              onClick={() => {
                hapticLight();
                onAddingProjectChange(true);
              }}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--app-border)] text-sm font-medium text-[var(--app-accent)] transition hover:bg-[var(--app-accent)]/5 disabled:opacity-50 app-pressable"
            >
              <Plus className="h-4 w-4" />
              Add focus area
            </button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="min-h-11 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                placeholder="e.g. Practicum, thesis, MFT coursework"
                value={newProjectName}
                onChange={(e) => onNewProjectNameChange(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onAddProject();
                }}
                className="min-h-11 shrink-0 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white app-pressable"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] text-[var(--app-muted)]">
          Archive removes an area from the timer only — your streak, weekly
          progress, and activity feed stay intact.
        </p>
        <ul className="mt-2 space-y-1 border-t border-[var(--app-border)] pt-3">
          {projects
            .filter((p) => !p.isMisc)
            .map((p) => (
              <li
                key={`del-${p.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-xs text-[var(--app-muted)]"
              >
                <span className="truncate">{p.name}</span>
                <button
                  type="button"
                  disabled={running || arming}
                  title="Archive focus area (keeps your history)"
                  onClick={() => {
                    hapticLight();
                    onArchiveFocusArea(p.id);
                  }}
                  className={`shrink-0 rounded p-1.5 text-[var(--app-muted)] transition hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-40 app-pressable ${
                    pendingArchiveId === p.id
                      ? "ring-2 ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-surface-card)]"
                      : ""
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>

        {archivedProjects.length > 0 ? (
          <div className="mt-4 border-t border-[var(--app-border)] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Archived
            </p>
            <p className="mt-1 text-[10px] text-[var(--app-muted)]">
              Restore anytime — all past sessions and stats still count.
            </p>
            <ul className="mt-2 space-y-1.5">
              {archivedProjects.map((p) => (
                <li
                  key={`arc-${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)]/70 bg-[var(--background)]/35 px-2 py-1.5 text-xs"
                >
                  <span className="truncate text-[var(--app-muted)]">
                    {p.name}
                  </span>
                  <button
                    type="button"
                    disabled={running || arming}
                    onClick={() => {
                      hapticLight();
                      onRestoreArchived(p.id);
                    }}
                    className="shrink-0 rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:opacity-40 app-pressable"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
