import { Suspense, lazy, useEffect } from "react";
import { ChromeCluster } from "@/components/layout/chrome-cluster";
import { ConfigChips } from "@/components/cinematic/config-chips/config-chips";
import { PassRail } from "@/components/cinematic/pass-rail";
import { PlaybackDock } from "@/components/cinematic/playback-dock";
import { PipSkyView } from "@/components/cinematic/pip-sky-view";
import { EarthViewLoader } from "@/components/hero/earth-view-loader";
import { useDraftInputsStore } from "@/store/draft-inputs";

const EarthView = lazy(() =>
  import("@/components/earth-view/earth-view").then((m) => ({
    default: m.EarthView,
  })),
);

/** Hero-first cinematic layout: full-viewport 3D earth with floating chrome,
 *  top-left config chips for inputs + Run, right pass rail, bottom playback
 *  dock, and a resizable PiP sky view. */
export function CinematicLayout() {
  useEffect(() => {
    useDraftInputsStore.getState().initFromCommitted();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      {/* Earth hero — full viewport background. */}
      <div className="absolute inset-0 z-0">
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

      {/* Right pass rail. */}
      <PassRail />

      {/* Bottom playback dock (hidden when no pass selected). */}
      <PlaybackDock />

      {/* PiP sky view — floats above the earth, below chrome. */}
      <PipSkyView />
    </div>
  );
}
