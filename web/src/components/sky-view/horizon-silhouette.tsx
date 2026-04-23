import { useHorizon } from "@/hooks/use-horizon";
import { useObserverStore } from "@/store/observer";
import { DOME_CENTER } from "./dome-math";
import { buildHorizonPoints } from "./horizon-points";

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

  return (
    <polygon
      points={buildHorizonPoints(data.samples_deg)}
      className="fill-observer/10 stroke-observer/40"
      strokeWidth={0.75}
      strokeLinejoin="round"
    />
  );
}
