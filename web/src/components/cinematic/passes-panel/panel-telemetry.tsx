import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import type { TrackSampleResponse } from "@/types/api";

interface Cell {
  label: string;
  format: (s: TrackSampleResponse) => string;
  dim?: boolean;
}

const CELLS: Cell[] = [
  { label: "alt", format: (s) => `${s.alt_km.toFixed(0)} km` },
  { label: "el", format: (s) => `${s.el.toFixed(0)}°` },
  { label: "az", format: (s) => `${s.az.toFixed(0)}°` },
  { label: "range", format: (s) => `${s.range_km.toFixed(0)} km`, dim: true },
  { label: "velocity", format: (s) => `${s.velocity_km_s.toFixed(2)} km/s`, dim: true },
  {
    label: "mag",
    format: (s) => s.magnitude === null ? "—" : s.magnitude.toFixed(1).replace(/^-/, "−"),
  },
];

/** Bottom of the passes panel: 2×3 grid of live telemetry values at the
 *  current playback cursor. Labels tiny uppercase, values in mono at
 *  ~15pt. Renders "—" in every cell when the sample is null (no pass
 *  selected OR samples still loading). */
export function PanelTelemetry() {
  const { sample } = useTrackAtCursor();

  return (
    <div className="border-t border-accent-400/12 bg-[rgba(10,8,20,0.35)] p-3.5">
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5">
        {CELLS.map(({ label, format, dim }) => {
          const value = sample ? format(sample) : "—";
          return (
            <div key={label}>
              <div className="text-[9px] uppercase tracking-[0.12em] text-[#8a7c68]">
                {label}
              </div>
              <div
                className={
                  "font-mono text-[15px] font-medium tabular-nums mt-0.5 " +
                  (dim ? "text-[#c5a888]" : "text-[#e8d8c0]")
                }
                aria-label={`${label}: ${value}`}
              >
                {value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
