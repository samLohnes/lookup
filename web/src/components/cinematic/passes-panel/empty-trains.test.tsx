import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyTrains } from "./empty-trains";

describe("EmptyTrains", () => {
  it("renders the title", () => {
    render(<EmptyTrains />);
    expect(screen.getByText("No active Starlink trains")).toBeInTheDocument();
  });

  it("renders the explanatory subtitle", () => {
    render(<EmptyTrains />);
    expect(
      screen.getByText(/Trains form within the first ~30 days/i),
    ).toBeInTheDocument();
  });

  it("does not render any interactive controls (no CTA, no fallback button)", () => {
    render(<EmptyTrains />);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});
