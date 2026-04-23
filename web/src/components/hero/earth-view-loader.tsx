/** Fallback shown while the Three.js bundle + EarthView component
 *  are still loading on first hero swap. Fills its parent so the
 *  cinematic full-viewport Suspense boundary doesn't collapse. */
export function EarthViewLoader() {
  return (
    <div
      className="w-full h-full overflow-hidden bg-bg grid place-items-center text-fg-subtle text-xs"
      role="status"
    >
      Loading 3D earth…
    </div>
  );
}
