"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REACTION_QUICK_PICKS,
  normalizeReactionEmoji,
} from "@/lib/emoji-reaction";

export type ActivitySocial = {
  clapCount: number;
  clappedByMe: boolean;
  myReactionEmoji: string | null;
  reactionBreakdown: { emoji: string; count: number }[];
  comments: {
    authorLabel: string;
    authorUserId: string;
    authorHasAvatar: boolean;
    body: string;
    createdAt: string;
  }[];
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
  /** Friend feed: session owner — for profile photo. */
  authorUserId?: string;
  authorHasAvatar?: boolean;
  social?: ActivitySocial;
};

function SessionAvatar(props: {
  userId?: string;
  hasAvatar?: boolean;
  initial: string;
  /** Bump after upload/remove so the browser refetches `/api/avatar/...`. */
  cacheBust?: number;
  size?: "sm" | "md";
}) {
  const { userId, hasAvatar, initial, cacheBust = 0, size = "md" } = props;
  const [imgFailed, setImgFailed] = useState(false);
  const box =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : "h-11 w-11 text-sm";
  const imgPx = size === "sm" ? 32 : 44;

  if (userId && hasAvatar && !imgFailed) {
    const qs = cacheBust > 0 ? `?v=${cacheBust}` : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin blob API
      <img
        src={`/api/avatar/${userId}${qs}`}
        alt=""
        width={imgPx}
        height={imgPx}
        className={`${box} shrink-0 rounded-full border border-[var(--app-accent-muted)] object-cover`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-full border border-[var(--app-accent-muted)] bg-[var(--app-accent)]/10 font-semibold text-[var(--app-accent)]`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

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
    myReactionEmoji: null,
    reactionBreakdown: [],
    comments: [],
    myComment: null,
  };
}

type FriendEntryProps = {
  e: WorkEntryRow;
  displayName: string;
  onAfterMutation: () => void | Promise<void>;
  avatarCacheBust?: number;
};

function FriendEntryRow({
  e,
  displayName,
  onAfterMutation,
  avatarCacheBust = 0,
}: FriendEntryProps) {
  const social = e.social ?? defaultSocial();
  const label = (e.authorLabel ?? displayName).trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const [commentDraft, setCommentDraft] = useState(social.myComment ?? "");
  const [busy, setBusy] = useState<"clap" | "comment" | "delete" | null>(null);
  /** Emoji keyboard — type or paste one emoji, then Add. */
  const [customReactionOpen, setCustomReactionOpen] = useState(false);
  const [customReactionDraft, setCustomReactionDraft] = useState("");
  /** Keep the session note editor tucked away so the main caption + thread stay primary. */
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft when server refetches social.myComment
    setCommentDraft(social.myComment ?? "");
  }, [social.myComment]);

  const runRefresh = useCallback(async () => {
    await onAfterMutation();
  }, [onAfterMutation]);

  async function sendReaction(emoji: string) {
    if (busy) return;
    setBusy("clap");
    try {
      const res = await fetch(`/api/activity/${e.id}/clap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) return;
      setCustomReactionOpen(false);
      setCustomReactionDraft("");
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function addCustomReaction() {
    const e0 = normalizeReactionEmoji(customReactionDraft);
    if (!e0) return;
    await sendReaction(e0);
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
      setNoteEditorOpen(false);
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
      setNoteEditorOpen(false);
    } finally {
      setBusy(null);
    }
  }

  function closeNoteEditor() {
    setCommentDraft(social.myComment ?? "");
    setNoteEditorOpen(false);
  }

  const myNotePreview =
    social.myComment && social.myComment.length > 120
      ? `${social.myComment.slice(0, 117)}…`
      : social.myComment;

  return (
    <li className="rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 p-4">
      <div className="flex gap-3">
        <SessionAvatar
          userId={e.authorUserId}
          hasAvatar={e.authorHasAvatar}
          initial={initial}
          cacheBust={avatarCacheBust}
        />
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

          <div className="mt-3 border-t border-[var(--app-border)] pt-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
              React
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REACTION_QUICK_PICKS.map((emo) => {
                const active = social.myReactionEmoji === emo;
                return (
                  <button
                    key={emo}
                    type="button"
                    disabled={busy !== null}
                    title={
                      active ? `Remove ${emo}` : `React with ${emo}`
                    }
                    onClick={() => void sendReaction(emo)}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-lg border text-lg leading-none transition active:scale-[0.97] disabled:opacity-50 ${
                      active
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-muted)] shadow-inner"
                        : "border-[var(--app-border)] bg-[var(--app-surface-card)]"
                    }`}
                  >
                    <span aria-hidden>{emo}</span>
                    <span className="sr-only">
                      {active ? `Remove reaction ${emo}` : `React ${emo}`}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setCustomReactionOpen((o) => !o);
                  setCustomReactionDraft(social.myReactionEmoji ?? "");
                }}
                className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--background)]/50 text-sm font-semibold text-[var(--app-muted)] disabled:opacity-50"
                aria-expanded={customReactionOpen}
              >
                +
                <span className="sr-only">Custom emoji</span>
              </button>
            </div>
            {customReactionOpen ? (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)]/60 p-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="text-[11px] text-[var(--app-muted)]">
                    One emoji — use your keyboard&apos;s emoji key
                  </label>
                  <input
                    type="text"
                    value={customReactionDraft}
                    onChange={(ev) => setCustomReactionDraft(ev.target.value)}
                    placeholder="Tap 😀 …"
                    className="mt-1 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)]"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void addCustomReaction()}
                  className="min-h-10 shrink-0 rounded-lg bg-[var(--app-accent)] px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy === "clap" ? "…" : "Set"}
                </button>
              </div>
            ) : null}
            {social.reactionBreakdown.length > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--app-muted)]">
                {social.reactionBreakdown.map(({ emoji, count }) => (
                  <span
                    key={emoji}
                    className="inline-flex items-center gap-0.5 tabular-nums"
                  >
                    <span aria-hidden>{emoji}</span>
                    <span>{count}</span>
                  </span>
                ))}
                <span className="text-[var(--app-muted)]/80">
                  · {social.clapCount}{" "}
                  {social.clapCount === 1 ? "reaction" : "reactions"}
                </span>
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
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
                <li
                  key={`${e.id}-c-${i}`}
                  className="flex gap-2 text-xs leading-snug"
                >
                  <SessionAvatar
                    userId={c.authorUserId}
                    hasAvatar={c.authorHasAvatar}
                    initial={
                      c.authorLabel.trim().charAt(0).toUpperCase() || "?"
                    }
                    cacheBust={avatarCacheBust}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span className="font-medium text-[var(--foreground)]/90">
                      {c.authorLabel}
                    </span>
                    <span className="text-[var(--app-muted)]">
                      {" "}
                      ·{" "}
                      <span className="tabular-nums">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </span>
                    <p className="mt-0.5 text-[var(--foreground)]/80">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 border-t border-[var(--app-border)] pt-3">
            {!noteEditorOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {social.myComment ? (
                  <>
                    <p className="min-w-0 flex-1 text-xs leading-snug text-[var(--foreground)]/85">
                      <span className="font-medium text-[var(--foreground)]/90">
                        Your note
                      </span>
                      <span className="text-[var(--app-muted)]"> · </span>
                      <span className="whitespace-pre-wrap break-words">
                        {myNotePreview}
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setNoteEditorOpen(true)}
                      className="shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setNoteEditorOpen(true)}
                    className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2 text-xs font-medium text-[var(--app-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    Add a note on this session
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    id={`friend-note-label-${e.id}`}
                    className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]"
                  >
                    Your note (one per post — private to this thread)
                  </label>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={closeNoteEditor}
                    className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-accent)] hover:underline disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
                <textarea
                  aria-labelledby={`friend-note-label-${e.id}`}
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
            )}
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
  /** Your user id — "You" feed shows your photo when set. */
  viewerUserId?: string;
  viewerHasAvatar?: boolean;
  /** Increment after avatar upload/remove to bust cache. */
  avatarCacheBust?: number;
};

export function WorkEntriesFeed({
  entries,
  displayName,
  title = "Your sessions",
  subtitle = "Newest entries — a simple record of what you focused on.",
  emptyMessage = "Finish a focus block and save a note to see entries here.",
  variant = "you",
  onRefresh,
  viewerUserId,
  viewerHasAvatar,
  avatarCacheBust = 0,
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
                  avatarCacheBust={avatarCacheBust}
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
                  <SessionAvatar
                    userId={viewerUserId}
                    hasAvatar={viewerHasAvatar}
                    initial={initial}
                    cacheBust={avatarCacheBust}
                  />
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
                          {social.reactionBreakdown.length > 0 ? (
                            <>
                              {social.reactionBreakdown.map(
                                ({ emoji, count }) => (
                                  <span
                                    key={emoji}
                                    className="mr-2 inline-flex items-center gap-0.5 tabular-nums"
                                  >
                                    <span aria-hidden>{emoji}</span>
                                    {count}
                                  </span>
                                ),
                              )}
                              <span className="mr-2 opacity-40">·</span>
                            </>
                          ) : null}
                          {social.clapCount > 0 ? (
                            <span>
                              {social.clapCount}{" "}
                              {social.clapCount === 1
                                ? "reaction"
                                : "reactions"}
                            </span>
                          ) : null}
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
                                className="flex gap-2 rounded-md bg-[var(--app-surface-card)]/80 px-2 py-1.5 text-xs leading-snug text-[var(--foreground)]/85"
                              >
                                <SessionAvatar
                                  userId={c.authorUserId}
                                  hasAvatar={c.authorHasAvatar}
                                  initial={
                                    c.authorLabel.trim().charAt(0).toUpperCase() ||
                                    "?"
                                  }
                                  cacheBust={avatarCacheBust}
                                  size="sm"
                                />
                                <div className="min-w-0 flex-1 pt-0.5">
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
                                  <p className="mt-0.5 text-[var(--foreground)]/80">
                                    {c.body}
                                  </p>
                                </div>
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
