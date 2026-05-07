"use client";

import { useMemo } from "react";

type Props = {
  heatmap: Record<string, number>;
  /** First calendar day to show (YYYY-MM-DD), usually platform join / first activity. */
  rangeStartKey: string;
};

/** Dark-theme friendly: low activity must stay visible (not blue-950 on slate). */
const levels = [
  "bg-slate-700",
  "bg-blue-600/85",
  "bg-blue-500",
  "bg-sky-400",
  "bg-cyan-300",
];

function minuteLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatCellTitle(key: string, sec: number): string {
  const h = sec / 3600;
  const m = Math.round(sec / 60);
  if (h >= 1) return `${key}: ${h.toFixed(2)}h`;
  if (m >= 1) return `${key}: ${m}m`;
  return `${key}: ${sec}s`;
}

type Cell = { key: string; minutes: number; level: number; sec: number } | null;

function parseLocalYmd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function ContributionHeatmap({ heatmap, rangeStartKey }: Props) {
  const { weeks, monthLabels } = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const first = parseLocalYmd(rangeStartKey);
    first.setHours(0, 0, 0, 0);

    if (first > last) {
      first.setTime(last.getTime());
    }

    const gridStart = new Date(first);
    while (gridStart.getDay() !== 0) {
      gridStart.setDate(gridStart.getDate() - 1);
    }

    const weeks: Cell[][] = [];
    const cur = new Date(gridStart);
    let week: Cell[] = [];

    while (cur <= last) {
      const key = localYmd(cur);
      const sec = heatmap[key] ?? 0;
      const minutes = sec / 60;
      if (cur < first) {
        week.push(null);
      } else {
        week.push({ key, minutes, level: minuteLevel(minutes), sec });
      }

      if (cur.getDay() === 6) {
        weeks.push(week);
        week = [];
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((w, colIdx) => {
      const anchor = w.find((c) => c !== null) ?? w[0];
      if (!anchor) return;
      const d = new Date(anchor.key + "T12:00:00");
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        monthLabels.push({
          col: colIdx,
          label: d.toLocaleString("en-US", { month: "short" }),
        });
      }
    });

    return { weeks, monthLabels };
  }, [heatmap, rangeStartKey]);

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
      <div className="relative w-full min-w-0 max-w-full">
        <div
          className="mb-1 grid text-[10px] text-slate-500 sm:text-[11px]"
          style={{
            gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {weeks.map((_, i) => {
            const label = monthLabels.find((m) => m.col === i)?.label ?? "";
            return (
              <div key={i} className="min-w-0 truncate px-px text-left sm:px-0.5">
                {label}
              </div>
            );
          })}
        </div>

        <div
          className="grid items-start gap-x-[2px] sm:gap-x-[3px]"
          style={{
            gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
            (day, rowIdx) => (
              <div key={day} className="contents">
                <div className="flex h-2.5 items-center pr-0.5 text-[9px] leading-none text-slate-500 sm:h-3 sm:text-[11px]">
                  {rowIdx % 2 === 1 ? "" : day.slice(0, 1)}
                </div>
                {weeks.map((week, colIdx) => {
                  const cell = week[rowIdx];
                  return (
                    <div
                      key={`${colIdx}-${rowIdx}`}
                      title={
                        cell ? formatCellTitle(cell.key, cell.sec) : "No activity"
                      }
                      className={`h-2.5 w-full min-w-0 rounded-[1px] sm:h-3 sm:rounded-[2px] ${
                        cell ? levels[cell.level] : "bg-slate-900/80"
                      }`}
                    />
                  );
                })}
              </div>
            ),
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[10px] text-slate-500 sm:text-[11px]">
          <span>Less</span>
          <div className="flex gap-0.5 sm:gap-1">
            {levels.map((c) => (
              <div
                key={c}
                className={`h-2 w-2 rounded-[1px] sm:h-3 sm:w-3 sm:rounded-[2px] ${c}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
