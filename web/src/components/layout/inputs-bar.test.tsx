import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { InputsBar } from "@/components/layout/inputs-bar";

describe("InputsBar", () => {
  it("composes satellite + time-range pickers under a Query card", () => {
    renderWithProviders(<InputsBar />);
    expect(screen.getByText("Query")).toBeInTheDocument();
    // SatelliteSearch renders a Label text (no htmlFor — it labels a combobox button)
    expect(screen.getByText(/satellite/i)).toBeInTheDocument();
    // TimeRangePicker inputs are associated via htmlFor
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });
});
