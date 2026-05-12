"use client";

import Link from "next/link";
import { hapticLight } from "@/lib/haptics";
import {
  WorkEntriesFeed,
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";
import { focusMinutesLeftLabel } from "@/lib/focus-quips";
import type { FriendsStatePayload } from "@/lib/friends";
import { FriendMiniAvatar } from "@/components/activity-app/FriendMiniAvatar";

export type CommunitySidebarProps = {
  displayName: string;
  viewerUserId: string;
  viewerHasAvatar: boolean;
  avatarCacheBust: number;
  workEntries: WorkEntryRow[];
  friendFeed: WorkEntryRow[];
  friendsState: FriendsStatePayload;
  sidebarTab: "you" | "community";
  onSidebarTab: (tab: "you" | "community") => void;
  refreshEntryFeeds: () => void | Promise<void>;
};

export function CommunitySidebar({
  displayName,
  viewerUserId,
  viewerHasAvatar,
  avatarCacheBust,
  workEntries,
  friendFeed,
  friendsState,
  sidebarTab,
  onSidebarTab,
  refreshEntryFeeds,
}: CommunitySidebarProps) {
  const focusingFriends = [...friendsState.friends]
    .filter((f) => f.activeFocusEndsAt)
    .sort(
      (a, b) =>
        new Date(a.activeFocusEndsAt!).getTime() -
        new Date(b.activeFocusEndsAt!).getTime(),
    );

  return (
    <aside
      id="dash-section-community"
      className="dash-section-anchor order-3 min-w-0 xl:sticky xl:top-4 xl:self-start"
    >
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
          onClick={() => {
            hapticLight();
            onSidebarTab("you");
          }}
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
          onClick={() => {
            hapticLight();
            onSidebarTab("community");
          }}
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
            · friends&apos; activity and who&apos;s online
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5"
            role="region"
            aria-label="Friends currently in focus"
          >
            <p className="font-display text-base text-[var(--foreground)]">
              Online now
            </p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--app-muted)]">
              Friends with an active timer — focus area updates while they work.
            </p>
            {friendsState.friends.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--app-muted)]">
                Add people on the{" "}
                <Link
                  href="/friends"
                  className="font-medium text-[var(--app-accent)] underline"
                >
                  Friends
                </Link>{" "}
                page to see when they&apos;re in focus.
              </p>
            ) : focusingFriends.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--app-muted)]">
                No one&apos;s in focus right now. Check back when a friend
                starts their timer.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {focusingFriends.map((f) => (
                  <li key={f.userId}>
                    <Link
                      href={`/friends/${f.userId}`}
                      className="flex gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2.5 transition hover:bg-[var(--background)]/55"
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
                          <span className="inline-flex items-center gap-1.5 text-[var(--foreground)]/90">
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Your network
                </p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--app-muted)]">
                  {friendsState.friends.length === 0
                    ? "Send requests and accept invites on the Friends page."
                    : `${friendsState.friends.length} friend${friendsState.friends.length === 1 ? "" : "s"} connected`}
                  {friendsState.incoming.length > 0 ? (
                    <span className="font-medium text-rose-600 dark:text-rose-400">
                      {" "}
                      · {friendsState.incoming.length} incoming{" "}
                      {friendsState.incoming.length === 1
                        ? "request"
                        : "requests"}
                    </span>
                  ) : null}
                </p>
              </div>
              <Link
                href="/friends"
                onClick={() => hapticLight()}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] px-4 py-2.5 text-center text-xs font-medium text-white sm:self-stretch"
              >
                Friends page
              </Link>
            </div>
          </div>

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
                  ? "Go to the Friends page to connect with someone."
                  : "Nothing logged yet — check back after their next session."
              }
            />
          </div>
        </>
      )}
    </aside>
  );
}
