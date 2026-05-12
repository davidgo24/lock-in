"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ThemeMode } from "@/lib/theme";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { hapticLight } from "@/lib/haptics";

export function setThemeMode(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate toggle from DOM / blocking script theme
    setMode(t === "light" ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    hapticLight();
    const next: ThemeMode =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    setThemeMode(next);
    setMode(next);
  }, []);

  const isLight = mode === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={mode === null}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] text-[var(--foreground)] active:opacity-90 disabled:opacity-60 ${className}`}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {mode === null ? (
        <span className="h-4 w-4 rounded-sm bg-[var(--app-muted)]/30" />
      ) : isLight ? (
        <Moon className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Sun className="h-4 w-4 shrink-0" aria-hidden />
      )}
    </button>
  );
}
