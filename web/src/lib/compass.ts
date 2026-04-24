const POINTS = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW",
] as const;

/** Convert an azimuth in degrees (0 = N, 90 = E, 180 = S, 270 = W) to a
 *  16-point compass rose abbreviation. Handles negative values and values
 *  ≥ 360 via modulo. Bins are 22.5° wide, centered on each point. */
export function azimuthToCompass(degrees: number): string {
  // Normalize to [0, 360). For negatives, `((n % 360) + 360) % 360`.
  const normalized = ((degrees % 360) + 360) % 360;
  // Each of 16 bins is 22.5° wide; shift by half a bin so bin 0 is centered on N.
  const idx = Math.round(normalized / 22.5) % 16;
  return POINTS[idx];
}
