"use client";

import React, { useState } from "react";
import Link from "next/link";
import { focusMinutesLeftLabel } from "@/lib/focus-quips";
import type { FriendsStatePayload } from "@/lib/friends";

function StripAvatar(props: {
  userId: string;
  hasAvatar: boolean;
  initial: string;
  cacheBust: number;
  live?: boolean;
}) {
  const { userId, hasAvatar, initial, cacheBust, live } = props;
  const [failed, setFailed] = useState(false);
  const qs = cacheBust > 0 ? `?v=${cacheBust}` : "";
  return (
    <span className="relative inline-flex shrink-0">
      {hasAvatar && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar/${userId}${qs}`}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full border border-[var(--app-border)] object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent-muted)] text-xs font-semibold text-[var(--app-accent)]">
          {initial}
        </span>
      )}
      {live ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] bg-emerald-500"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export function FriendsInFocusStrip(props: {
  friendsState: FriendsStatePayload;
  avatarCacheBust: number;
}) {
  const { friendsState, avatarCacheBust } = props;

  const focusing = [...friendsState.friends]
    .filter((f) => f.activeFocusEndsAt)
    .sort(
      (a, b) =>
        new Date(a.activeFocusEndsAt!).getTime() -
        new Date(b.activeFocusEndsAt!).getTime(),
    );

  if (friendsState.friends.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
        Friends in focus
      </p>
      {focusing.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--app-muted)]">
          No one&apos;s in a live session right now. Start yours below — friends
          will see it when you go.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {focusing.map((f) => (
            <li key={f.userId}>
              <Link
                href={`/friends/${f.userId}`}
                className="flex items-center gap-3 rounded-xl bg-[var(--background)]/40 px-2 py-2 transition hover:bg-[var(--background)]/60"
              >
                <StripAvatar
                  userId={f.userId}
                  hasAvatar={f.hasAvatar}
                  initial={f.label.trim().charAt(0).toUpperCase() || "?"}
                  cacheBust={avatarCacheBust}
                  live
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {f.label}
                  </p>
                  <p className="truncate text-xs text-[var(--app-muted)]">
                    {f.activeFocusProjectName ?? "Focus session"}
                    {f.activeFocusEndsAt
                      ? ` · ${focusMinutesLeftLabel(f.activeFocusEndsAt)}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-[11px] text-[var(--app-muted)]">
        <Link
          href="/friends"
          className="font-medium text-[var(--app-accent)] underline underline-offset-2"
        >
          Manage friends
        </Link>
      </p>
    </section>
  );
}
