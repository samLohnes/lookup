import { useState } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { formatTimeInTz } from "@/lib/format-time";
import type { PassItem } from "@/types/api";

/** Format a nullable magnitude to one decimal place, or an em-dash. */
function formatMag(mag: number | null): string {
  return mag === null ? "—" : mag.toFixed(1);
}

/** Format a duration in seconds as e.g. "5m 42s". */
function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Right-side rail listing current passes. Collapses to a narrow strip of
 *  peak times; expands to a wider panel showing magnitude and duration.
 *  Clicking a bar selects the pass in the global selection store.
 */
export function PassRail() {
  const [expanded, setExpanded] = useState(false);
  const { data: passes } = useCurrentPasses();
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const setSelection = useSelectionStore((s) => s.select);
  const tzMode = useDisplayTzStore((s) => s.mode);
  const { data: observerTzData } = useObserverTimezone();
  const observerTz = observerTzData?.timezone ?? "UTC";

  if (!passes || passes.length === 0) return null;

  const widthClass = expanded ? "w-[300px]" : "w-[70px]";

  return (
    <aside
      className={`fixed right-0 top-[52px] bottom-[60px] ${widthClass} bg-bg-raised/90 border-l border-edge backdrop-blur z-10 flex flex-col`}
    >
      <div className="text-xs text-fg-muted uppercase tracking-wider text-center py-2 border-b border-edge/50">
        Passes ({passes.length})
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {passes.map((p: PassItem) => {
          const isActive = p.id === selectedId;
          const time = formatTimeInTz(p.peak.time, tzMode, observerTz);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelection(p.id)}
              className={
                "w-full text-left rounded p-2 text-xs transition-colors " +
                (isActive
                  ? "bg-accent/20 border border-accent text-accent-foreground"
                  : "bg-bg border border-edge/30 hover:bg-bg-raised text-fg-muted")
              }
            >
              {expanded ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">{time}</span>
                    <span className="tabular-nums text-fg-muted">
                      {formatMag(p.max_magnitude)} mag
                    </span>
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
        className="text-[10px] text-fg-subtle p-2 border-t border-edge/50 hover:bg-bg-raised"
      >
        {expanded ? "⇥ collapse" : "⇤ expand"}
      </button>
    </aside>
  );
}
