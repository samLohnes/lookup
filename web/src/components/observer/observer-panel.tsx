import { AddressSearch } from "@/components/observer/address-search";
import { MapPicker } from "@/components/observer/map-picker";
import { SavedLocations } from "@/components/observer/saved-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useObserverStore } from "@/store/observer";

export function ObserverPanel() {
  const current = useObserverStore((s) => s.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observer</CardTitle>
        <p className="text-xs text-fg-muted">
          {current.name} · {current.lat.toFixed(4)}°, {current.lng.toFixed(4)}°
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddressSearch />
        <MapPicker />
        <SavedLocations />
      </CardContent>
    </Card>
  );
}
