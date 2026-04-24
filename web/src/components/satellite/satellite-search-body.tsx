import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useCatalogSearch } from "@/hooks/use-catalog-search";

interface SatelliteSearchBodyProps {
  /** Called after a selection is made. Parent can close its popover here. */
  onSelect?: (query: string) => void;
  /** Attach this to a wrapping element if you need to focus the input from outside. */
  inputRef?: React.Ref<HTMLInputElement>;
}

/** The Command-based satellite search UI with no outer Popover wrapper.
 *  Reused by the research-mode `SatelliteSearch` (inside its own popover)
 *  and by the cinematic-mode Satellite chip popover (no nesting needed). */
export function SatelliteSearchBody({ onSelect, inputRef }: SatelliteSearchBodyProps) {
  const [input, setInput] = useState("");
  const setDraftSatellite = useDraftInputsStore((s) => s.setDraftSatellite);
  const { data: hits, isFetching } = useCatalogSearch(input);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        ref={inputRef}
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
                  setDraftSatellite({ query: hit.display_name });
                  onSelect?.(hit.display_name);
                }}
              >
                <span className="flex-1">{hit.display_name}</span>
                <span className="text-xs text-fg-muted">{hit.match_type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
