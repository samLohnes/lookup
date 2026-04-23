import { altAzToXy } from "./dome-math";

/** Build the SVG polygon point list for a terrain horizon silhouette.
 *
 * Forward pass (az = 0..359) traces the terrain elevation per azimuth
 * (clamped to ≥ 0 so the path never dips below the horizon line). Reverse
 * pass (az = 359..0) traces the horizon line itself. The two together form
 * a closed polygon that fills the band between the terrain silhouette and
 * the horizon — exactly the area blocked from view.
 *
 * `samples_deg[i]` is the terrain elevation in degrees at azimuth i°.
 * Must have length 360.
 */
export function buildHorizonPoints(samples_deg: number[]): string {
  if (samples_deg.length !== 360) {
    throw new Error(`expected 360 horizon samples, got ${samples_deg.length}`);
  }
  const points: string[] = [];
  for (let az = 0; az < 360; az += 1) {
    const el = Math.max(samples_deg[az], 0);
    const p = altAzToXy(az, el);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  for (let az = 359; az >= 0; az -= 1) {
    const p = altAzToXy(az, 0);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  return points.join(" ");
}
