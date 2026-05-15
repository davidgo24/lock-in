"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, User, Users } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

type Props = {
  /** When on `/`, which dashboard pane is active (only used if `onDashboardTabChange` is set). */
  dashboardTab?: "focus" | "social";
  onDashboardTabChange?: (tab: "focus" | "social") => void;
};

export function MobileTabBar({
  dashboardTab = "focus",
  onDashboardTabChange,
}: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  const focusActive = isHome && dashboardTab === "focus";
  const socialActive = isHome && dashboardTab === "social";
  const profileActive = isProfile;

  function goFocus(e: React.MouseEvent) {
    if (isHome && onDashboardTabChange) {
      e.preventDefault();
      hapticLight();
      onDashboardTabChange("focus");
      return;
    }
    hapticLight();
  }

  function goSocial(e: React.MouseEvent) {
    hapticLight();
    if (isHome && onDashboardTabChange) {
      e.preventDefault();
      onDashboardTabChange("social");
    }
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-[var(--app-border)] bg-[var(--app-nav-bg)]/95 px-2 pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-4px_28px_rgba(0,0,0,0.35)] xl:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1">
        <Link
          href="/"
          onClick={goFocus}
          className={`app-pressable flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors ${
            focusActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Clock className="h-5 w-5 shrink-0" strokeWidth={focusActive ? 2.25 : 2} />
          <span>Focus</span>
        </Link>
        <Link
          href="/?tab=social"
          onClick={goSocial}
          className={`app-pressable flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors ${
            socialActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Users className="h-5 w-5 shrink-0" strokeWidth={socialActive ? 2.25 : 2} />
          <span>Social</span>
        </Link>
        <Link
          href="/profile"
          onClick={() => hapticLight()}
          className={`app-pressable flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors ${
            profileActive
              ? "bg-[var(--app-tab-active-bg)] text-[var(--app-accent)]"
              : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <User className="h-5 w-5 shrink-0" strokeWidth={profileActive ? 2.25 : 2} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
