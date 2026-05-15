"use client";

import { Clock, Folder, LayoutGrid, Users } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { isStandaloneWebApp } from "@/lib/standalone-display";

const sections = [
  { id: "dash-section-timer", label: "Timer", icon: Clock },
  { id: "dash-section-progress", label: "Progress", icon: LayoutGrid },
  { id: "dash-section-areas", label: "Areas", icon: Folder },
  { id: "dash-section-community", label: "Community", icon: Users },
] as const;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Installed / “Add to Home Screen” web apps use a standalone web view where
  // smooth scroll + `position: sticky` often jitters; in-tab Safari is fine.
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({
    behavior: reduceMotion || isStandaloneWebApp() ? "auto" : "smooth",
    block: "start",
  });
}

type DashboardSectionNavProps = {
  /** On narrow layouts, open the Social tab instead of scrolling to the community column. */
  onCommunityNavigate?: () => void;
};

/** Sticky jump links for small screens — desktop uses the three-column layout. */
export function DashboardSectionNav({ onCommunityNavigate }: DashboardSectionNavProps) {
  return (
    <nav
      className="dash-jump-nav sticky z-40 -mx-3 mb-1 border-b border-[var(--app-border)]/35 bg-[var(--background)] px-2 pb-2 pt-2 sm:-mx-5 sm:px-3 xl:hidden"
      style={{
        // Stick just below the safe area so we don’t need a huge in-flow pad
        // (that was creating a big gap above “Jump to” before the bar sticks).
        top: "max(0px, env(safe-area-inset-top, 0px))",
      }}
      aria-label="Dashboard sections"
    >
      <div className="rounded-2xl border-2 border-[var(--app-border)] bg-[var(--app-surface-card)] p-2.5 shadow-md shadow-black/20 ring-1 ring-[var(--app-accent)]/15">
        <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
          Jump to
        </p>
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                hapticLight();
                if (id === "dash-section-community" && onCommunityNavigate) {
                  onCommunityNavigate();
                  return;
                }
                scrollToId(id);
              }}
              className="app-pressable flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl border-2 border-[var(--app-border)] bg-[var(--background)] px-4 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] shadow-sm transition-colors hover:border-[var(--app-accent)]/55 hover:bg-[var(--app-accent-muted)] active:opacity-95"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent-muted)] text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/25">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
