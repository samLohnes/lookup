import { useEffect, useRef } from "react";
import L from "leaflet";
import { useObserverStore } from "@/store/observer";

// NOTE: not unit-tested — Leaflet's DOM coupling makes RTL testing brittle.
// Verified by manual smoke + the integration with the observer store
// (covered by store tests). Revisit if M4 changes the lifecycle.

// Default Leaflet marker icons don't bundle through Vite — use CDN URLs.
const MARKER_ICON = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function MapPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const current = useObserverStore((s) => s.current);
  const setCurrent = useObserverStore((s) => s.setCurrent);

  // Mount once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [current.lat, current.lng],
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark tile layer keeps the Cosmic Editorial vibe.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    const marker = L.marker([current.lat, current.lng], {
      draggable: true,
      icon: MARKER_ICON,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setCurrent({ lat: e.latlng.lat, lng: e.latlng.lng, name: "Map pick" });
    });

    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      setCurrent({ lat: ll.lat, lng: ll.lng, name: "Map pick" });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + view when the store changes externally (saved loc, geocode).
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const ll = L.latLng(current.lat, current.lng);
    marker.setLatLng(ll);
    map.setView(ll, map.getZoom(), { animate: true });
  }, [current.lat, current.lng]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-card overflow-hidden border border-edge"
      role="region"
      aria-label="Map picker"
    />
  );
}
