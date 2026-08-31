import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeResponse } from "@/lib/xai";
import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
  type ConversationExportPayload,
} from "./conversation-export";

describe("conversation-export", () => {
  const analysis = analyzeResponse(
    "Topological quantum computing relies on non-Abelian anyons [1]. Non-Abelian braiding provides fault tolerance. Hence decoherence is exponentially suppressed."
  );

  const mockPayload: ConversationExportPayload = {
    id: "conv_123",
    title: "Quantum Entanglement & Superconductivity",
    modelId: "deepseek-r1",
    runMode: "deep_research",
    messages: [
      {
        id: "m_1",
        role: "user",
        content: "Explain topological quantum computing and anyons.",
        timestamp: "10:00:00 AM",
      },
      {
        id: "m_2",
        role: "assistant",
        content: "Topological quantum computing relies on non-Abelian anyons [1].",
        timestamp: "10:00:02 AM",
      },
    ],
    responseAnalysis: analysis,
    retrievedSources: [
      {
        source_id: "src_1",
        title: "Nature Physics: Anyonic Braiding",
        url: "https://nature.com/articles/anyons",
        source_type: "web",
        tool: "brave_search",
        snippet: "Experimental observation of non-Abelian statistics.",
      },
    ],
    missingContext: [
      {
        item: "Cryogenic thermal noise",
        importance: "high",
        why_it_matters: "Determines practical coherence limits in dilution refrigerators.",
      },
    ],
    counterPerspective: "Majorana zero modes remain susceptible to quasi-particle poisoning.",
  };

  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let anchorClickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => "blob:http://localhost/dummy-uuid");
    revokeObjectURLMock = vi.fn();
    anchorClickMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock as unknown as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof window.URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = anchorClickMock;
  });


  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports conversation as valid JSON with complete session metadata and analysis", () => {
    const jsonString = exportConversationAsJson(mockPayload);
    const parsed = JSON.parse(jsonString);

    expect(parsed.xplainai_version).toBe("2.1.0");
    expect(parsed.session.id).toBe("conv_123");
    expect(parsed.session.title).toBe("Quantum Entanglement & Superconductivity");
    expect(parsed.session.model).toBe("deepseek-r1");
    expect(parsed.session.mode).toBe("deep_research");
    expect(parsed.conversation).toHaveLength(2);
    expect(parsed.conversation[0].content).toBe("Explain topological quantum computing and anyons.");
    expect(parsed.epistemic_analysis.sentences.length).toBeGreaterThan(0);
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.missing_context).toHaveLength(1);
    expect(parsed.counter_perspective).toContain("Majorana zero modes");

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("exports conversation as structured Markdown report", () => {
    const mdString = exportConversationAsMarkdown(mockPayload);

    expect(mdString).toContain("# XplainAI Epistemic Research Report: Quantum Entanglement & Superconductivity");
    expect(mdString).toContain("## 📊 Epistemic Grounding Overview");
    expect(mdString).toContain("Total Assertions / Claims**:");
    expect(mdString).toContain("## 💬 Research Dialogue");
    expect(mdString).toContain("🧑‍💻 User Inquiry (10:00:00 AM)");
    expect(mdString).toContain("🤖 XplainAI Synthesis (10:00:02 AM)");
    expect(mdString).toContain("## 📚 Grounding Sources & Citations");
    expect(mdString).toContain("Nature Physics: Anyonic Braiding");
    expect(mdString).toContain("https://nature.com/articles/anyons");
    expect(mdString).toContain("## 🔍 Identified Epistemic Blindspots");
    expect(mdString).toContain("Cryogenic thermal noise");
    expect(mdString).toContain("## ⚖️ Counter-Perspective & Critical Analysis");
    expect(mdString).toContain("quasi-particle poisoning");

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });
});
