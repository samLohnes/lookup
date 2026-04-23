import type { PassItem } from "@/types/api";

export interface TimelineBar {
  id: string;
  leftPct: number;
  widthPct: number;
}

export interface TimelineLayout {
  bars: TimelineBar[];
  dayTicks: number[];
}

const MIN_BAR_WIDTH_PCT = 0.4;

/** Compute SVG-strip layout for a list of passes within a UTC time window.
 *
 * - `leftPct` and `widthPct` are clamped to [0, 100] so passes that begin
 *   before `fromUtc` or end after `toUtc` still render inside the strip.
 * - `dayTicks` are the percentage positions of UTC midnights within the window.
 */
export function computeTimelineLayout(
  passes: Pick<PassItem, "id" | "rise" | "set">[],
  fromUtc: string,
  toUtc: string,
): TimelineLayout {
  if (passes.length === 0) return { bars: [], dayTicks: [] };

  const start = new Date(fromUtc).getTime();
  const end = new Date(toUtc).getTime();
  const span = Math.max(end - start, 1);

  const bars: TimelineBar[] = passes.map((p) => {
    const t0 = new Date(p.rise.time).getTime();
    const t1 = new Date(p.set.time).getTime();
    const rawLeft = ((t0 - start) / span) * 100;
    const rawRight = ((t1 - start) / span) * 100;
    const leftPct = Math.min(Math.max(rawLeft, 0), 100);
    const rightPct = Math.min(Math.max(rawRight, 0), 100);
    return {
      id: p.id,
      leftPct,
      widthPct: Math.max(rightPct - leftPct, MIN_BAR_WIDTH_PCT),
    };
  });

  const dayTicks: number[] = [];
  const firstDayBoundary = new Date(start);
  firstDayBoundary.setUTCHours(0, 0, 0, 0);
  firstDayBoundary.setUTCDate(firstDayBoundary.getUTCDate() + 1);
  for (let t = firstDayBoundary.getTime(); t < end; t += 86400 * 1000) {
    dayTicks.push(((t - start) / span) * 100);
  }

  return { bars, dayTicks };
}
