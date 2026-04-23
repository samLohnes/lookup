import { altAzToXy } from "./dome-math";
import type { TrackSampleResponse } from "@/types/api";

export interface ArcPath {
  /** SVG path "d" string, or null if there are < 2 above-horizon samples. */
  d: string | null;
  /** The above-horizon sample with the highest elevation (the visual peak),
   *  or null if no sample is above the horizon. */
  peak: TrackSampleResponse | null;
}

/** Build an SVG arc + peak marker for a satellite's pass.
 *
 * Below-horizon samples are dropped (they'd render outside the dome).
 * If fewer than 2 samples remain, returns nulls (caller should render nothing).
 */
export function buildArcPath(samples: TrackSampleResponse[]): ArcPath {
  const visible = samples.filter((s) => s.el >= 0);
  if (visible.length < 2) return { d: null, peak: null };

  const d = visible
    .map((s, i) => {
      const p = altAzToXy(s.az, s.el);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  const peak = visible.reduce(
    (best, s) => (s.el > best.el ? s : best),
    visible[0],
  );

  return { d, peak };
}
