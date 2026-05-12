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
      className="sticky top-0 z-40 -mx-3 border-b border-[var(--app-border)]/80 bg-[var(--background)]/90 px-2 py-2.5 backdrop-blur-md sm:-mx-5 sm:px-3 xl:hidden"
      aria-label="Dashboard sections"
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              hapticLight();
              scrollToId(id);
            }}
            className="app-pressable flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-sm shadow-black/5 active:opacity-90"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--app-accent)]" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
