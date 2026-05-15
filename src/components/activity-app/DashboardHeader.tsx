"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Bell, Flame, LogOut, MessageCircle, Sparkles, Trophy, User, Users } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { StatsBundle } from "@/lib/stats";
import type { ActivityNotificationRow } from "@/lib/work-client";

type Props = {
  appName: string;
  stats: StatsBundle;
  notif: { items: ActivityNotificationRow[]; unreadCount: number };
  notifOpen: boolean;
  notifPanelRef: RefObject<HTMLDivElement | null>;
  onToggleNotifPanel: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  /** Pending incoming friend requests — shows badge on Friends link. */
  pendingFriendRequests?: number;
};

export function DashboardHeader({
  appName,
  stats,
  notif,
  notifOpen,
  notifPanelRef,
  onToggleNotifPanel,
  onLogout,
  pendingFriendRequests = 0,
}: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] pb-4">
      <div className="min-w-0">
        <p className="font-display truncate text-xl tracking-tight text-[var(--foreground)] sm:text-2xl">
          {appName}
        </p>
        <p className="text-xs text-[var(--app-muted)]">
          Focus sessions · stay accountable
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-1.5 text-xs text-[var(--foreground)] sm:flex sm:text-sm">
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-[var(--app-accent)]" />
              {stats.streak}
            </span>
            <span className="h-3 w-px bg-[var(--app-border)]" />
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-[var(--app-highlight)]" />
              {stats.sessionCount}
            </span>
        </div>
        <div className="relative" ref={notifPanelRef}>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              void onToggleNotifPanel();
            }}
            className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border bg-[var(--app-surface-card)] px-2.5 py-2 text-[var(--foreground)] active:opacity-90 ${
              notif.unreadCount > 0
                ? "border-rose-500/70 ring-2 ring-rose-500/35 ring-offset-2 ring-offset-[var(--background)] dark:border-rose-400/60 dark:ring-rose-400/30"
                : "border-[var(--app-border)]"
            }`}
            aria-expanded={notifOpen}
            aria-label="Activity notifications"
          >
            <Bell
              className={`h-4 w-4 shrink-0 ${
                notif.unreadCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : ""
              }`}
            />
            {notif.unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-extrabold leading-none text-white shadow-md shadow-rose-600/55 ring-2 ring-white tabular-nums dark:bg-rose-500 dark:shadow-rose-500/50 dark:ring-[var(--background)]">
                {notif.unreadCount > 9 ? "9+" : notif.unreadCount}
              </span>
            ) : null}
          </button>
          {notifOpen ? (
            <div
              className="fixed inset-x-3 top-[max(3.5rem,env(safe-area-inset-top))] z-[100] max-h-[min(70dvh,28rem)] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] shadow-2xl shadow-black/20 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-full sm:z-50 sm:mt-2 sm:w-[min(22rem,calc(100vw-2rem))] sm:max-h-[22rem]"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-accent)]/[0.06] px-3 py-3 sm:px-4">
                <Bell className="h-4 w-4 shrink-0 text-[var(--app-accent)]" />
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Notifications
                </p>
              </div>
              {notif.items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--app-muted)]">
                  Nothing yet — when friends react or comment, or reply to your
                  thread, it shows up here.
                </p>
              ) : (
                <ul className="max-h-[min(60dvh,20rem)] overflow-y-auto overscroll-contain py-2 sm:max-h-[18rem]">
                  {notif.items.map((n) => (
                    <li
                      key={n.id}
                      className="flex gap-3 border-b border-[var(--app-border)]/50 px-3 py-3 text-sm leading-snug text-[var(--foreground)] last:border-b-0 hover:bg-[var(--background)]/45 sm:px-4"
                    >
                      <span
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          n.type === "CLAP"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-[var(--app-accent)]/12 text-[var(--app-accent)]"
                        }`}
                      >
                        {n.type === "CLAP" ? (
                          <Sparkles className="h-5 w-5" aria-hidden />
                        ) : (
                          <MessageCircle className="h-5 w-5" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p>
                          <span className="font-semibold">{n.actorLabel}</span>{" "}
                          {n.type === "CLAP"
                            ? "reacted to your activity"
                            : n.isOnYourSession !== false
                              ? "commented on your activity"
                              : "replied on a session you commented on"}
                        </p>
                        {n.sessionSummarySnippet ? (
                          <span className="mt-1.5 block rounded-lg bg-[var(--background)]/60 px-2 py-1.5 text-xs text-[var(--app-muted)]">
                            “{n.sessionSummarySnippet}”
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <Link
          href="/friends"
          onClick={() => hapticLight()}
          className={`relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] text-[var(--foreground)] hover:bg-[var(--background)]/50 ${
            pendingFriendRequests > 0
              ? "ring-2 ring-[var(--app-accent)]/50 ring-offset-2 ring-offset-[var(--background)]"
              : ""
          }`}
          aria-label="Friends and requests"
        >
          <Users className="h-4 w-4 shrink-0" />
          {pendingFriendRequests > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1.5 text-[11px] font-extrabold leading-none text-white shadow-md tabular-nums">
              {pendingFriendRequests > 9 ? "9+" : pendingFriendRequests}
            </span>
          ) : null}
        </Link>
        <Link
          href="/profile"
          onClick={() => hapticLight()}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] text-[var(--foreground)] hover:bg-[var(--background)]/50"
          aria-label="Your profile"
        >
          <User className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            hapticLight();
            void onLogout();
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] sm:text-sm"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
