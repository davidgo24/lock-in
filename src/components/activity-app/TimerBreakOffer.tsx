"use client";

import { Coffee } from "lucide-react";
import { hapticLight, hapticMedium } from "@/lib/haptics";

type Props = {
  open: boolean;
  breakMinutes: number;
  onBreakMinutesChange: (minutes: number) => void;
  onStartBreak: () => void;
  onNotNow: () => void;
};

export function TimerBreakOffer({
  open,
  breakMinutes,
  onBreakMinutesChange,
  onStartBreak,
  onNotNow,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-offer-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-none"
        aria-label="Close"
        onClick={() => {
          hapticLight();
          onNotNow();
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border-2 border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-muted)] text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/25">
            <Coffee className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="break-offer-title"
              className="font-display text-lg text-[var(--foreground)]"
            >
              Take a break?
            </h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Your focus block finished — you&apos;re in overtime now. Want to
              step away for a few minutes?
            </p>
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
          Break length (minutes)
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            className="min-h-11 w-24 rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-center text-base tabular-nums text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
            value={breakMinutes}
            aria-label="Break length in minutes"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              onBreakMinutesChange(Number.isFinite(n) ? n : 5);
            }}
          />
          <span className="text-sm text-[var(--app-muted)]">minutes</span>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onStartBreak();
            }}
            className="app-pressable flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--app-accent)] py-3 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25"
          >
            Start break
          </button>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onNotNow();
            }}
            className="app-pressable flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--background)] py-3 text-sm font-medium text-[var(--foreground)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
