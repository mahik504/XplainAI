import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HistorySidebar } from "./HistorySidebar";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

describe("HistorySidebar", () => {
  const mockConversations = [
    {
      id: "conv_1",
      title: "Topological Quantum Order",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 4,
    },
    {
      id: "conv_2",
      title: "Fluxonium Resonator Coherence",
      created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 86400 * 1000).toISOString(),
      message_count: 2,
    },
  ];

  beforeEach(() => {
    useConversationStore.setState({
      conversations: mockConversations,
      activeConversationId: "conv_1",
      loading: false,
      error: null,
      hydrate: vi.fn().mockResolvedValue(undefined),
      newChat: vi.fn().mockResolvedValue(undefined),
      openConversation: vi.fn().mockResolvedValue(undefined),
      removeConversation: vi.fn().mockResolvedValue(undefined),
      clearAllConversations: vi.fn().mockResolvedValue(undefined),
    });

    useSessionStore.setState({
      messages: [],
      activeModel: "gpt-4o",
      runMode: "deep_research",
    });

    useUIStore.setState({
      sidebarCollapsed: false,
      saveHistoryEnabled: true,
    });
  });

  it("renders conversation items and groups", () => {
    render(<HistorySidebar />);

    expect(screen.getByText("Topological Quantum Order")).toBeInTheDocument();
    expect(screen.getByText("Fluxonium Resonator Coherence")).toBeInTheDocument();
    expect(screen.getByText("New inquiry")).toBeInTheDocument();
  });

  it("opens accessible Radix Dialog when deleting a conversation", async () => {
    const removeConversationMock = vi.fn().mockResolvedValue(undefined);
    useConversationStore.setState({ removeConversation: removeConversationMock });

    render(<HistorySidebar />);

    const deleteBtn = screen.getByLabelText("Delete Topological Quantum Order");
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete Inquiry Session?")).toBeInTheDocument();
    expect(screen.getByText(/Permanently remove/)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /Delete Session/i });
    fireEvent.click(confirmDeleteBtn);

    expect(removeConversationMock).toHaveBeenCalledWith("conv_1");
  });

  it("opens accessible Radix Dialog when clearing all history", () => {
    const clearAllMock = vi.fn().mockResolvedValue(undefined);
    useConversationStore.setState({ clearAllConversations: clearAllMock });

    render(<HistorySidebar />);

    const clearAllBtn = screen.getByLabelText("Clear all research history");
    fireEvent.click(clearAllBtn);

    expect(screen.getByText("Clear All Research History?")).toBeInTheDocument();

    const confirmClearBtn = screen.getByRole("button", { name: /Clear All Sessions/i });
    fireEvent.click(confirmClearBtn);

    expect(clearAllMock).toHaveBeenCalledTimes(1);
  });

  it("opens accessible Radix Dialog for session export with Markdown and JSON choices", () => {
    render(<HistorySidebar />);

    const exportBtn = screen.getByLabelText("Export Topological Quantum Order");
    fireEvent.click(exportBtn);

    expect(screen.getByText("Export Research Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Markdown Report")).toBeInTheDocument();
    expect(screen.getByText("JSON Data")).toBeInTheDocument();
  });

  it("toggles archive tab and moves item between active and archived", async () => {
    render(<HistorySidebar />);

    const archiveBtn = screen.getByLabelText("Archive Topological Quantum Order");
    fireEvent.click(archiveBtn);

    const archivedTab = screen.getByRole("button", { name: /Archived/i });
    fireEvent.click(archivedTab);

    await waitFor(() => {
      expect(screen.getByText("Topological Quantum Order")).toBeInTheDocument();
    });
  });
});
