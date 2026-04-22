import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSatelliteStore } from "@/store/satellite";
import { useCatalogSearch } from "@/hooks/use-catalog-search";

export function SatelliteSearch() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const query = useSatelliteStore((s) => s.query);
  const setQuery = useSatelliteStore((s) => s.setQuery);
  const { data: hits, isFetching } = useCatalogSearch(input);

  return (
    <div className="space-y-2">
      <Label>Satellite</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {query || "Pick a satellite or group"}
            <span className="opacity-50">▾</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="ISS, starlink, 25544…"
              value={input}
              onValueChange={setInput}
            />
            <CommandList>
              {!isFetching && (!hits || hits.length === 0) && (
                <CommandEmpty>No matches.</CommandEmpty>
              )}
              {hits && hits.length > 0 && (
                <CommandGroup>
                  {hits.map((hit) => (
                    <CommandItem
                      key={`${hit.match_type}-${hit.display_name}`}
                      value={hit.display_name}
                      onSelect={() => {
                        setQuery(hit.display_name);
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1">{hit.display_name}</span>
                      <span className="text-xs text-fg-muted">
                        {hit.match_type}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
