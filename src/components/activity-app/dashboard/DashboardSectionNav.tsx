"use client";

import { Clock, Folder, LayoutGrid, Users } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const sections = [
  { id: "dash-section-timer", label: "Timer", icon: Clock },
  { id: "dash-section-progress", label: "Progress", icon: LayoutGrid },
  { id: "dash-section-areas", label: "Areas", icon: Folder },
  { id: "dash-section-community", label: "Community", icon: Users },
] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/** Sticky jump links for small screens — desktop uses the three-column layout. */
export function DashboardSectionNav() {
  return (
    <nav
      className="dash-jump-nav sticky top-0 z-40 -mx-3 mb-1 border-b border-[var(--app-border)]/35 bg-[var(--background)] px-2 pb-2 sm:-mx-5 sm:px-3 xl:hidden"
      style={{
        // Sticky `top` + env() alone often isn’t enough in Mobile Safari — pad the whole bar down
        // with a minimum so pills never sit under the status bar / Dynamic Island.
        paddingTop: "max(3.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
      }}
      aria-label="Dashboard sections"
    >
      <div className="rounded-2xl border-2 border-[var(--app-border)] bg-[var(--app-surface-card)] p-2.5 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45),0_0_0_1px_rgba(124,108,240,0.12)] ring-1 ring-[var(--app-accent)]/15">
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
                scrollToId(id);
              }}
              className="app-pressable flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl border-2 border-[var(--app-border)] bg-[var(--background)] px-4 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] shadow-[0_4px_14px_-3px_rgba(0,0,0,0.35)] transition-colors hover:border-[var(--app-accent)]/55 hover:bg-[var(--app-accent-muted)] hover:shadow-[0_6px_20px_-4px_rgba(124,108,240,0.35)] active:opacity-95"
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
