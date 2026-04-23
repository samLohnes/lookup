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
});
