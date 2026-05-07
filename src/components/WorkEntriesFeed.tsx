"use client";

export type WorkEntryRow = {
  id: string;
  summary: string;
  durationSec: number;
  createdAt: string;
  workDate: string;
  project: { name: string; isMisc: boolean };
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
};

export function WorkEntriesFeed({ entries, displayName }: Props) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-5 shadow-lg shadow-blue-500/5 backdrop-blur-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-100">Work entries</h2>
      <p className="mt-1 text-sm text-slate-400">
        Your logged sessions and notes (newest first).
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          Complete a timer and save a session to see entries here.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-blue-500/15 bg-slate-950/50 p-4"
            >
              <div className="flex gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/15 text-sm font-semibold text-blue-200"
                  aria-hidden
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-100">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatWorkedFor(e.durationSec)}
                        <span className="text-slate-600"> · </span>
                        <span className="text-slate-400">
                          {e.project.isMisc ? "Misc. tasks" : e.project.name}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {e.summary}
                  </p>
                  <p className="mt-2 text-right text-xs text-slate-500">
                    {formatRelativeTime(e.createdAt)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
