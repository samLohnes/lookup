import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeToggle } from "./mode-toggle";
import { useAppModeStore } from "@/store/app-mode";

describe("ModeToggle", () => {
  beforeEach(() => {
    useAppModeStore.setState({ mode: "cinematic" });
  });

  it("renders current mode label on the trigger", () => {
    render(<ModeToggle />);
    expect(screen.getByRole("button", { name: /Cinematic/i })).toBeInTheDocument();
  });

  it("clicking the trigger reveals the other option, which switches the store", async () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /Cinematic/i }));
    // After opening the popover, the "Research" choice should be findable
    const researchItem = await screen.findByRole("button", { name: /Research/i });
    fireEvent.click(researchItem);
    expect(useAppModeStore.getState().mode).toBe("research");
  });

  it("is disabled when viewport is narrow (< 900px)", () => {
    // Set jsdom viewport narrow before render.
    Object.defineProperty(window, "innerWidth", {
      value: 500,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));
    render(<ModeToggle />);
    const trigger = screen.getByRole("button", { name: /Cinematic/i });
    expect(trigger).toBeDisabled();
    expect(trigger.getAttribute("title")).toMatch(/desktop-only/i);
    // Restore to wide for subsequent tests.
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));
  });
});
