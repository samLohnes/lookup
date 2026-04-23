import { Button } from "@/components/ui/button";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

export function PlayButton() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const toggle = usePlaybackStore((s) => s.toggle);
  const selected = useSelectionStore((s) => s.selectedPassId);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!selected}
      onClick={toggle}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? "❚❚ Pause" : "▶ Play"}
    </Button>
  );
}
