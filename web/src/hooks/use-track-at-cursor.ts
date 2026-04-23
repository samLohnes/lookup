import { useMemo } from "react";
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { usePlaybackStore } from "@/store/playback";
import { interpolateAtCursor } from "@/lib/interpolate";
import type { TrackSampleResponse } from "@/types/api";

export interface TrackAtCursor {
  sample: TrackSampleResponse | null;
  isLoading: boolean;
}

/** Returns the interpolated sky-track sample at the current playback cursor. */
export function useTrackAtCursor(): TrackAtCursor {
  const cursor = usePlaybackStore((s) => s.cursorUtc);
  const { data, isFetching } = useCurrentSkyTrack();

  const sample = useMemo(() => {
    if (!cursor || !data) return null;
    return interpolateAtCursor(data.samples, cursor);
  }, [cursor, data]);

  return { sample, isLoading: isFetching && !data };
}
