import type { TrackSampleResponse } from "@/types/api";

/** Linear interpolation between a and b at fraction t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate a TrackSample at a precise cursor time within a sample series.
 *
 * Returns null if `samples` is empty or the cursor is outside the series.
 *
 * Numeric fields (az, el, range, velocity, alt, lat, lng, magnitude when both
 * endpoints have it) are linearly interpolated. Boolean fields (sunlit,
 * observer_dark) snap to the earlier sample to avoid impossible mid-step
 * transitions like "half-eclipsed".
 */
export function interpolateAtCursor(
  samples: TrackSampleResponse[],
  cursorIso: string,
): TrackSampleResponse | null {
  if (samples.length === 0) return null;
  const cursor = Date.parse(cursorIso);
  if (Number.isNaN(cursor)) return null;
  const first = Date.parse(samples[0].time);
  const last = Date.parse(samples[samples.length - 1].time);
  if (cursor < first || cursor > last) return null;

  // Find the segment containing the cursor.
  let lo = 0;
  let hi = samples.length - 1;
  // Linear scan is fine — pass tracks have <= ~200 samples.
  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = Date.parse(samples[i].time);
    const b = Date.parse(samples[i + 1].time);
    if (cursor >= a && cursor <= b) {
      lo = i;
      hi = i + 1;
      break;
    }
  }

  const a = samples[lo];
  const b = samples[hi];
  const tA = Date.parse(a.time);
  const tB = Date.parse(b.time);
  const span = tB - tA;
  const t = span === 0 ? 0 : (cursor - tA) / span;

  const magBoth = a.magnitude != null && b.magnitude != null;

  return {
    time: cursorIso,
    lat: lerp(a.lat, b.lat, t),
    lng: lerp(a.lng, b.lng, t),
    alt_km: lerp(a.alt_km, b.alt_km, t),
    az: lerp(a.az, b.az, t),
    el: lerp(a.el, b.el, t),
    range_km: lerp(a.range_km, b.range_km, t),
    velocity_km_s: lerp(a.velocity_km_s, b.velocity_km_s, t),
    magnitude: magBoth ? lerp(a.magnitude!, b.magnitude!, t) : null,
    sunlit: a.sunlit, // snap to earlier
    observer_dark: a.observer_dark, // snap to earlier
  };
}
