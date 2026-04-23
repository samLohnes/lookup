import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useObserverStore } from "@/store/observer";
import { useDraftInputsStore } from "@/store/draft-inputs";

export function SavedLocations() {
  const { current, saved, addSaved, removeSaved } = useObserverStore();
  const setDraftObserver = useDraftInputsStore((s) => s.setDraftObserver);
  const [name, setName] = useState("");

  /** Apply a saved location to the draft observer (committed store moves on Run). */
  const applySavedToDraft = (id: string) => {
    const target = saved.find((l) => l.id === id);
    if (!target) return;
    setDraftObserver({
      lat: target.lat,
      lng: target.lng,
      elevation_m: target.elevation_m,
      name: target.name,
    });
  };

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
              onClick={() => applySavedToDraft(loc.id)}
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
