import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ResearchLayout } from "./research-layout";
import { renderWithProviders } from "@/test/render";

// Stub heavy children to keep the test focused on composition.
vi.mock("@/components/sky-view/sky-view", () => ({
  SkyView: () => <div data-testid="sky-stub">SkyView</div>,
}));
vi.mock("@/components/observer/observer-panel", () => ({
  ObserverPanel: () => <div data-testid="observer-panel-stub">obs</div>,
}));
vi.mock("@/components/passes/pass-list", () => ({
  PassList: () => <div data-testid="pass-list-stub">passes</div>,
}));

describe("ResearchLayout", () => {
  it("renders app title, chrome, observer panel, pass list, sky view", () => {
    renderWithProviders(<ResearchLayout />);
    expect(screen.getByText(/Orbit Observer/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cinematic|Research/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("observer-panel-stub")).toBeInTheDocument();
    expect(screen.getByTestId("pass-list-stub")).toBeInTheDocument();
    expect(screen.getByTestId("sky-stub")).toBeInTheDocument();
    // Verify no earth-view stub is mounted in research mode
    expect(screen.queryByTestId("earth-stub")).toBeNull();
  });
});
