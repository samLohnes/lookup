import { Dome } from "./dome";
import { DOME_SIZE } from "./dome-math";
import { Compass } from "./compass";
import { HorizonSilhouette } from "./horizon-silhouette";
import { SatelliteArc } from "./satellite-arc";
import { SatelliteCursor } from "./satellite-cursor";

/** SVG sky view showing the dome, elevation rings, compass labels, and terrain horizon silhouette. */
export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <HorizonSilhouette />
      <SatelliteArc />
      <SatelliteCursor />
      <Compass />
    </svg>
  );
}
