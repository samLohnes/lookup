import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@/store/playback";
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";

/** Drives the playback cursor via requestAnimationFrame.
 *
 *  Mount once at app level. Self-pauses when the cursor reaches the end
 *  of the cached /sky-track samples (i.e. the selected pass's set time).
 *
 *  The loop is decoupled from React render frequency by reading
 *  store state inside the rAF callback — Zustand's getState() is
 *  synchronous and free of subscriptions, which is what we want here.
 */
export function usePlaybackLoop(): void {
  const { data } = useCurrentSkyTrack();
  const lastTickRef = useRef<number | null>(null);

  // Subscribe to isPlaying so we can start/stop the loop on changes.
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying || !data || data.samples.length === 0) {
      lastTickRef.current = null;
      return;
    }

    const lastSampleMs = Date.parse(data.samples[data.samples.length - 1].time);
    let raf = 0;

    const tick = (now: number) => {
      const last = lastTickRef.current;
      lastTickRef.current = now;
      if (last !== null) {
        const deltaMs = now - last;
        const { cursorUtc, speedMultiplier } = usePlaybackStore.getState();
        if (cursorUtc) {
          const advanced = Date.parse(cursorUtc) + deltaMs * speedMultiplier;
          if (advanced >= lastSampleMs) {
            usePlaybackStore.setState({
              cursorUtc: new Date(lastSampleMs).toISOString(),
              isPlaying: false,
            });
            return; // stop the loop
          }
          usePlaybackStore.setState({
            cursorUtc: new Date(advanced).toISOString(),
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTickRef.current = null;
    };
  }, [isPlaying, data]);
}
