import { Suspense, lazy } from "react";
import { useAppModeStore } from "@/store/app-mode";
import { ResearchLayout } from "@/components/layout/research-layout";
import { useCursorReset } from "@/hooks/use-cursor-reset";
import { usePlaybackLoop } from "@/hooks/use-playback-loop";
import { useWindowWidth } from "@/hooks/use-window-width";
import { EarthViewLoader } from "@/components/hero/earth-view-loader";

// Cinematic layout pulls the Three.js chunk — lazy so research users never download it.
const CinematicLayout = lazy(() =>
  import("@/components/layout/cinematic-layout").then((m) => ({
    default: m.CinematicLayout,
  })),
);

export default function App() {
  useCursorReset();
  usePlaybackLoop();

  const mode = useAppModeStore((s) => s.mode);
  const width = useWindowWidth();
  const narrow = width < 900;

  if (mode === "cinematic" && !narrow) {
    return (
      <Suspense fallback={<EarthViewLoader />}>
        <CinematicLayout />
      </Suspense>
    );
  }
  return <ResearchLayout />;
}
