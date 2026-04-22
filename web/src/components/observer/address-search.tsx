import { useEffect, useState } from "react";
import { useGeocode } from "@/hooks/use-geocode";
import { useObserverStore } from "@/store/observer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Tiny debounce helper (not worth a library).
function useDebouncedEffect(fn: () => void, delay: number, deps: unknown[]) {
  useEffect(() => {
    const h = setTimeout(fn, delay);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function AddressSearch() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const setCurrent = useObserverStore((s) => s.setCurrent);
  const { data, isFetching } = useGeocode(debounced);

  // Debounce typing.
  useDebouncedEffect(() => setDebounced(input), 350, [input]);

  return (
    <div className="space-y-2">
      <Label htmlFor="address">Address</Label>
      <Input
        id="address"
        placeholder="Brooklyn, NY"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {input && data && data.length > 0 && (
        <ul className="surface divide-y divide-edge max-h-56 overflow-y-auto">
          {data.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-edge"
                onClick={() => {
                  setCurrent({
                    lat: hit.lat,
                    lng: hit.lng,
                    name: hit.display_name.split(",").slice(0, 2).join(",").trim(),
                  });
                  setInput(hit.display_name);
                }}
              >
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isFetching && <p className="text-xs text-fg-muted">Searching…</p>}
    </div>
  );
}
