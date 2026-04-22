import { useMemo } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";

const STRIP_HEIGHT = 48;

export function TimelineStrip() {
  const { data } = useCurrentPasses();
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const { fromUtc, toUtc } = useTimeRangeStore();

  const { bars, dayTicks } = useMemo(() => {
    if (!data || data.passes.length === 0) return { bars: [], dayTicks: [] };
    const start = new Date(fromUtc).getTime();
    const end = new Date(toUtc).getTime();
    const span = Math.max(end - start, 1);

    const bars = data.passes.map((p) => {
      const t0 = new Date(p.rise.time).getTime();
      const t1 = new Date(p.set.time).getTime();
      return {
        id: p.id,
        leftPct: ((t0 - start) / span) * 100,
        widthPct: Math.max(((t1 - t0) / span) * 100, 0.4),
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
  }, [data, fromUtc, toUtc]);

  if (!data || data.passes.length === 0) return null;

  return (
    <div className="relative w-full" style={{ height: STRIP_HEIGHT }}>
      {/* axis line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-edge" />
      {/* day ticks */}
      {dayTicks.map((pct, i) => (
        <div
          key={i}
          className="absolute top-[40%] w-px h-[20%] bg-fg-subtle"
          style={{ left: `${pct}%` }}
        />
      ))}
      {/* pass bars */}
      {bars.map((bar) => {
        const isSelected = bar.id === selectedId;
        return (
          <button
            key={bar.id}
            onClick={() => select(bar.id)}
            className={`absolute top-[32%] h-[36%] rounded-sm transition-colors ${
              isSelected
                ? "bg-satellite shadow-glow"
                : "bg-satellite/30 hover:bg-satellite/60"
            }`}
            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
            aria-label={`Pass at ${bar.leftPct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}
