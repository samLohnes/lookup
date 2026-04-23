import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { useTimeRangeStore } from "@/store/time-range";

beforeEach(() => {
  useTimeRangeStore.setState({
    fromUtc: "2026-05-01T00:00:00Z",
    toUtc: "2026-05-02T00:00:00Z",
    mode: "line-of-sight",
  });
});

describe("TimeRangePicker", () => {
  it("renders both datetime-local inputs", () => {
    renderWithProviders(<TimeRangePicker />);
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });

  it("preset button updates the time-range store to the preset window", async () => {
    renderWithProviders(<TimeRangePicker />);
    await userEvent.click(screen.getByRole("button", { name: /next 7 d/i }));
    const { fromUtc, toUtc } = useTimeRangeStore.getState();
    const span = new Date(toUtc).getTime() - new Date(fromUtc).getTime();
    expect(span).toBeGreaterThan(168 * 3600 * 1000 - 5000);
    expect(span).toBeLessThan(168 * 3600 * 1000 + 5000);
  });

  it("mode toggle switches the store", async () => {
    renderWithProviders(<TimeRangePicker />);
    await userEvent.click(screen.getByRole("button", { name: /naked-eye/i }));
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
  });
});
