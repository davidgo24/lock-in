"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { hapticLight } from "@/lib/haptics";
import { FriendMiniAvatar } from "@/components/activity-app/FriendMiniAvatar";
import {
  friendNoticeClass,
  type FriendNotice,
} from "@/components/activity-app/friend-notice-styles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import type { FriendsStatePayload } from "@/lib/friends";

type Props = {
  initialFriendsState: FriendsStatePayload;
};

export function FriendsManageClient({ initialFriendsState }: Props) {
  const router = useRouter();
  const [friendsState, setFriendsState] =
    useState<FriendsStatePayload>(initialFriendsState);
  const [notice, setNotice] = useState<FriendNotice | null>(null);
  const [requestDraft, setRequestDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingUnfriendId, setPendingUnfriendId] = useState<string | null>(
    null,
  );
  const pendingUnfriendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  async function sendRequestWithHandle(
    handleInput: string,
    opts?: { clearDraft?: boolean },
  ) {
    setNotice(null);
    const normalized = normalizeHandleInput(handleInput);
    const he = validateHandle(normalized);
    if (he) {
      setNotice({ text: he, kind: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleInput }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          text:
            (j as { error?: string }).error ??
            (res.status === 404 ? "User does not exist." : "Request failed"),
          kind: "error",
        });
        return;
      }
      setFriendsState(j as FriendsStatePayload);
      if (opts?.clearDraft) setRequestDraft("");
      setNotice({ text: "Request sent.", kind: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function copyInviteLink() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setNotice({
          text: "Invite link copied — send it so they can sign up and find you.",
          kind: "success",
        });
      },
      () => {
        setNotice({
          text: `Could not copy. Send them: ${url}`,
          kind: "info",
        });
      },
    );
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>

      <Link
        href="/"
        className="text-sm font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
      >
        ← Dashboard
      </Link>

      <h1 className="mt-6 font-display text-2xl text-[var(--foreground)]">
        Friends
      </h1>
      <p className="mt-1 text-sm text-[var(--app-muted)]">
        Send requests, accept invites, and manage who sees your activity. Your
        handle and profile photo are on{" "}
        <Link
          href="/profile"
          className="font-medium text-[var(--app-accent)] underline underline-offset-2"
        >
          your profile
        </Link>
        .
      </p>

      {notice ? (
        <p
          className={`mt-4 text-sm ${friendNoticeClass(notice.kind)}`}
          role={notice.kind === "error" ? "alert" : undefined}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="mt-6 space-y-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
        <label className="text-xs font-medium text-[var(--app-muted)]">
          Add a friend by handle
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            className="min-h-11 w-full flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
            placeholder="@their_handle"
            value={requestDraft}
            onChange={(e) => setRequestDraft(e.target.value)}
            maxLength={32}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] disabled:opacity-50"
            onClick={() =>
              void sendRequestWithHandle(requestDraft, { clearDraft: true })
            }
            disabled={busy}
          >
            {busy ? "…" : "Send request"}
          </button>
        </div>
      </div>

      {friendsState.suggestions.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Suggested
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]">
            Friends of your friends — tap Invite to send a request.
          </p>
          <ul className="mt-3 space-y-2">
            {friendsState.suggestions.map((s) => (
              <li
                key={s.userId}
                className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2"
              >
                <FriendMiniAvatar
                  userId={s.userId}
                  hasAvatar={s.hasAvatar}
                  initial={s.label.trim().charAt(0).toUpperCase() || "?"}
                  cacheBust={0}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {s.label}
                    <span className="font-normal text-[var(--app-muted)]">
                      {" "}
                      · @{s.handle}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--app-muted)]">
                    Also friends with {s.viaLabel}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendRequestWithHandle(s.handle)}
                  className="shrink-0 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busy ? "…" : "Invite"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {friendsState.incoming.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Incoming
          </p>
          <ul className="mt-2 space-y-2">
            {friendsState.incoming.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-[var(--foreground)]">
                  {r.from.label}
                  {r.from.handle ? (
                    <span className="text-[var(--app-muted)]">
                      {" "}
                      · @{r.from.handle}
                    </span>
                  ) : null}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="min-h-9 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white"
                    onClick={() => {
                      hapticLight();
                      void (async () => {
                        setNotice(null);
                        const res = await fetch("/api/friends/accept", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ requestId: r.id }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setNotice({
                            text:
                              (j as { error?: string }).error ??
                              "Could not accept",
                            kind: "error",
                          });
                          return;
                        }
                        setFriendsState(j as FriendsStatePayload);
                        setNotice({
                          text: "You're connected.",
                          kind: "success",
                        });
                        router.refresh();
                      })();
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--foreground)]"
                    onClick={() => {
                      hapticLight();
                      void (async () => {
                        setNotice(null);
                        const res = await fetch("/api/friends/reject", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ requestId: r.id }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setNotice({
                            text:
                              (j as { error?: string }).error ??
                              "Could not decline",
                            kind: "error",
                          });
                          return;
                        }
                        setFriendsState(j as FriendsStatePayload);
                        setNotice({ text: "Request declined.", kind: "info" });
                        router.refresh();
                      })();
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {friendsState.outgoing.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Pending
          </p>
          <ul className="mt-2 space-y-2">
            {friendsState.outgoing.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-[var(--app-muted)]">
                  Waiting on {r.to.label}
                  {r.to.handle ? ` (@${r.to.handle})` : ""}
                </span>
                <button
                  type="button"
                  className="min-h-8 shrink-0 text-xs text-[var(--app-muted)] underline"
                  onClick={() =>
                    void (async () => {
                      setNotice(null);
                      const res = await fetch("/api/friends/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ requestId: r.id }),
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setNotice({
                          text:
                            (j as { error?: string }).error ??
                            "Could not cancel",
                          kind: "error",
                        });
                        return;
                      }
                      setFriendsState(j as FriendsStatePayload);
                      setNotice({ text: "Request cancelled.", kind: "info" });
                      router.refresh();
                    })()
                  }
                >
                  Cancel request
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
          Your friends
        </p>
        {friendsState.friends.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--app-muted)]">
            No connections yet — add someone by handle above.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {friendsState.friends.map((f) => (
              <li
                key={f.userId}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2"
              >
                <Link
                  href={`/friends/${f.userId}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <FriendMiniAvatar
                    userId={f.userId}
                    hasAvatar={f.hasAvatar}
                    initial={f.label.trim().charAt(0).toUpperCase() || "?"}
                    cacheBust={0}
                  />
                  <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
                    {f.label}
                    {f.handle ? (
                      <span className="text-[var(--app-muted)]">
                        {" "}
                        · @{f.handle}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <button
                  type="button"
                  className={`shrink-0 text-xs underline ${
                    pendingUnfriendId === f.userId
                      ? "font-semibold text-[var(--app-accent)]"
                      : "text-[var(--app-muted)]"
                  }`}
                  onClick={() => {
                    if (pendingUnfriendId !== f.userId) {
                      if (pendingUnfriendTimerRef.current) {
                        clearTimeout(pendingUnfriendTimerRef.current);
                      }
                      setPendingUnfriendId(f.userId);
                      pendingUnfriendTimerRef.current = setTimeout(() => {
                        setPendingUnfriendId(null);
                        pendingUnfriendTimerRef.current = null;
                      }, 5000);
                      return;
                    }
                    if (pendingUnfriendTimerRef.current) {
                      clearTimeout(pendingUnfriendTimerRef.current);
                      pendingUnfriendTimerRef.current = null;
                    }
                    setPendingUnfriendId(null);
                    void (async () => {
                      setNotice(null);
                      const res = await fetch(`/api/friends/${f.userId}`, {
                        method: "DELETE",
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setNotice({
                          text:
                            (j as { error?: string }).error ??
                            "Could not remove",
                          kind: "error",
                        });
                        return;
                      }
                      setFriendsState(j as FriendsStatePayload);
                      setNotice({ text: "Removed from friends.", kind: "info" });
                      router.refresh();
                    })();
                  }}
                >
                  {pendingUnfriendId === f.userId
                    ? "Tap again to remove"
                    : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          hapticLight();
          copyInviteLink();
        }}
        className="mt-6 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] py-3 text-sm font-medium text-[var(--foreground)] shadow-sm"
      >
        Copy invite link
      </button>

      <p className="mt-6 text-center text-xs text-[var(--app-muted)]">
        Someone&apos;s profile opens from{" "}
        <Link href="/" className="text-[var(--app-accent)] underline">
          Community
        </Link>{" "}
        on the dashboard — this page is only for your network.
      </p>
    </div>
  );
}
