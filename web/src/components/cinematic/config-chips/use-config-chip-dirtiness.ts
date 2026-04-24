import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";

export interface ConfigChipDirtiness {
  observer: boolean;
  satellite: boolean;
  window: boolean;
  any: boolean;
}

/** Per-chip dirtiness + any-dirty, derived from draft vs committed state.
 *  Subscribes to all four stores (draft-inputs + the three committed stores)
 *  so the result re-evaluates whenever either side changes. A Zustand
 *  selector only re-runs on changes to its OWN store — without these
 *  explicit subscriptions, committing a draft (which writes to the committed
 *  stores but not draft-inputs) would leave the chip showing a stale dirty
 *  indicator until another draft-inputs change forced a re-render. */
export function useConfigChipDirtiness(): ConfigChipDirtiness {
  const draft = useDraftInputsStore((s) => s.draft);
  const committedObserver = useObserverStore((s) => s.current);
  const committedSatelliteQuery = useSatelliteStore((s) => s.query);
  const committedFromUtc = useTimeRangeStore((s) => s.fromUtc);
  const committedToUtc = useTimeRangeStore((s) => s.toUtc);

  const observer =
    draft.observer.lat !== committedObserver.lat ||
    draft.observer.lng !== committedObserver.lng ||
    draft.observer.elevation_m !== committedObserver.elevation_m ||
    draft.observer.name !== committedObserver.name;
  const satellite = draft.satellite.query !== committedSatelliteQuery;
  const windowDirty =
    draft.window.fromUtc !== committedFromUtc ||
    draft.window.toUtc !== committedToUtc;

  return {
    observer,
    satellite,
    window: windowDirty,
    any: observer || satellite || windowDirty,
  };
}
