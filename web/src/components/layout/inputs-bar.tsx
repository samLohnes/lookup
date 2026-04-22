import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SatelliteSearch } from "@/components/satellite/satellite-search";
import { TimeRangePicker } from "@/components/time/time-range-picker";

export function InputsBar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Query</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SatelliteSearch />
        <TimeRangePicker />
      </CardContent>
    </Card>
  );
}
