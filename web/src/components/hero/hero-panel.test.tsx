import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroPanel } from "./hero-panel";

vi.mock("@/components/sky-view/sky-view", () => ({
  SkyView: () => <div data-testid="sky-stub">SkyView</div>,
}));

describe("HeroPanel", () => {
  it("renders SkyView permanently (no toggle)", () => {
    render(<HeroPanel />);
    expect(screen.getByText("Sky view")).toBeInTheDocument();
    expect(screen.getByTestId("sky-stub")).toBeInTheDocument();
    expect(screen.queryByTestId("earth-stub")).toBeNull();
    expect(screen.queryByRole("button", { name: /Earth|Sky/i })).toBeNull();
  });
});
