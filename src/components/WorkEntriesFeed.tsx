"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Reply } from "lucide-react";
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
    id: string;
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

const bubbleMessageClass =
  "flex gap-2.5 rounded-xl border border-[var(--app-border)]/70 bg-[var(--background)]/70 px-2.5 py-2.5 text-xs leading-snug shadow-sm";

/** Framed thread: clear header, messages, anchored reply area. */
function ConversationSection({
  commentCount,
  emptyHint,
  children,
  composer,
}: {
  commentCount: number;
  emptyHint: string;
  children: ReactNode;
  composer: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)]/40 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2 border-b border-[var(--app-border)]/80 bg-[var(--app-accent)]/[0.08] px-3 py-2.5 sm:px-4">
        <MessageCircle
          className="h-4 w-4 shrink-0 text-[var(--app-accent)]"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-[13px] font-semibold text-[var(--foreground)]">
          Conversation
        </span>
        {commentCount > 0 ? (
          <span className="ml-auto rounded-full border border-[var(--app-border)] bg-[var(--background)]/90 px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--app-muted)]">
            {commentCount}{" "}
            {commentCount === 1 ? "message" : "messages"}
          </span>
        ) : null}
      </div>
      <div className="px-2 py-3 sm:px-3">
        {commentCount > 0 ? (
          children
        ) : (
          <p className="px-1 py-2 text-center text-xs leading-relaxed text-[var(--app-muted)]">
            {emptyHint}
          </p>
        )}
      </div>
      <div className="border-t border-[var(--app-border)] bg-[var(--background)]/35 px-2 py-3 sm:px-3 sm:py-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">
          <Reply className="h-3 w-3" aria-hidden />
          Reply
        </p>
        {composer}
      </div>
    </div>
  );
}

type FriendEntryProps = {
  e: WorkEntryRow;
  displayName: string;
  viewerUserId: string;
  onAfterMutation: () => void | Promise<void>;
  avatarCacheBust?: number;
};

