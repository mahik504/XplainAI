import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useUIStore } from "@/stores/ui-store";

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    useUIStore.setState({
      commandPaletteOpen: false,
      shortcutsModalOpen: false,
      sidebarCollapsed: true,
      inspectorOpen: false,
      soundMuted: false,
      graphSurface: "pipeline",
      focusedAssertionId: null,
      settingsOpen: false,
    });
  });

  it("registers default shortcuts", () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(result.current.shortcuts.length).toBeGreaterThan(5);
    expect(result.current.shortcuts.some((s) => s.id === "command-palette")).toBe(true);
    expect(result.current.shortcuts.some((s) => s.id === "toggle-sidebar")).toBe(true);
  });

  it("triggers command palette on Ctrl+K", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useUIStore.getState().commandPaletteOpen).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
      );
    });

    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("triggers sidebar toggle on Ctrl+B", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useUIStore.getState().sidebarCollapsed).toBe(true);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true })
      );
    });

    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it("triggers inspector toggle on Ctrl+I", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useUIStore.getState().inspectorOpen).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "i", ctrlKey: true })
      );
    });

    expect(useUIStore.getState().inspectorOpen).toBe(true);
  });

  it("toggles graph surface on Ctrl+G", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useUIStore.getState().graphSurface).toBe("pipeline");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "g", ctrlKey: true })
      );
    });

    expect(useUIStore.getState().graphSurface).toBe("structure");
  });

  it("toggles shortcuts modal on ?", () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useUIStore.getState().shortcutsModalOpen).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", shiftKey: true })
      );
    });

    expect(useUIStore.getState().shortcutsModalOpen).toBe(true);
  });

  it("toggles audio SFX on Ctrl+Shift+M", () => {
    renderHook(() => useKeyboardShortcuts());

    const initialMuted = useUIStore.getState().soundMuted;

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "M", ctrlKey: true, shiftKey: true })
      );
    });

    expect(useUIStore.getState().soundMuted).toBe(!initialMuted);
  });

  it("handles Escape to close open modals and clear focus", () => {
    useUIStore.setState({
      commandPaletteOpen: true,
      focusedAssertionId: "assertion_1",
    });

    renderHook(() => useKeyboardShortcuts());

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape" })
      );
    });

    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("supports custom shortcuts and does not trigger non-input shortcuts when typing in input", () => {
    const customAction = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        {
          id: "custom",
          key: "p",
          description: "Custom Action",
          category: "Actions",
          allowInInput: false,
          action: customAction,
        },
      ])
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", { key: "p" });
    Object.defineProperty(event, "target", { value: input });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(customAction).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
