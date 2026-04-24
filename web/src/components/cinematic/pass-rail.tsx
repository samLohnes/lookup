import { useState } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { formatTimeInTz } from "@/lib/format-time";
import type { PassItem } from "@/types/api";

/** Format a duration in seconds as e.g. "5m 42s". */
function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Compact time format (e.g. "3:41 AM") — no seconds, fits the 70px rail. */
const COMPACT_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

/** Right-side rail listing current passes. Collapses to a narrow strip of
 *  peak times; expands to a wider panel showing magnitude and duration.
 *  Clicking a bar selects the pass in the global selection store.
 */
export function PassRail() {
  const [expanded, setExpanded] = useState(false);
  const { data } = useCurrentPasses();
  const passes: PassItem[] = data?.passes ?? [];
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const setSelection = useSelectionStore((s) => s.select);
  const tzMode = useDisplayTzStore((s) => s.mode);
  const { data: observerTzData } = useObserverTimezone();
  const observerTz = observerTzData?.timezone ?? "UTC";

  if (passes.length === 0) return null;

  const widthClass = expanded ? "w-[300px]" : "w-[70px]";

  return (
    <aside
      className={`fixed right-0 top-[52px] bottom-[60px] ${widthClass} bg-bg-raised/90 border-l border-edge backdrop-blur z-10 flex flex-col`}
    >
      <div className="border-b border-accent-400/12 pb-2 mb-1">
        <div className="font-serif text-[13px] font-medium text-[#e8d8c0] text-center">
          Passes
        </div>
        <div className="text-[9px] uppercase tracking-[0.12em] text-[#8a7c68] text-center mt-0.5">
          {passes.length} tonight
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {passes.map((p: PassItem) => {
          const isActive = p.id === selectedId;
          const time = formatTimeInTz(
            p.peak.time,
            tzMode,
            observerTz,
            COMPACT_TIME_OPTS,
          );
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelection(p.id)}
              className={
                "w-full text-left rounded-md p-2 text-xs " +
                (isActive
                  ? "bg-accent-400/14 border border-accent-400/40 text-accent-200"
                  : "bg-white/[0.02] border border-accent-400/8 hover:bg-white/5 hover:border-accent-400/15 text-[#a89a84]")
              }
              style={{
                transition:
                  "background 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {expanded ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{time}</span>
                    {p.max_magnitude !== null ? (
                      <span className="tabular-nums text-fg-muted text-[10px]">
                        mag {p.max_magnitude.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2 text-[10px] text-fg-muted tabular-nums">
                    <span>{formatDurationShort(p.duration_s)}</span>
                    <span>peak el {p.peak.elevation_deg.toFixed(0)}°</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold">{time}</span>
                  <span className="text-[10px] text-fg-muted">
                    el {p.peak.elevation_deg.toFixed(0)}°
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-[#8a7c68] p-2 border-t border-accent-400/12 hover:text-accent-200"
        style={{
          transition:
            "color 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {expanded ? "⇥ collapse" : "⇤ expand"}
      </button>
    </aside>
  );
}
