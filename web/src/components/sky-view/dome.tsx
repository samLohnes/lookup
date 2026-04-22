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

/** Renders the sky dome: outer horizon ring, dashed elevation rings, zenith dot. */
export function Dome() {
  return (
    <>
      {/* outer horizon ring */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={DOME_RADIUS}
        className="fill-bg-raised stroke-edge"
      />
      {/* elevation rings at 30° and 60° */}
      {[30, 60].map((el) => (
        <circle
          key={el}
          cx={DOME_CENTER}
          cy={DOME_CENTER}
          r={((90 - el) / 90) * DOME_RADIUS}
          className="fill-none stroke-edge"
          strokeDasharray="2 3"
        />
      ))}
      {/* zenith dot */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={1.5}
        className="fill-fg-muted"
      />
    </>
  );
}
