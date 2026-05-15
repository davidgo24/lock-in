"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Folder, LayoutGrid, User, Users } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

export type DashboardMobileTab = "timer" | "progress" | "areas" | "social";

type Props = {
  /** When on `/`, which dashboard pane is active (only if `onDashboardTabChange` is set). */
  dashboardTab?: DashboardMobileTab;
  onDashboardTabChange?: (tab: DashboardMobileTab) => void;
};

export function MobileTabBar({
  dashboardTab = "timer",
  onDashboardTabChange,
}: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  const timerActive = isHome && dashboardTab === "timer";
  const progressActive = isHome && dashboardTab === "progress";
  const areasActive = isHome && dashboardTab === "areas";
  const socialActive = isHome && dashboardTab === "social";
  const profileActive = isProfile;

  function goTab(e: React.MouseEvent, tab: DashboardMobileTab) {
    if (isHome && onDashboardTabChange) {
      e.preventDefault();
      hapticLight();
      onDashboardTabChange(tab);
      return;
    }
    hapticLight();
  }

  const itemBase =
    "app-pressable flex min-h-[3.1rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9px] font-semibold leading-tight transition-colors sm:min-h-[3.25rem] sm:rounded-xl sm:px-1.5 sm:text-[10px]";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-[var(--app-border)] bg-[var(--app-nav-bg)]/95 px-1 pt-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-4px_28px_rgba(0,0,0,0.35)] xl:hidden"
      style={{
        paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-between gap-0.5">
        <Link
          href="/?tab=timer"
          onClick={(e) => goTab(e, "timer")}
          className={`${itemBase} ${
            timerActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Clock
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            strokeWidth={timerActive ? 2.25 : 2}
          />
          <span className="text-center">Timer</span>
        </Link>
        <Link
          href="/?tab=progress"
          onClick={(e) => goTab(e, "progress")}
          className={`${itemBase} ${
            progressActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <LayoutGrid
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            strokeWidth={progressActive ? 2.25 : 2}
          />
          <span className="text-center">Progress</span>
        </Link>
        <Link
          href="/?tab=areas"
          onClick={(e) => goTab(e, "areas")}
          className={`${itemBase} ${
            areasActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Folder
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            strokeWidth={areasActive ? 2.25 : 2}
          />
          <span className="text-center">Areas</span>
        </Link>
        <Link
          href="/?tab=social"
          onClick={(e) => goTab(e, "social")}
          className={`${itemBase} ${
            socialActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Users
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            strokeWidth={socialActive ? 2.25 : 2}
          />
          <span className="text-center">Social</span>
        </Link>
        <Link
          href="/profile"
          onClick={() => hapticLight()}
          className={`${itemBase} ${
            profileActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <User
            className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            strokeWidth={profileActive ? 2.25 : 2}
          />
          <span className="text-center">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
