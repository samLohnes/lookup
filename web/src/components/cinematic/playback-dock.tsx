import { useSelectionStore } from "@/store/selection";
import { PlayButton } from "@/components/playback/play-button";
import { ScrubBar } from "@/components/playback/scrub-bar";
import { SpeedSelector } from "@/components/playback/speed-selector";

/** Slim bottom dock — only rendered while a pass is selected.
 *  Contents: play button · scrubber · speed selector. Telemetry
 *  lives in the passes panel on the right. Right edge clears the
 *  360px panel with a 16px gap. */
export function PlaybackDock() {
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  if (selectedPassId === null) return null;

  return (
    <div className="fixed left-12 right-[376px] bottom-3 h-11 bg-bg-raised/82 border border-accent-400/15 rounded-lg backdrop-blur-[14px] px-4 flex items-center gap-4 z-10 text-[10.5px] text-[#c5a888]">
      <PlayButton />
      <div className="flex-1">
        <ScrubBar />
      </div>
      <SpeedSelector />
    </div>
  );
}
