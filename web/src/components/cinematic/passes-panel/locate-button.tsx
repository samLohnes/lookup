import { useLivePositionStore } from "@/store/live-position";
import { useSelectionStore } from "@/store/selection";
import { useCameraTargetStore } from "@/store/camera-target";
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

const DEG = Math.PI / 180;

/** Spherical centroid of N (lat, lng) points using vector-mean.
 *
 *  Naive averaging breaks at the antimeridian (e.g., 179 and -179 average
 *  to 0 instead of ±180). Vector-mean treats each point as a unit vector
 *  on the sphere and averages those, then converts back. Handles wrap-
 *  around naturally and degenerates to the average for tight clusters.
 */
function sphericalCentroid(
  points: { lat: number; lng: number }[],
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { lat: points[0].lat, lng: points[0].lng };
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    const latR = p.lat * DEG;
    const lngR = p.lng * DEG;
    x += Math.cos(latR) * Math.cos(lngR);
    y += Math.cos(latR) * Math.sin(lngR);
    z += Math.sin(latR);
  }
  const n = points.length;
  x /= n; y /= n; z /= n;
  // Antipodal / near-degenerate case: the mean vector has near-zero
  // magnitude, so atan2 below would return arbitrary lat/lng (often 0,0).
  // Bail out — the LocateButton will show as disabled with an explanatory
  // tooltip rather than tween the camera to Null Island.
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 1e-6) return null;
  const lat = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  return { lat, lng };
}

/** Small icon button in the passes-panel header. Tweens the camera to
 *  the current satellite position and deselects any currently-selected
 *  pass.
 *
 *  Target priority:
 *    1. Pass mode → pass-marker position from the playback cursor (so
 *       the button works while a pass is selected; useLivePolling's
 *       lifecycle gate empties the live store in this state).
 *    2. Live mode → spherical centroid of all active live positions.
 *    3. Idle (no satellite searched) → button disabled.
 */
export function LocateButton() {
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const positions = useLivePositionStore((s) => s.positions);
  const activeNorads = useLivePositionStore((s) => s.activeNorads);
  const reframeTo = useCameraTargetStore((s) => s.reframeTo);

  const { sample: passSample } = useTrackAtCursor();

  // Target priority:
  //   1. Pass mode (a pass is selected and the cursor sample is loaded):
  //      use the pass-marker position. This makes the button work in
  //      pass mode — without it, the live store is empty (cleared by
  //      useLivePolling's lifecycle gate) and the button would be
  //      uselessly disabled.
  //   2. Live mode (one or more live positions available): spherical
  //      centroid of all active satellite positions.
  //   3. Otherwise: null → button disabled.
  let target: { lat: number; lng: number } | null = null;
  if (selectedPassId !== null && passSample) {
    target = { lat: passSample.lat, lng: passSample.lng };
  } else {
    const livePoints = activeNorads
      .map((nid) => positions.get(nid))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((s) => ({ lat: s.lat, lng: s.lng }));
    target = sphericalCentroid(livePoints);
  }
  const disabled = target === null;

  const handleClick = () => {
    if (!target) return;
    // Deselect the pass first (if any). useLivePolling's effect will
    // re-fire on the next render, kicking off live polling. The reframe
    // below tweens the camera toward the current pass-marker location;
    // by the time the first live poll lands (within ~1s), the live
    // marker should appear roughly where the camera ended up.
    if (selectedPassId !== null) select(null);
    reframeTo(target.lat, target.lng);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        target !== null
          ? selectedPassId !== null
            ? "Locate satellite (deselects current pass)"
            : "Locate satellite"
          : activeNorads.length > 0
            ? "Waiting for live position…"
            : "Search a satellite first"
      }
      aria-label="Locate satellite"
      className={
        "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded " +
        "text-[14px] font-mono " +
        (disabled
          ? "text-[#5a5040] cursor-not-allowed"
          : "text-[#c5a888] hover:text-[#e8d8c0] hover:bg-accent-400/10 cursor-pointer")
      }
    >
      ◎
    </button>
  );
}
