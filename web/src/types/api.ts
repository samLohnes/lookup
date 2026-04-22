// Mirror of api/schemas/responses.py and api/schemas/requests.py.
// Keep in sync manually for now; a v2 improvement is to generate these
// from the FastAPI OpenAPI schema.

export type VisibilityMode = "line-of-sight" | "naked-eye";

export interface PassEndpointResponse {
  time: string; // ISO-8601 UTC
  azimuth_deg: number;
  elevation_deg: number;
}

export interface PassResponse {
  kind: "single";
  id: string;
  norad_id: number;
  name: string;
  rise: PassEndpointResponse;
  peak: PassEndpointResponse;
  set: PassEndpointResponse;
  duration_s: number;
  max_magnitude: number | null;
  sunlit_fraction: number;
  tle_epoch: string;
}

export interface TrainPassResponse {
  kind: "train";
  id: string;
  name: string;
  member_norad_ids: number[];
  rise: PassEndpointResponse;
  peak: PassEndpointResponse;
  set: PassEndpointResponse;
  duration_s: number;
  max_magnitude: number | null;
  member_count: number;
}

export type PassItem = PassResponse | TrainPassResponse;

export interface TrackSampleResponse {
  time: string;
  lat: number;
  lng: number;
  alt_km: number;
  az: number;
  el: number;
  range_km: number;
  velocity_km_s: number;
  magnitude: number | null;
  sunlit: boolean;
  observer_dark: boolean;
}

export interface TLEFreshnessResponse {
  norad_id: number;
  name: string;
  tle_epoch: string;
  fetched_age_seconds: number;
}

export interface HorizonResponse {
  lat: number;
  lng: number;
  radius_km: number;
  samples_deg: number[]; // 360 values, index = azimuth deg
}

export interface CatalogHitResponse {
  display_name: string;
  match_type: "satellite" | "group";
  norad_ids: number[];
  score: number;
}

// Request bodies
export interface PassesRequest {
  lat: number;
  lng: number;
  elevation_m: number;
  query: string;
  from_utc: string;
  to_utc: string;
  mode: VisibilityMode;
  min_magnitude?: number | null;
  min_peak_elevation_deg?: number | null;
  apply_group_defaults?: boolean;
}

export interface SkyTrackRequest {
  lat: number;
  lng: number;
  elevation_m: number;
  query: string;
  from_utc: string;
  to_utc: string;
  dt_seconds: number;
}

export interface PassesResponseBody {
  query: string;
  resolved_name: string;
  passes: PassItem[];
  tle_age_seconds: number | null;
}

export interface SkyTrackResponseBody {
  resolved_name: string;
  samples: TrackSampleResponse[];
}
