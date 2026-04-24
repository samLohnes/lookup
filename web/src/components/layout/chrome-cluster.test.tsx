import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ChromeCluster } from "./chrome-cluster";
import { renderWithProviders } from "@/test/render";
import { useAppModeStore } from "@/store/app-mode";

describe("ChromeCluster", () => {
  beforeEach(() => {
    useAppModeStore.setState({ mode: "cinematic" });
  });

  it("renders mode + tz pills", () => {
    renderWithProviders(<ChromeCluster />);
    expect(screen.getAllByText(/Cinematic|Research/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/(Client|Observer|UTC)/i).length).toBeGreaterThan(0);
  });

  it("Cmd-M toggles between cinematic and research", () => {
    renderWithProviders(<ChromeCluster />);
    fireEvent.keyDown(window, { key: "m", metaKey: true });
    expect(useAppModeStore.getState().mode).toBe("research");
    fireEvent.keyDown(window, { key: "m", metaKey: true });
    expect(useAppModeStore.getState().mode).toBe("cinematic");
  });

  it("Ctrl-M works too (non-Mac users)", () => {
    renderWithProviders(<ChromeCluster />);
    fireEvent.keyDown(window, { key: "m", ctrlKey: true });
    expect(useAppModeStore.getState().mode).toBe("research");
  });

  it("ignores shortcuts when target is an input", () => {
    renderWithProviders(
      <>
        <input data-testid="input" />
        <ChromeCluster />
      </>,
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "m", metaKey: true });
    expect(useAppModeStore.getState().mode).toBe("cinematic");
  });
});
