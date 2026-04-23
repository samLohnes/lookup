import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { altAzToXy } from "./dome-math";
import { buildArcPath } from "./arc-path";

/** Renders the arc and peak dot for the currently selected pass on the sky dome. */
export function SatelliteArc() {
  const { data } = useCurrentSkyTrack();
  if (!data || data.samples.length === 0) return null;

  const { d, peak } = buildArcPath(data.samples);
  if (d == null || peak == null) return null;

  const peakP = altAzToXy(peak.az, peak.el);

  return (
    <>
      <path
        d={d}
        className="fill-none stroke-satellite"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={peakP.x}
        cy={peakP.y}
        r={3}
        className="fill-satellite"
      />
    </>
  );
}
