"use client";

import { Fragment, useMemo } from "react";

type Props = {
  heatmap: Record<string, number>;
  /** First calendar day to show (YYYY-MM-DD), usually platform join / first activity. */
  rangeStartKey: string;
};

/** Heat levels — CSS vars switch with `data-theme` (dark terracotta / light rose–wine). */
const levels = [
  "bg-[var(--heat-0)]",
  "bg-[var(--heat-1)]",
  "bg-[var(--heat-2)]",
  "bg-[var(--heat-3)]",
  "bg-[var(--heat-4)]",
];

const CELL_PX = 11;
const GAP_PX = 3;
const LABEL_COL_PX = 28;

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

/** Left labels like GitHub: Mon / Wed / Fri only. */
function dayRowLabel(rowIdx: number): string {
  if (rowIdx === 1) return "Mon";
  if (rowIdx === 3) return "Wed";
  if (rowIdx === 5) return "Fri";
  return "";
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

  if (weeks.length === 0) {
    return (
      <p className="text-sm text-[var(--app-muted)]">No days to show yet — log a session.</p>
    );
  }

  const colTemplate = `${LABEL_COL_PX}px repeat(${weeks.length}, ${CELL_PX}px)`;

  return (
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
      <div
        className="grid w-max max-w-none"
        style={{
          gridTemplateColumns: colTemplate,
          gap: `${GAP_PX}px`,
        }}
      >
        {/* Month header row */}
        <div
          aria-hidden
          className="min-h-[15px]"
          style={{ width: LABEL_COL_PX }}
        />
        {weeks.map((_, i) => (
          <div
            key={`m-${i}`}
            className="flex items-end pb-px text-[10px] leading-none tracking-tight text-[var(--app-muted)] sm:text-[11px]"
            style={{ width: CELL_PX }}
          >
            {monthLabels.find((m) => m.col === i)?.label ?? ""}
          </div>
        ))}

        {/* Sun..Sat rows (row 0 = Sunday, GitHub-style) */}
        {[0, 1, 2, 3, 4, 5, 6].map((rowIdx) => (
          <Fragment key={`row-${rowIdx}`}>
            <div
              className="flex items-center justify-end text-[9px] leading-none text-[var(--app-muted)] sm:text-[10px]"
              style={{
                width: LABEL_COL_PX,
                height: CELL_PX,
              }}
            >
              {dayRowLabel(rowIdx)}
            </div>
            {weeks.map((week, colIdx) => {
              const cell = week[rowIdx];
              const isInactive = cell === null;
              return (
                <div
                  key={`${colIdx}-${rowIdx}`}
                  title={
                    cell
                      ? formatCellTitle(cell.key, cell.sec)
                      : isInactive
                        ? "Outside range"
                        : "No activity"
                  }
                  className={`shrink-0 rounded-[2px] border border-[var(--heatmap-cell-border)] ${
                    cell
                      ? levels[cell.level]
                      : "bg-[var(--heat-inactive)]"
                  }`}
                  style={{
                    width: CELL_PX,
                    height: CELL_PX,
                    boxSizing: "border-box",
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[10px] text-[var(--app-muted)] sm:text-[11px]">
        <span>Less</span>
        <div className="flex gap-0.5 sm:gap-1">
          {levels.map((c) => (
            <div
              key={c}
              className={`rounded-[2px] border border-[var(--heatmap-cell-border)] ${c}`}
              style={{ width: CELL_PX, height: CELL_PX }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
