import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useObserverStore } from "@/store/observer";

export function SavedLocations() {
  const { current, saved, addSaved, removeSaved, applySaved } = useObserverStore();
  const [name, setName] = useState("");

  return (
    <div className="space-y-3">
      <Label>Saved locations</Label>
      {saved.length === 0 && (
        <p className="text-xs text-fg-muted">
          Save the current location below to quickly return to it later.
        </p>
      )}
      <ul className="space-y-1">
        {saved.map((loc) => (
          <li key={loc.id} className="flex items-center justify-between gap-2">
            <button
              onClick={() => applySaved(loc.id)}
              className="flex-1 text-left text-sm px-2 py-1 rounded hover:bg-edge"
              title={`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}
            >
              {loc.name}
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`remove ${loc.name}`}
              onClick={() => removeSaved(loc.id)}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          placeholder="Save current as…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={!name.trim()}
          onClick={() => {
            addSaved({
              name: name.trim(),
              lat: current.lat,
              lng: current.lng,
              elevation_m: current.elevation_m,
            });
            setName("");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
