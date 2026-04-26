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
}

/** The Command-based satellite search UI with no outer Popover wrapper.
 *  Reused by the research-mode `SatelliteSearch` (inside its own popover)
 *  and by the cinematic-mode Satellite chip popover (no nesting needed).
 *
 *  The search-input state is local to this component, which lives inside the
 *  hosting popover's content. When the popover closes the component unmounts,
 *  so reopening it starts with an empty query — intentional command-palette UX. */
export function SatelliteSearchBody({ onSelect }: SatelliteSearchBodyProps) {
  const [input, setInput] = useState("");
  const setDraftSatellite = useDraftInputsStore((s) => s.setDraftSatellite);
  const { data: hits, isFetching } = useCatalogSearch(input);

  return (
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
                  setDraftSatellite({ query: hit.display_name });
                  onSelect?.(hit.display_name);
                }}
              >
                <span className="flex-1">{hit.display_name}</span>
                <span className="text-xs text-fg-muted">
                  {hit.match_type === "train_query" ? "trains" : hit.match_type}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
