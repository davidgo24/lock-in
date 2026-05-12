"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Bell, Flame, LogOut, Trophy, User } from "lucide-react";
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
};

export function DashboardHeader({
  appName,
  stats,
  notif,
  notifOpen,
  notifPanelRef,
  onToggleNotifPanel,
  onLogout,
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
            onClick={() => void onToggleNotifPanel()}
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
              className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-2 shadow-xl shadow-black/20"
              role="dialog"
              aria-label="Notifications"
            >
              <p className="border-b border-[var(--app-border)] px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                Reactions on your activity
              </p>
              {notif.items.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-[var(--app-muted)]">
                  Nothing yet — when friends clap or comment, it shows up here.
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {notif.items.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg px-2 py-2 text-sm leading-snug text-[var(--foreground)] hover:bg-[var(--background)]/60"
                    >
                      <span className="font-medium">{n.actorLabel}</span>{" "}
                      {n.type === "CLAP"
                        ? "clapped your activity"
                        : "commented on your activity"}
                      {n.sessionSummarySnippet ? (
                        <span className="mt-0.5 block text-xs text-[var(--app-muted)]">
                          “{n.sessionSummarySnippet}”
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <Link
          href="/profile"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] text-[var(--foreground)] hover:bg-[var(--background)]/50"
          aria-label="Your profile"
        >
          <User className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => void onLogout()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] sm:text-sm"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
