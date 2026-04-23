import { useEffect } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { usePlaybackStore } from "@/store/playback";

/** Whenever the selected pass changes, reset the playback cursor to that
 *  pass's rise time (and pause). When selection clears, clear the cursor.
 *
 *  Mount once at app level (e.g. inside <App />). */
export function useCursorReset(): void {
  const { data } = useCurrentPasses();
  const selectedId = useSelectionStore((s) => s.selectedPassId);

  useEffect(() => {
    if (!selectedId) {
      usePlaybackStore.setState({ cursorUtc: null, isPlaying: false });
      return;
    }
    if (!data) return;
    const pass = data.passes.find((p) => p.id === selectedId);
    if (!pass) return;
    usePlaybackStore.setState({
      cursorUtc: pass.rise.time,
      isPlaying: false,
    });
  }, [selectedId, data]);
}
