import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

describe("CommandPalette", () => {
  beforeEach(() => {
    useUIStore.setState({
      commandPaletteOpen: true,
      sidebarCollapsed: true,
      inspectorOpen: false,
      graphSurface: "pipeline",
      soundMuted: false,
    });
    useSessionStore.setState({
      activeModel: "gpt-4o",
      runMode: "deep_research",
      messages: [],
    });
  });

  it("renders when commandPaletteOpen is true", () => {
    render(<CommandPalette />);

    expect(screen.getByPlaceholderText(/Search commands/i)).toBeInTheDocument();
    expect(screen.getByText("Actions & Navigation")).toBeInTheDocument();
    expect(screen.getByText("Research Modes")).toBeInTheDocument();
    expect(screen.getByText("AI Models")).toBeInTheDocument();
  });

  it("triggers new inquiry and closes palette on selection", () => {
    const newChatMock = vi.fn().mockResolvedValue(undefined);
    useConversationStore.setState({ newChat: newChatMock });

    render(<CommandPalette />);

    const newInquiryItem = screen.getByText("New Research Inquiry");
    fireEvent.click(newInquiryItem);

    expect(newChatMock).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggles history sidebar", () => {
    render(<CommandPalette />);

    const toggleSidebarItem = screen.getByText("Toggle History Sidebar");
    fireEvent.click(toggleSidebarItem);

    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("switches AI model when selected", () => {
    render(<CommandPalette />);

    const claudeItem = screen.getByText("Claude 3.5 Sonnet");
    fireEvent.click(claudeItem);

    expect(useSessionStore.getState().activeModel).toBe("claude-3-5-sonnet");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("switches research mode", () => {
    render(<CommandPalette />);

    const auditItem = screen.getByText("Epistemic Audit");
    fireEvent.click(auditItem);

    expect(useSessionStore.getState().runMode).toBe("epistemic_audit");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});
