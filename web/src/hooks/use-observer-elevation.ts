import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Returns the DEM-sampled terrain elevation (m above sea level) at the
 *  given lat/lng. Cached aggressively: a point's terrain elevation never
 *  changes for the lifetime of the app, so `staleTime: Infinity` avoids
 *  ever re-fetching the same coordinate.
 *
 *  Used by the observer panel to auto-populate `observer.elevation_m`
 *  when the user moves the draft observer to a new location. Pass the
 *  draft lat/lng (NOT the committed observer's) so the lookup fires
 *  before the user clicks Run — otherwise mountain locations would only
 *  see passes after a redundant second Run.
 */
export function useObserverElevation(lat: number, lng: number) {
  return useQuery({
    queryKey: ["observer-elevation", lat, lng],
    queryFn: () => api.geoElevation(lat, lng),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    // DEM failures are usually structural (bad coords near a pole, missing
    // API key, upstream down). A retry rarely helps and wastes the user's
    // time waiting for the elevation field to update.
    retry: false,
  });
}
