"use client";

import { useCallback, useEffect, useState } from "react";

export type ActivitySocial = {
  clapCount: number;
  clappedByMe: boolean;
  comments: { authorLabel: string; body: string; createdAt: string }[];
  myComment: string | null;
};

export type WorkEntryRow = {
  id: string;
  summary: string;
  durationSec: number;
  createdAt: string;
  workDate: string;
  project: { name: string; isMisc: boolean };
  /** When set (friend feed), shown instead of `displayName`. */
  authorLabel?: string;
  social?: ActivitySocial;
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

function defaultSocial(): ActivitySocial {
  return {
    clapCount: 0,
    clappedByMe: false,
    comments: [],
    myComment: null,
  };
}

type FriendEntryProps = {
  e: WorkEntryRow;
  displayName: string;
  onAfterMutation: () => void | Promise<void>;
};

function FriendEntryRow({ e, displayName, onAfterMutation }: FriendEntryProps) {
  const social = e.social ?? defaultSocial();
  const label = (e.authorLabel ?? displayName).trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const [commentDraft, setCommentDraft] = useState(social.myComment ?? "");
  const [busy, setBusy] = useState<"clap" | "comment" | "delete" | null>(null);

  useEffect(() => {
    setCommentDraft(social.myComment ?? "");
  }, [social.myComment]);

  const runRefresh = useCallback(async () => {
    await onAfterMutation();
  }, [onAfterMutation]);

  async function onClapClick() {
    if (busy) return;
    setBusy("clap");
    try {
      const res = await fetch(`/api/activity/${e.id}/clap`, { method: "POST" });
      if (!res.ok) return;
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSaveComment() {
    if (busy) return;
    const t = commentDraft.trim();
    if (t.length < 1) return;
    setBusy("comment");
    try {
      const res = await fetch(`/api/activity/${e.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      if (!res.ok) return;
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteComment() {
    if (busy) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/activity/${e.id}/comment`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setCommentDraft("");
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 p-4">
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
                  {e.project.isMisc ? "General" : e.project.name}
                </span>
              </p>
            </div>
          </div>
          <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]/85">
            {e.summary}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--app-border)] pt-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void onClapClick()}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-[0.99] disabled:opacity-50 ${
                social.clappedByMe
                  ? "border-[var(--app-accent)] bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "border-[var(--app-border)] bg-[var(--app-surface-card)] text-[var(--foreground)]"
              }`}
            >
              <span aria-hidden>👏</span>
              <span>{social.clapCount}</span>
              <span className="sr-only">
                {social.clappedByMe ? "Remove clap" : "Clap"}
              </span>
            </button>
            {social.comments.length > 0 ? (
              <span className="text-xs text-[var(--app-muted)]">
                {social.comments.length}{" "}
                {social.comments.length === 1 ? "note" : "notes"}
              </span>
            ) : null}
          </div>

          {social.comments.length > 0 ? (
            <ul className="mt-2 space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 p-2">
              {social.comments.map((c, i) => (
                <li key={`${e.id}-c-${i}`} className="text-xs leading-snug">
                  <span className="font-medium text-[var(--foreground)]/90">
                    {c.authorLabel}
                  </span>
                  <span className="text-[var(--app-muted)]">
                    {" "}
                    ·{" "}
                    <span className="tabular-nums">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                    {" · "}
                  </span>
                  <span className="text-[var(--foreground)]/80">{c.body}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 space-y-2">
            <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
              Your note (one per post — edits stay private to the thread)
            </label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
              placeholder="Say something kind…"
              maxLength={500}
              value={commentDraft}
              onChange={(ev) => setCommentDraft(ev.target.value)}
              disabled={busy !== null}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null || commentDraft.trim().length < 1}
                onClick={() => void onSaveComment()}
                className="min-h-9 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy === "comment"
                  ? "Saving…"
                  : social.myComment
                    ? "Update note"
                    : "Post note"}
              </button>
              {social.myComment ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onDeleteComment()}
                  className="min-h-9 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-muted)] disabled:opacity-50"
                >
                  {busy === "delete" ? "…" : "Remove my note"}
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-2 text-right text-xs text-[var(--app-muted)]">
            {formatRelativeTime(e.createdAt)}
          </p>
        </div>
      </div>
    </li>
  );
}

type Props = {
  entries: WorkEntryRow[];
  displayName: string;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  /** Friend feed: clap + comment. */
  variant?: "you" | "friend";
  onRefresh?: () => void | Promise<void>;
};

export function WorkEntriesFeed({
  entries,
  displayName,
  title = "Your sessions",
  subtitle = "Newest entries — a simple record of what you focused on.",
  emptyMessage = "Finish a focus block and save a note to see entries here.",
  variant = "you",
  onRefresh,
}: Props) {
  const noop = useCallback(() => {}, []);
  const refresh = onRefresh ?? noop;

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
            if (variant === "friend") {
              return (
                <FriendEntryRow
                  key={e.id}
                  e={e}
                  displayName={displayName}
                  onAfterMutation={refresh}
                />
              );
            }
            const social = e.social ?? defaultSocial();
            const label = displayName.trim();
            const initial = label.charAt(0).toUpperCase() || "?";
            const hasSocial =
              social.clapCount > 0 || social.comments.length > 0;
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
                          {displayName}
                        </p>
                        <p className="text-xs text-[var(--app-muted)]">
                          {formatWorkedFor(e.durationSec)}
                          <span className="opacity-50"> · </span>
                          <span className="text-[var(--foreground)]/70">
                            {e.project.isMisc ? "General" : e.project.name}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]/85">
                      {e.summary}
                    </p>
                    {hasSocial ? (
                      <div className="mt-3 border-t border-[var(--app-border)] pt-3">
                        <p className="text-xs text-[var(--app-muted)]">
                          <span aria-hidden>👏</span> {social.clapCount}{" "}
                          {social.clapCount === 1 ? "clap" : "claps"}
                          {social.comments.length > 0 ? (
                            <>
                              <span className="mx-1 opacity-40">·</span>
                              {social.comments.length}{" "}
                              {social.comments.length === 1
                                ? "friend note"
                                : "friend notes"}
                            </>
                          ) : null}
                        </p>
                        {social.comments.length > 0 ? (
                          <ul className="mt-2 space-y-1.5">
                            {social.comments.map((c, i) => (
                              <li
                                key={`${e.id}-oc-${i}`}
                                className="rounded-md bg-[var(--app-surface-card)]/80 px-2 py-1.5 text-xs leading-snug text-[var(--foreground)]/85"
                              >
                                <span className="font-medium">
                                  {c.authorLabel}
                                </span>
                                <span className="text-[var(--app-muted)]">
                                  {" "}
                                  ·{" "}
                                  <span className="tabular-nums">
                                    {formatRelativeTime(c.createdAt)}
                                  </span>
                                </span>
                                <span className="text-[var(--foreground)]/80">
                                  : {c.body}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
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
