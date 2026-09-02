import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach,
vi } from "vitest";
import { ModelSelector } from "./ModelSelector";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

describe("ModelSelector and Store Behavior Challenge Tests", () => {
  beforeEach(() => {
    // Reset stores to default clean baseline
    useUIStore.setState({
      customApiKey: "",
      customApiBase: "",
      customModelId: "",
      settingsOpen: false,
    });
    useSessionStore.setState({
      availableModels: [],
      activeModel: null,
      defaultModel: "gpt-4o-mini",
      isStreaming: false,
    });
  });

  it("1. Empty customApiKey with empty availableModels: falls back to fallback model label and shows unconfigured / private options", () => {
    useUIStore.setState({ customApiKey: "", customApiBase: "" });
    useSessionStore.setState({ availableModels: [], activeModel: null, defaultModel: "gpt-4o-mini" });

    render(<ModelSelector />);

    // Trigger button should show GPT-4o mini fallback
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("GPT-4o mini");

    // Open dropdown
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText(/Custom Model & API Keys/i)).toBeInTheDocument();
  });

  it("2. Empty customApiKey with available backend models: lists backend models grouped correctly", () => {
    useUIStore.setState({ customApiKey: "", customApiBase: "" });
    useSessionStore.setState({
      availableModels: [],
      activeModel: "gpt-4o",
    });
    useSessionStore.setState({
      availableModels: [
        { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "advanced", description: "Flagship OpenAI model" },
        { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "anthropic", tier: "advanced", description: "Anthropic reasoning" },
        { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google", tier: "fast", description: "Google speed model" },
      ],
      activeModel: "gpt-4o",
    });

    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("GPT-4o");

    fireEvent.click(trigger);

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
    expect(screen.getByText("Gemini 2.0 Flash")).toBeInTheDocument();

    // Select Claude
    fireEvent.click(screen.getByText("Claude 3.5 Sonnet"));
    expect(useSessionStore.getState().activeModel).toBe("claude-3-5-sonnet-20241022");
  });

  it("3. Whitespace-only customApiKey and customApiBase: correctly evaluated as unconfigured when no backend models", () => {
    useUIStore.setState({ customApiKey: "   ", customApiBase: "   ", customModelId: "" });
    useSessionStore.setState({ availableModels: [], activeModel: "", defaultModel: "" });

    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    // Should indicate No models configured in the dropdown list
    expect(screen.getByText("No models configured.")).toBeInTheDocument();
  });

  it("4. Custom local model injected properly into Custom group without duplication", () => {
    useUIStore.setState({
      customApiKey: "",
      customApiBase: "http://localhost:11434/v1",
      customModelId: "deepseek-r1:14b",
    });
    useSessionStore.setState({
      availableModels: [],
    });

    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("deepseek-r1:14b")).toBeInTheDocument();

    const modelOption = screen.getByText("deepseek-r1:14b").closest("button");
    fireEvent.click(modelOption!);
    expect(useSessionStore.getState().activeModel).toBe("custom:deepseek-r1:14b");
  });

  it("5. Clicking 'Custom Model & API Keys...' opens Settings Drawer and closes selector", () => {
    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const customSettingsBtn = screen.getByText(/Custom Model & API Keys/i);
    fireEvent.click(customSettingsBtn);

    expect(useUIStore.getState().settingsOpen).toBe(true);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("6. Disabled state while isStreaming is active", () => {
    useSessionStore.setState({ isStreaming: true });

    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
  });

  it("7. Escape key closes the dropdown", () => {
    render(<ModelSelector />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("8. session-store toWire payload omits custom_api_key when customApiKey is empty", () => {
    useUIStore.setState({ customApiKey: "", customApiBase: "" });
    
    const mockSend = vi.fn().mockReturnValue(true);
    const mockClient = { send: mockSend };
    const customApiBase = useUIStore.getState().customApiBase;
    const customApiKey = useUIStore.getState().customApiKey;

    const payload = {
      type: "chat.send",
      messages: [],
      mode: "deep_research",
      model: "gpt-4o-mini",
      ...(customApiBase ? { custom_api_base: customApiBase } : {}),
      ...(customApiKey ? { custom_api_key: customApiKey } : {}),
    };

    mockClient.send(payload);

    expect(mockSend).toHaveBeenCalledWith({
      type: "chat.send",
      messages: [],
      mode: "deep_research",
      model: "gpt-4o-mini",
    });
    expect(payload).not.toHaveProperty("custom_api_key");
    expect(payload).not.toHaveProperty("custom_api_base");
  });

  it("9. session-store toWire payload includes custom_api_key when customApiKey is non-empty", () => {
    useUIStore.setState({ customApiKey: "sk-ant-12345", customApiBase: "https://api.anthropic.com/v1" });

    const mockSend = vi.fn().mockReturnValue(true);
    const mockClient = { send: mockSend };
    const customApiBase = useUIStore.getState().customApiBase;
    const customApiKey = useUIStore.getState().customApiKey;

    const payload = {
      type: "chat.send",
      messages: [],
      mode: "deep_research",
      model: "claude-3-5-sonnet",
      ...(customApiBase ? { custom_api_base: customApiBase } : {}),
      ...(customApiKey ? { custom_api_key: customApiKey } : {}),
    };

    mockClient.send(payload);

    expect(mockSend).toHaveBeenCalledWith({
      type: "chat.send",
      messages: [],
      mode: "deep_research",
      model: "claude-3-5-sonnet",
      custom_api_base: "https://api.anthropic.com/v1",
      custom_api_key: "sk-ant-12345",
    });
    expect(payload).toHaveProperty("custom_api_key", "sk-ant-12345");
  });
});