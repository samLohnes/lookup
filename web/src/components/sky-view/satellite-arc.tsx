import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { altAzToXy } from "./dome";

/** Renders the arc and peak dot for the currently selected pass on the sky dome. */
export function SatelliteArc() {
  const { data } = useCurrentSkyTrack();
  if (!data || data.samples.length === 0) return null;

  // Drop samples below the horizon — they only pollute the path.
  const visible = data.samples.filter((s) => s.el >= 0);
  if (visible.length < 2) return null;

  const d = visible
    .map((s, i) => {
      const p = altAzToXy(s.az, s.el);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  // Peak: sample with max elevation.
  const peak = visible.reduce((best, s) => (s.el > best.el ? s : best), visible[0]);
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
