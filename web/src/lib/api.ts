import type {
  CatalogHitResponse,
  GeoTimezoneResponse,
  HorizonResponse,
  PassesRequest,
  PassesResponseBody,
  SkyTrackRequest,
  SkyTrackResponseBody,
  TLEFreshnessResponse,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`${status}: ${detail}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // ignore — keep statusText
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  catalogSearch: (q: string, limit = 10) =>
    request<CatalogHitResponse[]>(
      `/catalog/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  passes: (body: PassesRequest) =>
    request<PassesResponseBody>("/passes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  skyTrack: (body: SkyTrackRequest) =>
    request<SkyTrackResponseBody>("/sky-track", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  horizon: (lat: number, lng: number, elevation_m = 0) =>
    request<HorizonResponse>(
      `/horizon?lat=${lat}&lng=${lng}&elevation_m=${elevation_m}`,
    ),

  tleFreshness: (query: string) =>
    request<TLEFreshnessResponse[]>(
      `/tle-freshness?query=${encodeURIComponent(query)}`,
    ),

  geoTimezone: (lat: number, lng: number) =>
    request<GeoTimezoneResponse>(
      `/geo/timezone?lat=${lat}&lng=${lng}`,
    ),
};
