import { PlayButton } from "@/components/playback/play-button";
import { SpeedSelector } from "@/components/playback/speed-selector";
import { ScrubBar } from "@/components/playback/scrub-bar";

export function PlaybackBar() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <PlayButton />
        <SpeedSelector />
      </div>
      <ScrubBar />
    </div>
  );
}
