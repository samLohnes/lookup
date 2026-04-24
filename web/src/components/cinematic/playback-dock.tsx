import { useSelectionStore } from "@/store/selection";
import { PlayButton } from "@/components/playback/play-button";
import { ScrubBar } from "@/components/playback/scrub-bar";
import { SpeedSelector } from "@/components/playback/speed-selector";
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

/** Bottom floating dock shown while a pass is selected in cinematic mode.
 *  Contains play/pause + scrubber + speed + compact live telemetry. */
export function PlaybackDock() {
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const { sample } = useTrackAtCursor();
  if (selectedPassId === null) return null;

  return (
    <div className="fixed left-12 right-[82px] bottom-3 h-11 bg-bg-raised/82 border border-accent-400/15 rounded-lg backdrop-blur-[14px] px-4 flex items-center gap-4 z-10 text-[10.5px] text-[#c5a888]">
      <PlayButton />
      <div className="flex-1">
        <ScrubBar />
      </div>
      <SpeedSelector />
      <span className="text-edge">|</span>
      <div className="flex items-center gap-3 tabular-nums">
        {sample ? (
          <>
            <span className="font-mono">
              <span className="text-[8.5px] uppercase tracking-[0.08em] font-semibold text-[#6a5d48] mr-1">
                alt
              </span>
              {sample.alt_km.toFixed(0)} km
            </span>
            <span className="font-mono">
              <span className="text-[8.5px] uppercase tracking-[0.08em] font-semibold text-[#6a5d48] mr-1">
                el
              </span>
              {sample.el.toFixed(0)}°
            </span>
            <span className="font-mono">
              <span className="text-[8.5px] uppercase tracking-[0.08em] font-semibold text-[#6a5d48] mr-1">
                mag
              </span>
              {sample.magnitude === null ? "—" : sample.magnitude.toFixed(1)}
            </span>
          </>
        ) : (
          <span className="text-[#6a5d48]">Loading…</span>
        )}
      </div>
    </div>
  );
}
