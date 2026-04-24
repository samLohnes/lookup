import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { PipSkyView } from "./pip-sky-view";
import { renderWithProviders } from "@/test/render";
import { usePipSkyStore } from "@/store/pip-sky";
import { useSelectionStore } from "@/store/selection";

vi.mock("@/components/sky-view/sky-view", () => ({
  SkyView: () => <div data-testid="sky-stub">SkyView</div>,
}));

describe("PipSkyView", () => {
  beforeEach(() => {
    usePipSkyStore.setState({
      isOpen: false,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 300 },
    });
    useSelectionStore.setState({ selectedPassId: null });
  });

  it("is aria-hidden + pointer-events-none when closed", () => {
    const { container } = renderWithProviders(<PipSkyView />);
    const pip = container.firstChild as HTMLElement;
    expect(pip).toBeTruthy();
    expect(pip.getAttribute("aria-hidden")).toBe("true");
    expect(pip.style.pointerEvents).toBe("none");
    expect(pip.style.opacity).toBe("0");
  });

  it("auto-opens when a pass is selected", () => {
    renderWithProviders(<PipSkyView />);
    act(() => {
      useSelectionStore.setState({ selectedPassId: "1" });
    });
    expect(usePipSkyStore.getState().isOpen).toBe(true);
  });

  it("close button calls close() and flips aria-hidden", async () => {
    usePipSkyStore.getState().open();
    const { container } = renderWithProviders(<PipSkyView />);
    fireEvent.click(await screen.findByRole("button", { name: /close/i }));
    expect(usePipSkyStore.getState().isOpen).toBe(false);
    const pip = container.firstChild as HTMLElement;
    expect(pip.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders SkyView inside when open", () => {
    usePipSkyStore.getState().open();
    renderWithProviders(<PipSkyView />);
    expect(screen.getByTestId("sky-stub")).toBeInTheDocument();
  });
});