function FriendEntryRow({
  e,
  displayName,
  viewerUserId,
  onAfterMutation,
  avatarCacheBust = 0,
}: FriendEntryProps) {
  const social = e.social ?? defaultSocial();
  const label = (e.authorLabel ?? displayName).trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState<"clap" | "comment" | "delete" | null>(null);
  /** Quick-pick grid + custom emoji — hidden until user opens. */
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  /** Emoji keyboard — type or paste one emoji, then Add. */
  const [customReactionOpen, setCustomReactionOpen] = useState(false);
  const [customReactionDraft, setCustomReactionDraft] = useState("");
  /** Reply composer — multiple notes per thread are allowed. */
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  useEffect(() => {
    if (noteEditorOpen) return;
    setCommentDraft("");
  }, [social.comments, noteEditorOpen]);

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
      setReactionPickerOpen(false);
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
      setCommentDraft("");
      await runRefresh();
      setNoteEditorOpen(false);
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteComment(commentId: string) {
    if (busy) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/activity/${e.id}/comment`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
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
    setCommentDraft("");
    setNoteEditorOpen(false);
  }

  return (
    <li className="rounded-2xl border border-[var(--app-border)] bg-[var(--background)]/50 p-4 shadow-sm">
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--app-muted)]">
                {social.reactionBreakdown.length > 0 ? (
                  <>
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
                  </>
                ) : (
                  <span className="text-[var(--app-muted)]/90">
                    Reactions stay hidden until you add one.
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setReactionPickerOpen((o) => {
                    const next = !o;
                    if (!next) {
                      setCustomReactionOpen(false);
                      setCustomReactionDraft("");
                    }
                    return next;
                  });
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-50"
                aria-expanded={reactionPickerOpen}
              >
                {reactionPickerOpen ? (
                  <>
                    Close
                    <ChevronUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </>
                ) : (
                  <>
                    React
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  </>
                )}
              </button>
            </div>
            {reactionPickerOpen ? (
              <>
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
                          {active
                            ? `Remove reaction ${emo}`
                            : `React ${emo}`}
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
                      <label
                        htmlFor={`custom-reaction-${e.id}`}
                        className="text-[11px] text-[var(--app-muted)]"
                      >
                        Optional: switch keyboard to emoji, enter one, then Set
                      </label>
                      <input
                        id={`custom-reaction-${e.id}`}
                        type="text"
                        value={customReactionDraft}
                        onChange={(ev) =>
                          setCustomReactionDraft(ev.target.value)
                        }
                        placeholder=""
                        enterKeyHint="done"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="mt-1 min-h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-base text-[var(--foreground)]"
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
              </>
            ) : null}
          </div>

          <ConversationSection
            commentCount={social.comments.length}
            emptyHint="No messages yet — be the first to cheer them on."
            composer={
              !noteEditorOpen ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setNoteEditorOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-4 py-3 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:bg-[var(--background)]/80 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:justify-start"
                >
                  <Reply className="h-4 w-4 shrink-0 text-[var(--app-accent)]" />
                  {social.comments.some((c) => c.authorUserId === viewerUserId)
                    ? "Add another message"
                    : "Write a message"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      id={`friend-note-label-${e.id}`}
                      className="text-[11px] font-medium text-[var(--app-muted)]"
                    >
                      Visible to everyone on this thread
                    </label>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={closeNoteEditor}
                      className="text-[11px] font-medium text-[var(--app-accent)] hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    aria-labelledby={`friend-note-label-${e.id}`}
                    className="min-h-[88px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                    placeholder="Say something kind…"
                    maxLength={500}
                    value={commentDraft}
                    onChange={(ev) => setCommentDraft(ev.target.value)}
                    disabled={busy !== null}
                  />
                  <button
                    type="button"
                    disabled={busy !== null || commentDraft.trim().length < 1}
                    onClick={() => void onSaveComment()}
                    className="min-h-10 w-full rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:w-auto"
                  >
                    {busy === "comment" ? "Posting…" : "Send"}
                  </button>
                </div>
              )
            }
          >
            <ul className="space-y-2">
              {social.comments.map((c) => (
                <li key={c.id} className={bubbleMessageClass}>
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
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <span>
                        <span className="font-semibold text-[var(--foreground)]/95">
                          {c.authorLabel}
                        </span>
                        <span className="text-[var(--app-muted)]">
                          {" "}
                          ·{" "}
                          <span className="tabular-nums">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </span>
                      </span>
                      {c.authorUserId === viewerUserId ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void onDeleteComment(c.id)}
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                        >
                          {busy === "delete" ? "…" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[var(--foreground)]/85">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ConversationSection>

          <p className="mt-2 text-right text-xs text-[var(--app-muted)]">
            {formatRelativeTime(e.createdAt)}
          </p>
        </div>
      </div>
    </li>
  );
}

type YourEntryProps = {
  e: WorkEntryRow;
  displayName: string;
  viewerUserId: string;
  viewerHasAvatar?: boolean;
  avatarCacheBust: number;
  onAfterMutation: () => void | Promise<void>;
};

/** Your sessions (or a friend&apos;s profile on your view): read thread + reply as session owner or viewer. */
function YourActivityEntryRow({
  e,
  displayName,
  viewerUserId,
  viewerHasAvatar,
  avatarCacheBust,
  onAfterMutation,
}: YourEntryProps) {
  const social = e.social ?? defaultSocial();
  const label = (e.authorLabel ?? displayName).trim();
  const cardUserId = e.authorUserId ?? viewerUserId;
  const cardHasAvatar = e.authorHasAvatar ?? viewerHasAvatar;
  const initial = label.charAt(0).toUpperCase() || "?";
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState<"comment" | "delete" | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (composerOpen) return;
    setCommentDraft("");
  }, [social.comments, composerOpen]);

  const runRefresh = useCallback(async () => {
    await onAfterMutation();
  }, [onAfterMutation]);

  async function onSaveComment() {
    if (busy || !viewerUserId) return;
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
      setCommentDraft("");
      setComposerOpen(false);
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteComment(commentId: string) {
    if (busy) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/activity/${e.id}/comment`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) return;
      await runRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-2xl border border-[var(--app-border)] bg-[var(--background)]/50 p-4 shadow-sm">
      <div className="flex gap-3">
        <SessionAvatar
          userId={cardUserId}
          hasAvatar={cardHasAvatar}
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
          {social.reactionBreakdown.length > 0 || social.clapCount > 0 ? (
            <div className="mt-3 border-t border-[var(--app-border)] pt-3">
              <p className="text-xs text-[var(--app-muted)]">
                {social.reactionBreakdown.length > 0 ? (
                  <>
                    {social.reactionBreakdown.map(({ emoji, count }) => (
                      <span
                        key={emoji}
                        className="mr-2 inline-flex items-center gap-0.5 tabular-nums"
                      >
                        <span aria-hidden>{emoji}</span>
                        {count}
                      </span>
                    ))}
                    <span className="mr-2 opacity-40">·</span>
                  </>
                ) : null}
                {social.clapCount > 0 ? (
                  <span>
                    {social.clapCount}{" "}
                    {social.clapCount === 1 ? "reaction" : "reactions"}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
          <ConversationSection
            commentCount={social.comments.length}
            emptyHint="When friends leave a note, it shows up here. Your replies notify everyone in the thread."
            composer={
              !composerOpen ? (
                <button
                  type="button"
                  disabled={busy !== null || !viewerUserId}
                  onClick={() => setComposerOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-4 py-3 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:bg-[var(--background)]/80 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:justify-start"
                >
                  <Reply className="h-4 w-4 shrink-0 text-[var(--app-accent)]" />
                  {social.comments.length > 0
                    ? "Write a reply"
                    : "Start the thread"}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      id={`owner-note-label-${e.id}`}
                      className="text-[11px] font-medium text-[var(--app-muted)]"
                    >
                      Friends in this thread are notified when you post
                    </label>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setComposerOpen(false);
                        setCommentDraft("");
                      }}
                      className="text-[11px] font-medium text-[var(--app-accent)] hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    aria-labelledby={`owner-note-label-${e.id}`}
                    className="min-h-[88px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                    placeholder="Write a reply…"
                    maxLength={500}
                    value={commentDraft}
                    onChange={(ev) => setCommentDraft(ev.target.value)}
                    disabled={busy !== null}
                  />
                  <button
                    type="button"
                    disabled={busy !== null || commentDraft.trim().length < 1}
                    onClick={() => void onSaveComment()}
                    className="min-h-10 w-full rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:w-auto"
                  >
                    {busy === "comment" ? "Posting…" : "Send reply"}
                  </button>
                </div>
              )
            }
          >
            <ul className="space-y-2">
              {social.comments.map((c) => (
                <li key={c.id} className={bubbleMessageClass}>
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
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <span>
                        <span className="font-semibold text-[var(--foreground)]/95">
                          {c.authorLabel}
                        </span>
                        <span className="text-[var(--app-muted)]">
                          {" "}
                          ·{" "}
                          <span className="tabular-nums">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </span>
                      </span>
                      {c.authorUserId === viewerUserId ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void onDeleteComment(c.id)}
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                        >
                          {busy === "delete" ? "…" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[var(--foreground)]/85">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ConversationSection>
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
                  viewerUserId={viewerUserId ?? ""}
                  onAfterMutation={refresh}
                  avatarCacheBust={avatarCacheBust}
                />
              );
            }
            return (
              <YourActivityEntryRow
                key={e.id}
                e={e}
                displayName={displayName}
                viewerUserId={viewerUserId ?? ""}
                viewerHasAvatar={viewerHasAvatar}
                avatarCacheBust={avatarCacheBust}
                onAfterMutation={refresh}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
