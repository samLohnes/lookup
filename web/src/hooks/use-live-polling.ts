import { useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { usePageVisibility } from "@/hooks/use-page-visibility";
import { useLivePositionStore } from "@/store/live-position";
import { useObserverStore } from "@/store/observer";
import { useSelectionStore } from "@/store/selection";
import type { PassItem } from "@/types/api";

const POLL_INTERVAL_MS = 5000;
const TAIL_MINUTES = 10;
const TAIL_DT_SECONDS = 30;

function noradsFromPasses(passes: PassItem[] | undefined): number[] {
  if (!passes || passes.length === 0) return [];
  const ids = new Set<number>();
  for (const p of passes) {
    if (p.kind === "train") {
      for (const n of p.member_norad_ids) ids.add(n);
    } else {
      ids.add(p.norad_id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Drives the live-position store while live mode is active.
 *
 * Mounts at the cinematic root. Returns nothing — purely side-effectful.
 * Live mode is ON when:
 *   - the current passes query has resolved with at least one pass, AND
 *   - no pass is selected, AND
 *   - the browser tab is visible.
 *
 * On entry, fires one `/now-tracks` seed call to backfill ~10 min of
 * trail samples per sat. Then polls `/now-positions` every 5 s.
 * On exit, clears all live-position state.
 */
export function useLivePolling(): void {
  const { data } = useCurrentPasses();
  const passes = data?.passes;
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const observer = useObserverStore((s) => s.current);
  const tabVisible = usePageVisibility();

  const setActive = useLivePositionStore((s) => s.setActive);
  const seedTrails = useLivePositionStore((s) => s.seedTrails);
  const applyPoll = useLivePositionStore((s) => s.applyPoll);
  const clear = useLivePositionStore((s) => s.clear);

  const norads = useMemo(() => noradsFromPasses(passes), [passes]);
  const noradsKey = norads.join(",");

  const liveModeOn = norads.length > 0 && selectedPassId === null && tabVisible;

  useEffect(() => {
    if (!liveModeOn) {
      clear();
      return;
    }

    const abort = new AbortController();
    setActive(norads);

    const observerBody = {
      lat: observer.lat,
      lng: observer.lng,
      elevation_m: observer.elevation_m,
    };

    api
      .nowTracks(
        { ...observerBody, norad_ids: norads, tail_minutes: TAIL_MINUTES, dt_seconds: TAIL_DT_SECONDS },
        abort.signal,
      )
      .then((res) => seedTrails(res.entries))
      .catch((e: unknown) => {
        const err = e as { name?: string };
        if (err?.name !== "AbortError") console.error("nowTracks failed", e);
      });

    const tick = async () => {
      try {
        const res = await api.nowPositions(
          { ...observerBody, norad_ids: norads },
          abort.signal,
        );
        applyPoll(res.entries, performance.now());
      } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name !== "AbortError") console.error("nowPositions failed", e);
      }
    };

    const id = setInterval(tick, POLL_INTERVAL_MS);
    void tick();

    return () => {
      abort.abort();
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liveModeOn,
    noradsKey,
    observer.lat,
    observer.lng,
    observer.elevation_m,
  ]);
}
