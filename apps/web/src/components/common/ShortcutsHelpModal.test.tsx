import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ShortcutsHelpModal } from "./ShortcutsHelpModal";
import { useUIStore } from "@/stores/ui-store";

describe("ShortcutsHelpModal", () => {
  beforeEach(() => {
    useUIStore.setState({ shortcutsModalOpen: false });
  });

  it("does not render when shortcutsModalOpen is false", () => {
    render(<ShortcutsHelpModal />);
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("renders modal with cheat sheet sections and keys when open", () => {
    useUIStore.setState({ shortcutsModalOpen: true });

    render(<ShortcutsHelpModal />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Navigation & Menus")).toBeInTheDocument();
    expect(screen.getByText("Views & Visualizers")).toBeInTheDocument();
    expect(screen.getByText("System & Audio")).toBeInTheDocument();

    expect(screen.getByText("Open Command Palette")).toBeInTheDocument();
    expect(screen.getByText("Toggle History Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Toggle Explainability Cockpit")).toBeInTheDocument();
    expect(screen.getByText("Toggle Pipeline ↔ Topology Graph")).toBeInTheDocument();
    expect(screen.getByText("Toggle procedural audio SFX")).toBeInTheDocument();
  });
});
