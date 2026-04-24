import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSatelliteStore } from "@/store/satellite";
import { SatelliteSearchBody } from "./satellite-search-body";

export function SatelliteSearch() {
  const [open, setOpen] = useState(false);
  const query = useSatelliteStore((s) => s.query);

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
          <SatelliteSearchBody onSelect={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
