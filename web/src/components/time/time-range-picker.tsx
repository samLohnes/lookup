import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimeRangeStore, computePresetWindow } from "@/store/time-range";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { toLocalInput, fromLocalInput } from "@/lib/datetime";

export function TimeRangePicker() {
  const { fromUtc, toUtc } = useTimeRangeStore();
  const setDraftWindow = useDraftInputsStore((s) => s.setDraftWindow);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="from-utc">From (your time)</Label>
        <Input
          id="from-utc"
          type="datetime-local"
          value={toLocalInput(fromUtc)}
          onChange={(e) =>
            setDraftWindow({ fromUtc: fromLocalInput(e.target.value), toUtc })
          }
        />
      </div>
      <div>
        <Label htmlFor="to-utc">To (your time)</Label>
        <Input
          id="to-utc"
          type="datetime-local"
          value={toLocalInput(toUtc)}
          onChange={(e) =>
            setDraftWindow({ fromUtc, toUtc: fromLocalInput(e.target.value) })
          }
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraftWindow(computePresetWindow(24))}
        >
          Next 24 h
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraftWindow(computePresetWindow(72))}
        >
          Next 3 d
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraftWindow(computePresetWindow(168))}
        >
          Next 7 d
        </Button>
      </div>
    </div>
  );
}
