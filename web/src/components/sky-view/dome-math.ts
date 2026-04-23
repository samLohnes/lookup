/** Dimensions for the sky dome SVG. */
export const DOME_SIZE = 320;
export const DOME_RADIUS = 140;
export const DOME_CENTER = DOME_SIZE / 2;

/**
 * Convert (azimuth, elevation) to SVG (x, y).
 *
 * Azimuth convention: 0° = north = up, 90° = east, 180° = south, 270° = west.
 * Elevation 90° = zenith = center of the dome; elevation 0° lies on the
 * outer circle.
 *
 * Uses the standard "looking up" sky-chart projection: **east is on the LEFT,
 * west on the RIGHT** — the mirror of a ground map. This matches
 * Heavens-Above, planispheres, Stellarium, and every other observational
 * sky chart. Do not "correct" this by flipping the sign without reading the
 * comment — it is intentional.
 *
 * Note the negated sin term: `x = CENTER − r·sin(az)`. A ground-map-style
 * projection would use `+ r·sin(az)`.
 */
export function altAzToXy(az_deg: number, el_deg: number) {
  const r = ((90 - el_deg) / 90) * DOME_RADIUS;
  const az_rad = (az_deg * Math.PI) / 180;
  const x = DOME_CENTER - r * Math.sin(az_rad);
  const y = DOME_CENTER - r * Math.cos(az_rad);
  return { x, y };
}
