"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  WorkEntriesFeed,
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";
import { focusMinutesLeftLabel } from "@/lib/focus-quips";
import type { FriendsStatePayload } from "@/lib/friends";
import {
  friendNoticeClass,
  type FriendNotice,
} from "@/components/activity-app/friend-notice-styles";
import { AVATAR_MAX_MIB } from "@/lib/avatar";

function FriendMiniAvatar(props: {
  userId: string;
  hasAvatar: boolean;
  initial: string;
  cacheBust: number;
}) {
  const { userId, hasAvatar, initial, cacheBust } = props;
  const [failed, setFailed] = useState(false);
  if (hasAvatar && !failed) {
    const qs = cacheBust > 0 ? `?v=${cacheBust}` : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${userId}${qs}`}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full border border-[var(--app-border)] object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent)]/10 text-xs font-semibold text-[var(--app-accent)]"
      aria-hidden
    >
      {initial}
    </div>
  );
}

export type CommunitySidebarProps = {
  displayName: string;
  viewerUserId: string;
  viewerHasAvatar: boolean;
  avatarCacheBust: number;
  onViewerAvatarChange: (hasAvatar: boolean) => void;
  onAvatarNotice: (message: string, kind: FriendNotice["kind"]) => void;
  workEntries: WorkEntryRow[];
  friendFeed: WorkEntryRow[];
  friendsState: FriendsStatePayload;
  sidebarTab: "you" | "community";
  onSidebarTab: (tab: "you" | "community") => void;
  friendsPanelExpanded: boolean;
  onFriendsPanelExpanded: (open: boolean) => void;
  friendNotice: FriendNotice | null;
  handleDraft: string;
  onHandleDraftChange: (v: string) => void;
  requestHandleDraft: string;
  onRequestHandleDraftChange: (v: string) => void;
  handleSaving: boolean;
  pendingUnfriendId: string | null;
  onSaveMyHandle: () => void;
  onSendFriendRequest: () => void;
  friendRequestBusy: boolean;
  onSendFriendRequestToHandle: (handle: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onCancelOutgoing: (requestId: string) => void;
  onCopyAppLink: () => void;
  refreshEntryFeeds: () => void | Promise<void>;
};

export function CommunitySidebar({
  displayName,
  viewerUserId,
  viewerHasAvatar,
  avatarCacheBust,
  onViewerAvatarChange,
  onAvatarNotice,
  workEntries,
  friendFeed,
  friendsState,
  sidebarTab,
  onSidebarTab,
  friendsPanelExpanded,
  onFriendsPanelExpanded,
  friendNotice,
  handleDraft,
  onHandleDraftChange,
  requestHandleDraft,
  onRequestHandleDraftChange,
  handleSaving,
  pendingUnfriendId,
  onSaveMyHandle,
  onSendFriendRequest,
  friendRequestBusy,
  onSendFriendRequestToHandle,
  onAcceptRequest,
  onRejectRequest,
  onRemoveFriend,
  onCancelOutgoing,
  onCopyAppLink,
  refreshEntryFeeds,
}: CommunitySidebarProps) {
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [communitySubTab, setCommunitySubTab] = useState<"live" | "friends">(
    "live",
  );

  const focusingFriends = [...friendsState.friends]
    .filter((f) => f.activeFocusEndsAt)
    .sort(
      (a, b) =>
        new Date(a.activeFocusEndsAt!).getTime() -
        new Date(b.activeFocusEndsAt!).getTime(),
    );
  return (
    <aside className="order-3 min-w-0 xl:sticky xl:top-4 xl:self-start">
      <div
        className="mb-3 flex gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-1 shadow-sm"
        role="tablist"
        aria-label="Activity sidebar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "you"}
          className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            sidebarTab === "you"
              ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
          onClick={() => onSidebarTab("you")}
        >
          You
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sidebarTab === "community"}
          className={`relative min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            sidebarTab === "community"
              ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
          onClick={() => onSidebarTab("community")}
        >
          Community
          {friendsState.incoming.length > 0 ? (
            <span
              className="ml-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[10px] font-semibold text-white"
              aria-label={`${friendsState.incoming.length} pending requests`}
            >
              {friendsState.incoming.length}
            </span>
          ) : null}
        </button>
      </div>

      {sidebarTab === "you" ? (
        <div
          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5"
          role="tabpanel"
        >
          <WorkEntriesFeed
            entries={workEntries}
            displayName={displayName}
            variant="you"
            title="Your activity"
            subtitle="Newest entries — your accountability trail."
            emptyMessage="Finish a focus block and log it to see entries here."
            viewerUserId={viewerUserId}
            viewerHasAvatar={viewerHasAvatar}
            avatarCacheBust={avatarCacheBust}
          />
          <p className="mt-4 text-center text-xs text-[var(--app-muted)]">
            <button
              type="button"
              className="text-[var(--app-accent)] underline"
              onClick={() => onSidebarTab("community")}
            >
              Community
            </button>{" "}
            · friend requests and shared activity
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-3 flex gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-1 shadow-sm"
            role="tablist"
            aria-label="Community sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={communitySubTab === "live"}
              className={`min-h-9 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
                communitySubTab === "live"
                  ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => setCommunitySubTab("live")}
            >
              Online now
              {focusingFriends.length > 0 ? (
                <span className="ml-1 tabular-nums text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 sm:text-xs">
                  ({focusingFriends.length})
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={communitySubTab === "friends"}
              className={`relative min-h-9 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
                communitySubTab === "friends"
                  ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => setCommunitySubTab("friends")}
            >
              Friends
              {friendsState.incoming.length > 0 ? (
                <span
                  className="ml-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[10px] font-semibold text-white"
                  aria-label={`${friendsState.incoming.length} pending requests`}
                >
                  {friendsState.incoming.length}
                </span>
              ) : null}
            </button>
          </div>

          {communitySubTab === "live" ? (
            <div
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5"
              role="tabpanel"
            >
              <p className="font-display text-base text-[var(--foreground)]">
                Online now
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--app-muted)]">
                Friends with an active timer — focus area updates while they
                work.
              </p>
              {friendsState.friends.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--app-muted)]">
                  Add people from the{" "}
                  <button
                    type="button"
                    className="font-medium text-[var(--app-accent)] underline"
                    onClick={() => setCommunitySubTab("friends")}
                  >
                    Friends
                  </button>{" "}
                  tab to see when they&apos;re in focus.
                </p>
              ) : focusingFriends.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--app-muted)]">
                  No one&apos;s in focus right now. Check back when a friend
                  starts their timer.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {focusingFriends.map((f) => (
                    <li
                      key={f.userId}
                      className="flex gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2.5"
                    >
                      <FriendMiniAvatar
                        userId={f.userId}
                        hasAvatar={f.hasAvatar}
                        initial={
                          f.label.trim().charAt(0).toUpperCase() || "?"
                        }
                        cacheBust={avatarCacheBust}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {f.label}
                          {f.handle ? (
                            <span className="font-normal text-[var(--app-muted)]">
                              {" "}
                              · @{f.handle}
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--app-muted)]">
                          <span
                            className="inline-flex items-center gap-1.5 text-[var(--foreground)]/90"
                          >
                            <span
                              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                              aria-hidden
                            />
                            <span className="min-w-0 font-medium">
                              {f.activeFocusProjectName ?? "Focus session"}
                            </span>
                          </span>
                          {f.activeFocusEndsAt ? (
                            <span className="tabular-nums">
                              {focusMinutesLeftLabel(f.activeFocusEndsAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : friendsPanelExpanded ? (
            <div
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm"
              role="tabpanel"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg text-[var(--foreground)]">
                  Friends
                </h3>
                <button
                  type="button"
                  onClick={() => onFriendsPanelExpanded(false)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)]"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  Hide
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Pick a unique handle, then send a request. They accept — you
                both see each other&apos;s session logs (not one-way follows).
                Friends see your note and which focus area you used for each
                block.
              </p>

              {friendNotice ? (
                <p
                  className={`mt-3 text-sm ${friendNoticeClass(friendNotice.kind)}`}
                  role={friendNotice.kind === "error" ? "alert" : undefined}
                >
                  {friendNotice.text}
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium text-[var(--app-muted)]">
                  Your handle
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className="min-h-10 w-full flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                    placeholder="e.g. alex_codes"
                    value={handleDraft}
                    onChange={(e) => onHandleDraftChange(e.target.value)}
                    maxLength={30}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    disabled={handleSaving}
                    className="min-h-10 shrink-0 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={onSaveMyHandle}
                  >
                    {handleSaving ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-xs text-[var(--app-muted)]">
                  3–30 characters: lowercase letters, numbers, underscores.
                  Used so friends can find you — not your password.
                </p>
              </div>

              <div className="mt-5 space-y-2 border-t border-[var(--app-border)] pt-4">
                <label className="text-xs font-medium text-[var(--app-muted)]">
                  Profile photo
                </label>
                <p className="text-xs text-[var(--app-muted)]">
                  JPEG, PNG, GIF, or WebP — max {AVATAR_MAX_MIB} MB. Friends see this next to
                  your activity.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <FriendMiniAvatar
                    userId={viewerUserId}
                    hasAvatar={viewerHasAvatar}
                    initial={displayName.trim().charAt(0).toUpperCase() || "?"}
                    cacheBust={avatarCacheBust}
                  />
                  <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      disabled={avatarBusy}
                      onChange={(ev) => {
                        const file = ev.target.files?.[0];
                        ev.target.value = "";
                        if (!file) return;
                        setAvatarBusy(true);
                        const fd = new FormData();
                        fd.set("file", file);
                        void (async () => {
                          try {
                            const res = await fetch("/api/profile/avatar", {
                              method: "POST",
                              body: fd,
                            });
                            const j = (await res.json().catch(() => ({}))) as {
                              error?: string;
                            };
                            if (!res.ok) {
                              onAvatarNotice(
                                j.error ?? "Could not upload photo.",
                                "error",
                              );
                              return;
                            }
                            onViewerAvatarChange(true);
                          } finally {
                            setAvatarBusy(false);
                          }
                        })();
                      }}
                    />
                    {avatarBusy ? "Uploading…" : "Choose image"}
                  </label>
                  {viewerHasAvatar ? (
                    <button
                      type="button"
                      disabled={avatarBusy}
                      className="min-h-10 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-muted)] disabled:opacity-50"
                      onClick={() => {
                        setAvatarBusy(true);
                        void (async () => {
                          try {
                            const res = await fetch("/api/profile/avatar", {
                              method: "DELETE",
                            });
                            if (res.ok) {
                              onViewerAvatarChange(false);
                              onAvatarNotice("Profile photo removed.", "info");
                            } else {
                              const j = (await res.json().catch(() => ({}))) as {
                                error?: string;
                              };
                              onAvatarNotice(
                                j.error ?? "Could not remove photo.",
                                "error",
                              );
                            }
                          } finally {
                            setAvatarBusy(false);
                          }
                        })();
                      }}
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-[var(--app-border)] pt-4">
                <label className="text-xs font-medium text-[var(--app-muted)]">
                  Add a friend by handle
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className="min-h-10 w-full flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                    placeholder="@their_handle"
                    value={requestHandleDraft}
                    onChange={(e) => onRequestHandleDraftChange(e.target.value)}
                    maxLength={32}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="min-h-10 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-4 py-2 text-sm font-medium text-[var(--foreground)] disabled:opacity-50"
                    onClick={onSendFriendRequest}
                    disabled={friendRequestBusy}
                  >
                    {friendRequestBusy ? "…" : "Send request"}
                  </button>
                </div>
              </div>

              {friendsState.suggestions.length > 0 ? (
                <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    Suggested
                  </p>
                  <p className="mt-1 text-xs leading-snug text-[var(--app-muted)]">
                    Friends of your friends — tap Invite to send the same
                    request you&apos;d send from their @handle.
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
                          initial={
                            s.label.trim().charAt(0).toUpperCase() || "?"
                          }
                          cacheBust={avatarCacheBust}
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
                          disabled={friendRequestBusy}
                          onClick={() =>
                            void onSendFriendRequestToHandle(s.handle)
                          }
                          className="shrink-0 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {friendRequestBusy ? "…" : "Invite"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {friendsState.incoming.length > 0 ? (
                <div className="mt-4 border-t border-[var(--app-border)] pt-4">
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
                            onClick={() => onAcceptRequest(r.id)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="min-h-9 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--foreground)]"
                            onClick={() => onRejectRequest(r.id)}
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
                <div className="mt-4 border-t border-[var(--app-border)] pt-4">
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
                          onClick={() => onCancelOutgoing(r.id)}
                        >
                          Cancel request
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {friendsState.friends.length > 0 ? (
                <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    Your friends
                  </p>
                  <ul className="mt-2 space-y-2">
                    {friendsState.friends.map((f) => (
                        <li
                          key={f.userId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <FriendMiniAvatar
                              userId={f.userId}
                              hasAvatar={f.hasAvatar}
                              initial={
                                f.label.trim().charAt(0).toUpperCase() || "?"
                              }
                              cacheBust={avatarCacheBust}
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
                          </div>
                          <button
                            type="button"
                            className={`shrink-0 text-xs underline ${
                              pendingUnfriendId === f.userId
                                ? "font-semibold text-[var(--app-accent)]"
                                : "text-[var(--app-muted)]"
                            }`}
                            onClick={() => onRemoveFriend(f.userId)}
                          >
                            {pendingUnfriendId === f.userId
                              ? "Tap again to remove"
                              : "Remove"}
                          </button>
                        </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onCopyAppLink}
                className="mt-4 w-full text-center text-xs text-[var(--app-muted)] underline"
              >
                Copy invite link (Community tab for new signups)
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-3 shadow-lg shadow-black/10 backdrop-blur-sm"
              role="tabpanel"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Friends
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--app-muted)]">
                    {friendsState.friends.length === 0
                      ? "No friends yet"
                      : friendsState.friends.length === 1
                        ? "1 friend connected"
                        : `${friendsState.friends.length} friends connected`}
                    {friendsState.incoming.length > 0 ? (
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        {" "}
                        · {friendsState.incoming.length} incoming{" "}
                        {friendsState.incoming.length === 1
                          ? "request"
                          : "requests"}
                      </span>
                    ) : null}
                    {friendsState.outgoing.length > 0 ? (
                      <span className="text-[var(--foreground)]/70">
                        {" "}
                        · {friendsState.outgoing.length} pending
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onFriendsPanelExpanded(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white sm:self-stretch"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  Add / manage
                </button>
              </div>
              {friendNotice ? (
                <p
                  className={`mt-3 text-sm ${friendNoticeClass(friendNotice.kind)}`}
                  role={friendNotice.kind === "error" ? "alert" : undefined}
                >
                  {friendNotice.text}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
            <WorkEntriesFeed
              entries={friendFeed}
              displayName=""
              variant="friend"
              onRefresh={refreshEntryFeeds}
              title="Friends&apos; activity"
              subtitle="Clap or leave a note on their sessions — they&apos;ll see it in notifications."
              avatarCacheBust={avatarCacheBust}
              emptyMessage={
                friendsState.friends.length === 0
                  ? "Open the Friends tab to add someone and see shared activity here."
                  : "Nothing logged yet — check back after their next session."
              }
            />
          </div>
        </>
      )}
    </aside>
  );
}
