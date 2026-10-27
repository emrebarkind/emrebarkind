"use client";

import * as React from "react";
import { motion, useSpring, useMotionValue, useReducedMotion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ActivityDay {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** 0..n raw count (will be bucketed into 5 levels). */
  count: number;
}

export interface GitHubActivityGridProps {
  /**
   * Days, oldest-first. Length should be exactly the visible window
   * (typically 365 or 371 for a clean 53-week grid).
   */
  days: ActivityDay[];
  /**
   * Maximum count used to compute level buckets. Defaults to the max in
   * `days` (so colors are always relative to the dataset).
   */
  maxCount?: number;
  /** Cell size in px. Default 11. */
  cellSize?: number;
  /** Gap between cells in px. Default 3. */
  cellGap?: number;
  className?: string;
}

// Contribution-density buckets: green into lime, the profile's own palette.
// Green still reads as "growth / activity"; on the white card the busiest days
// are the darkest green, on the black card they are the brightest lime.
const LEVEL_BG = [
  "bg-[color:var(--surface-muted,var(--muted))]",
  "bg-lime-200 dark:bg-green-900",
  "bg-lime-400 dark:bg-green-700",
  "bg-green-500 dark:bg-lime-500",
  "bg-green-700 dark:bg-lime-300",
] as const;

const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ACTIVITY_MATTE_NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.65 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;
const WEEKDAY_LABEL_WIDTH = 22;
const WEEKDAY_LABEL_GAP = 4;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function GitHubActivityGrid({
  days,
  maxCount,
  cellSize = 11,
  cellGap = 3,
  className,
}: GitHubActivityGridProps) {
  const reduce = useReducedMotion();
  /* ---------------- bucketise into 0..4 levels --------------------------- */
  const max = React.useMemo(() => {
    if (typeof maxCount === "number" && maxCount > 0) return maxCount;
    return Math.max(1, ...days.map((d) => d.count));
  }, [days, maxCount]);

  function level(count: number) {
    if (count <= 0) return 0;
    const ratio = count / max;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  /* ---------------- group into [week][weekday] grid ---------------------- */
  // Day 0 = first cell. We pad the start to align Sunday=0 of week 0.
  const grid = React.useMemo(() => {
    if (days.length === 0) return { weeks: [] as (ActivityDay | null)[][], monthLabels: [] as { col: number; label: string }[] };
    const first = new Date(days[0].date + "T00:00:00");
    const startWeekday = first.getDay(); // 0..6
    const flat: (ActivityDay | null)[] = [
      ...Array.from({ length: startWeekday }, () => null),
      ...days,
    ];
    // pad tail so each week is full
    while (flat.length % 7 !== 0) flat.push(null);

    const weeks: (ActivityDay | null)[][] = [];
    for (let i = 0; i < flat.length; i += 7) {
      weeks.push(flat.slice(i, i + 7));
    }

    // month labels per week column (label appears at first week containing day 1..7 of month)
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((wk, col) => {
      const firstReal = wk.find(Boolean) as ActivityDay | undefined;
      if (!firstReal) return;
      const m = new Date(firstReal.date + "T00:00:00").getMonth();
      if (m !== lastMonth) {
        // a month that only got a column or two would print under the next label
        const prev = monthLabels.at(-1);
        if (prev && col - prev.col < 3) monthLabels.pop();
        monthLabels.push({ col, label: MONTHS[m] });
        lastMonth = m;
      }
    });
    return { weeks, monthLabels };
  }, [days]);

  /* ---------------- single global tooltip, springed position ----------- */
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const tooltipX = useMotionValue(0);
  const tooltipY = useMotionValue(0);
  const springX = useSpring(tooltipX, { stiffness: 480, damping: 40, mass: 0.5 });
  const springY = useSpring(tooltipY, { stiffness: 480, damping: 40, mass: 0.5 });
  const [hover, setHover] = React.useState<ActivityDay | null>(null);
  const gridViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [gridViewportWidth, setGridViewportWidth] = React.useState(0);

  React.useEffect(() => {
    const node = gridViewportRef.current;
    if (!node) return;

    const measure = () => setGridViewportWidth(node.clientWidth);
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function onCellEnter(
    e: React.PointerEvent<HTMLButtonElement>,
    day: ActivityDay
  ) {
    const cont = containerRef.current;
    if (!cont) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    // Center-top of the cell, relative to container
    tooltipX.set(r.left - cr.left + r.width / 2);
    tooltipY.set(r.top - cr.top - 6);
    setHover(day);
  }
  function onLeave() {
    setHover(null);
  }

  const totalContributions = React.useMemo(
    () => days.reduce((s, d) => s + d.count, 0),
    [days]
  );
  const weekCount = grid.weeks.length;
  const baseGridWidth =
    weekCount * cellSize + Math.max(0, weekCount - 1) * cellGap;
  const availableGridWidth = Math.max(
    0,
    gridViewportWidth - WEEKDAY_LABEL_WIDTH - WEEKDAY_LABEL_GAP
  );
  const fitScale =
    gridViewportWidth > 0 && baseGridWidth > availableGridWidth
      ? availableGridWidth / baseGridWidth
      : 1;
  const fittedCellSize = cellSize * fitScale;
  const fittedCellGap = cellGap * fitScale;
  const fittedGridWidth =
    weekCount * fittedCellSize + Math.max(0, weekCount - 1) * fittedCellGap;

  return (
    <div
      className={cn(
        "relative isolate w-full overflow-hidden rounded-2xl border border-black/[0.08] p-5",
        "bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffffff_0%,#f4f4f5_72%)]",
        "[box-shadow:0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(0,0,0,.08)]",
        "dark:border-white/[0.06] dark:bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#15151b_0%,#0a0a0b_72%)]",
        "dark:[box-shadow:0_1px_2px_rgba(0,0,0,.4),0_8px_24px_-12px_rgba(0,0,0,.6)]",
        className
      )}
      ref={containerRef}
      onPointerLeave={onLeave}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.055]"
        style={{ backgroundImage: ACTIVITY_MATTE_NOISE, backgroundSize: "240px 240px" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.035)_0%,transparent_30%,transparent_72%,rgba(0,0,0,0.055)_100%)] dark:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12)_0%,transparent_28%,transparent_72%,rgba(0,0,0,0.22)_100%)]"
      />

      {/* Header */}
      <div className="relative z-10 mb-3 flex items-end justify-between">
        <div>
          <div className="font-display text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
            <span className="tabular-nums">{totalContributions.toLocaleString()}</span>
            <span className="ml-1 font-normal text-[var(--muted-foreground)]">
              contributions in the last year
            </span>
          </div>
        </div>
        <Legend />
      </div>

      {/* Grid */}
      <div ref={gridViewportRef} className="relative z-10 overflow-hidden pb-1">
        <div className="flex min-w-0 flex-col">
          {/* Month labels row */}
          <div
            className="relative ml-7 h-3"
            style={{
              width: fittedGridWidth,
            }}
          >
            {grid.monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute top-0 text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]"
                style={{ left: m.col * (fittedCellSize + fittedCellGap) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex">
            {/* Weekday labels */}
            <div
              className="mr-1 flex flex-col"
              style={{ gap: fittedCellGap }}
            >
              {WEEKDAYS.map((wd, i) => (
                <span
                  key={i}
                  className="flex items-center text-[9.5px] font-medium tracking-tight text-[var(--muted-foreground)]"
                  style={{ height: fittedCellSize, width: WEEKDAY_LABEL_WIDTH }}
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Cells */}
            <div className="flex" style={{ gap: fittedCellGap }}>
              {grid.weeks.map((week, wIdx) => (
                <div
                  key={wIdx}
                  className="flex flex-col"
                  style={{ gap: fittedCellGap }}
                >
                  {week.map((day, dIdx) => {
                    if (!day) {
                      return (
                        <span
                          key={`pad-${wIdx}-${dIdx}`}
                          style={{
                            width: fittedCellSize,
                            height: fittedCellSize,
                          }}
                        />
                      );
                    }
                    const lvl = level(day.count);
                    // index back from the end → most recent day first
                    const fromEnd = days.length - 1 - days.indexOf(day);
                    const delay = fromEnd * 0.002;
                    return (
                      <motion.button
                        key={day.date}
                        type="button"
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                        transition={
                          reduce
                            ? { duration: 0 }
                            : {
                                delay,
                                type: "spring",
                                stiffness: 420,
                                damping: 28,
                                mass: 0.6,
                              }
                        }
                        onPointerEnter={(e) => onCellEnter(e, day)}
                        onFocus={(e) => {
                          // Synthesise a pointer-style enter for keyboard nav
                          const cont = containerRef.current;
                          if (!cont) return;
                          const r = (
                            e.currentTarget as HTMLButtonElement
                          ).getBoundingClientRect();
                          const cr = cont.getBoundingClientRect();
                          tooltipX.set(r.left - cr.left + r.width / 2);
                          tooltipY.set(r.top - cr.top - 6);
                          setHover(day);
                        }}
                        onBlur={onLeave}
                        aria-label={`${day.count} contributions on ${day.date}`}
                        className={cn(
                          "block rounded-[3px] outline-none transition-colors",
                          "ring-0 focus-visible:ring-2 focus-visible:ring-lime-500/70",
                          LEVEL_BG[lvl],
                          lvl === 0 &&
                            "ring-1 ring-inset ring-[var(--border)]/60"
                        )}
                        style={{
                          width: fittedCellSize,
                          height: fittedCellSize,
                          willChange: "transform",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ONE global tooltip, springs to the hovered cell */}
      <motion.div
        aria-hidden={!hover}
        style={{
          x: springX,
          y: springY,
          opacity: hover ? 1 : 0,
          translateX: "-50%",
          translateY: "-100%",
          willChange: "transform",
        }}
        transition={{ opacity: { duration: 0.12 } }}
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-20 select-none rounded-md px-2 py-1 text-[10.5px] font-medium tracking-tight",
          "border border-[var(--border)] bg-[color:var(--surface,var(--card))] text-[var(--foreground)]",
          "shadow-[0_8px_22px_-8px_rgba(0,0,0,.25)]"
        )}
      >
        {hover ? (
          <>
            <span className="tabular-nums">{hover.count}</span>{" "}
            {hover.count === 1 ? "contribution" : "contributions"}
            <span className="ml-1.5 text-[var(--muted-foreground)]">
              · {formatDate(hover.date)}
            </span>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
      <span>Less</span>
      {LEVEL_BG.map((bg, i) => (
        <span
          key={i}
          className={cn(
            "h-[10px] w-[10px] rounded-[3px]",
            bg,
            i === 0 && "ring-1 ring-inset ring-[var(--border)]/60"
          )}
        />
      ))}
      <span>More</span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Convenience: deterministic mock generator (handy for previews)            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Deterministic seeded mock generator. Returns 371 days (53 full weeks)
 * ending on `endDate` (default = today).
 */
export function mockActivityYear(
  seed = 42,
  endDate: Date = new Date()
): ActivityDay[] {
  const total = 371;
  const days: ActivityDay[] = [];
  let s = seed;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const wd = d.getDay();
    // weekends quieter, midweek busier
    const base = wd === 0 || wd === 6 ? 0.18 : 0.55;
    const r = rand();
    let count = 0;
    if (r < 0.35) count = 0;
    else if (r < 0.6) count = Math.floor(rand() * 3) + 1;
    else if (r < 0.85) count = Math.floor(rand() * 6) + 3;
    else count = Math.floor(rand() * 10) + 8;
    if (rand() > base) count = Math.max(0, count - 2);
    days.push({
      date: d.toISOString().slice(0, 10),
      count,
    });
  }
  return days;
}
