import { AddressSearch } from "@/components/observer/address-search";
import { ElevationField } from "@/components/observer/elevation-field";
import { MapPicker } from "@/components/observer/map-picker";
import { SavedLocations } from "@/components/observer/saved-locations";
import { TzWarning } from "@/components/observer/tz-warning";
import { Card, CardContent } from "@/components/ui/card";
import { useObserverStore } from "@/store/observer";

export function ObserverPanel() {
  const current = useObserverStore((s) => s.current);

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="text-xs text-fg-muted">
          {current.name} · {current.lat.toFixed(4)}°, {current.lng.toFixed(4)}°
        </p>
        <TzWarning />
        <AddressSearch />
        <MapPicker />
        <SavedLocations />
        <ElevationField />
      </CardContent>
    </Card>
  );
}
