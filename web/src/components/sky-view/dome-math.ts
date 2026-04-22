/** Dimensions for the sky dome SVG. */
export const DOME_SIZE = 320;
export const DOME_RADIUS = 140;
export const DOME_CENTER = DOME_SIZE / 2;

/**
 * Convert (azimuth, elevation) to SVG (x, y).
 * Azimuth 0° = north = up in the SVG (y negative).
 * Elevation 90° = zenith = center.
 */
export function altAzToXy(az_deg: number, el_deg: number) {
  const r = ((90 - el_deg) / 90) * DOME_RADIUS;
  const az_rad = (az_deg * Math.PI) / 180;
  const x = DOME_CENTER + r * Math.sin(az_rad);
  const y = DOME_CENTER - r * Math.cos(az_rad);
  return { x, y };
}
