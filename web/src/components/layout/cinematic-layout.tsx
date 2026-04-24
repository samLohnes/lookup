import { Suspense, lazy, useEffect } from "react";
import { ChromeCluster } from "@/components/layout/chrome-cluster";
import { ConfigChips } from "@/components/cinematic/config-chips/config-chips";
import { PassesPanel } from "@/components/cinematic/passes-panel/passes-panel";
import { PlaybackDock } from "@/components/cinematic/playback-dock";
import { EarthViewLoader } from "@/components/hero/earth-view-loader";
import { useDraftInputsStore } from "@/store/draft-inputs";

const EarthView = lazy(() =>
  import("@/components/earth-view/earth-view").then((m) => ({
    default: m.EarthView,
  })),
);

/** Hero-first cinematic layout: full-viewport 3D earth with floating chrome,
 *  top-left config chips for inputs + Run, right-side passes panel (passes
 *  + sky view + telemetry), and slim bottom playback dock when a pass is
 *  selected. */
export function CinematicLayout() {
  useEffect(() => {
    useDraftInputsStore.getState().initFromCommitted();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      {/* Earth hero — renders in the viewport area left of the 360px passes panel so it centers in the visible space. */}
      <div className="absolute top-0 bottom-0 left-0 right-[360px] z-0">
        <Suspense fallback={<EarthViewLoader />}>
          <EarthView />
        </Suspense>
      </div>

      {/* Top-left config chips. */}
      <div className="fixed top-3 left-3 z-20">
        <ConfigChips />
      </div>

      {/* Top-right chrome cluster (mode + tz). */}
      <div className="fixed top-3 right-3 z-20">
        <ChromeCluster />
      </div>

      {/* Right-side passes panel (always expanded). */}
      <PassesPanel />

      {/* Bottom playback dock (hidden when no pass selected). */}
      <PlaybackDock />
    </div>
  );
}
