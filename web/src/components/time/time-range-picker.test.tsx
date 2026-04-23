import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { useTimeRangeStore } from "@/store/time-range";
import { useDraftInputsStore } from "@/store/draft-inputs";

beforeEach(() => {
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-02T00:00:00Z",
    mode: "line-of-sight",
  });
  useDraftInputsStore.getState().initFromCommitted();
});

describe("TimeRangePicker", () => {
  it("renders both datetime-local inputs", () => {
    renderWithProviders(<TimeRangePicker />);
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });

  it("preset button updates the draft window to the preset range", async () => {
    renderWithProviders(<TimeRangePicker />);
    await userEvent.click(screen.getByRole("button", { name: /next 7 d/i }));
    // Writes land on the draft — committed store only moves on Run.
    const { fromUtc, toUtc } = useDraftInputsStore.getState().draft.window;
    const span = new Date(toUtc).getTime() - new Date(fromUtc).getTime();
    expect(span).toBeGreaterThan(168 * 3600 * 1000 - 5000);
    expect(span).toBeLessThan(168 * 3600 * 1000 + 5000);
  });

});
