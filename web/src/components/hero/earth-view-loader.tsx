import { EARTH_VIEW_HEIGHT_PX } from "@/components/earth-view/constants";

/** Fallback shown while the Three.js bundle + EarthView component
 *  are still loading on first hero swap. Sized to match EarthView's
 *  320px square so the card doesn't jump when content arrives. */
export function EarthViewLoader() {
  return (
    <div
      className="w-full rounded-card overflow-hidden border border-edge bg-bg grid place-items-center text-fg-subtle text-xs"
      style={{ height: EARTH_VIEW_HEIGHT_PX }}
      role="status"
    >
      Loading 3D earth…
    </div>
  );
}
