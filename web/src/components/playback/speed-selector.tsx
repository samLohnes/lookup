import { Button } from "@/components/ui/button";
import { usePlaybackStore, type SpeedMultiplier } from "@/store/playback";

const SPEEDS: SpeedMultiplier[] = [1, 10, 60];

export function SpeedSelector() {
  const speed = usePlaybackStore((s) => s.speedMultiplier);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  return (
    <div className="flex gap-1" role="group" aria-label="Playback speed">
      {SPEEDS.map((s) => (
        <Button
          key={s}
          variant={s === speed ? "default" : "outline"}
          size="sm"
          onClick={() => setSpeed(s)}
        >
          {s}×
        </Button>
      ))}
    </div>
  );
}
