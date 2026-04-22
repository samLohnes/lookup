import { useQuery } from "@tanstack/react-query";

export interface GeocodeHit {
  display_name: string;
  lat: number;
  lng: number;
}

async function nominatim(q: string): Promise<GeocodeHit[]> {
  if (!q.trim()) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  const response = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const body = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return body.map((hit) => ({
    display_name: hit.display_name,
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
  }));
}

export function useGeocode(q: string) {
  return useQuery({
    queryKey: ["geocode", q],
    queryFn: () => nominatim(q),
    enabled: q.trim().length >= 3,
    staleTime: 5 * 60_000,
  });
}
