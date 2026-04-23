import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import { altAzToXy } from "@/components/sky-view/dome-math";

/** SVG circle that tracks the satellite position at the current playback cursor. */
export function SatelliteCursor() {
  const { sample } = useTrackAtCursor();
  if (!sample || sample.el < 0) return null;
  const p = altAzToXy(sample.az, sample.el);
  return (
    <circle
      cx={p.x}
      cy={p.y}
      r={5}
      className="fill-satellite stroke-bg"
      strokeWidth={1.5}
    />
  );
}
