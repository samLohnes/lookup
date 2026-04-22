import { useHorizon } from "@/hooks/use-horizon";
import { useObserverStore } from "@/store/observer";
import { DOME_CENTER, altAzToXy } from "./dome-math";

/** Renders the terrain horizon silhouette as a filled SVG polygon on the sky dome. */
export function HorizonSilhouette() {
  const current = useObserverStore((s) => s.current);
  const { data, isFetching, error } = useHorizon(
    current.lat,
    current.lng,
    current.elevation_m,
  );

  if (isFetching && !data) {
    return (
      <text
        x={DOME_CENTER}
        y={DOME_CENTER}
        textAnchor="middle"
        className="fill-fg-subtle text-[10px]"
      >
        Loading horizon…
      </text>
    );
  }

  if (error || !data) return null;

  // Build a closed polygon that traces the terrain silhouette above the
  // horizon line. For each azimuth az ∈ [0..359], compute the terrain
  // elevation angle, then draw to the corresponding (x, y). Close the
  // polygon back along the horizon (elevation = 0) to fill the band
  // between terrain and horizon.
  const points: string[] = [];
  for (let az = 0; az < 360; az += 1) {
    const el = Math.max(data.samples_deg[az], 0);
    const p = altAzToXy(az, el);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  // Close the polygon back along el=0 to fill the silhouette below.
  for (let az = 359; az >= 0; az -= 1) {
    const p = altAzToXy(az, 0);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }

  return (
    <polygon
      points={points.join(" ")}
      className="fill-observer/10 stroke-observer/40"
      strokeWidth={0.75}
      strokeLinejoin="round"
    />
  );
}
