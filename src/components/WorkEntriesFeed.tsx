"use client";

export type WorkEntryRow = {
  id: string;
  summary: string;
  durationSec: number;
  createdAt: string;
  workDate: string;
  project: { name: string; isMisc: boolean };
  /** When set (friend feed), shown instead of `displayName`. */
  authorLabel?: string;
};

function formatWorkedFor(sec: number): string {
  if (sec < 60) return `Worked for ${sec}s`;
  const m = Math.floor(sec / 60);
  const rem = sec % 60;
  if (rem === 0) return m === 1 ? "Worked for 1m" : `Worked for ${m}m`;
  return `Worked for ${m}m ${rem}s`;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

type Props = {
  entries: WorkEntryRow[];
  displayName: string;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
};

export function WorkEntriesFeed({
  entries,
  displayName,
  title = "Your sessions",
  subtitle = "Newest logs — proof you showed up.",
  emptyMessage = "Complete a sesh and save it to see entries here.",
}: Props) {
  return (
    <div>
      <h2 className="font-display text-lg text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--app-muted)]">{subtitle}</p>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--background)]/40 px-4 py-8 text-center text-sm text-[var(--app-muted)]">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((e) => {
            const label = (e.authorLabel ?? displayName).trim();
            const initial = label.charAt(0).toUpperCase() || "?";
            return (
              <li
                key={e.id}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 p-4"
              >
                <div className="flex gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-accent-muted)] bg-[var(--app-accent)]/10 text-sm font-semibold text-[var(--app-accent)]"
                    aria-hidden
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {label || displayName}
                        </p>
                        <p className="text-xs text-[var(--app-muted)]">
                          {formatWorkedFor(e.durationSec)}
                          <span className="opacity-50"> · </span>
                          <span className="text-[var(--foreground)]/70">
                            {e.project.isMisc ? "Misc. tasks" : e.project.name}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]/85">
                      {e.summary}
                    </p>
                    <p className="mt-2 text-right text-xs text-[var(--app-muted)]">
                      {formatRelativeTime(e.createdAt)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
