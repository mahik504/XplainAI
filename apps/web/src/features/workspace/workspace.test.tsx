import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

import { CitationPopover } from "./components/CitationPopover";
import { EGIGauge } from "./components/EGIGauge";
import { ClaimMatrix } from "./components/ClaimMatrix";
import { SourcesView } from "./views/SourcesView";
import { ResearchCanvas } from "./components/ResearchCanvas";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";
import type { DomainClaim, DomainEvidence, DomainSource } from "@/lib/protocol";

describe("Workspace Components and Views", () => {
  const mockSources: DomainSource[] = [
    {
      id: "src_1",
      title: "Surface Code Thresholds in Superconducting Qubits",
      url: "https://arxiv.org/abs/2101.00001",
      domain: "arxiv.org",
      snippet: "We demonstrate a fault-tolerance error threshold of 0.7% under standard depolarizing noise models.",
      source_type: "paper",
      authority_score: 0.95,
      reliability_tier: "high",
    },
    {
      id: "src_2",
      title: "Bosonic Cat Code Realization",
      url: "https://nature.com/articles/s41586-022-00000",
      domain: "nature.com",
      snippet: "Experimental stabilization of cat qubits achieves exponential suppression of bit-flip errors.",
      source_type: "paper",
      authority_score: 0.92,
      reliability_tier: "high",
    },
  ];

  const mockEvidence: DomainEvidence[] = [
    {
      id: "evi_1",
      source_id: "src_1",
      source_title: "Surface Code Thresholds in Superconducting Qubits",
      source_url: "https://arxiv.org/abs/2101.00001",
      text: "Fault-tolerance error threshold of 0.7% achieved under standard depolarizing noise.",
      confidence: 0.94,
      relevance_score: 0.96,
      page_number: 12,
    },
    {
      id: "evi_2",
      source_id: "src_2",
      source_title: "Bosonic Cat Code Realization",
      source_url: "https://nature.com/articles/s41586-022-00000",
      text: "Exponential suppression of bit-flip errors demonstrated in superconducting resonators.",
      confidence: 0.91,
      relevance_score: 0.89,
    },
  ];

  const mockClaims: DomainClaim[] = [
    {
      id: "clm_1",
      text: "Surface codes exhibit an error threshold around 0.7% in physical superconducting qubits.",
      status: "supported",
      evidence_ids: ["evi_1"],
      confidence: 0.94,
      importance: "core",
      sentence_index: 0,
    },
    {
      id: "clm_2",
      text: "Bosonic cat codes provide hardware-efficient protection against bit-flip errors.",
      status: "supported",
      evidence_ids: ["evi_2"],
      confidence: 0.91,
      importance: "high",
      sentence_index: 1,
    },
  ];

  beforeEach(() => {
    useUIStore.setState({
      activeCanvasTab: "overview",
      spotlightClaimId: null,
      spotlightSourceId: null,
      spotlightEvidenceId: null,
      composerPrefill: null,
    });

    useSessionStore.setState({
      messages: [],
      isStreaming: false,
      domainSources: mockSources,
      domainEvidence: mockEvidence,
      domainClaims: mockClaims,
      domainCitations: [
        {
          id: "cit_1",
          claim_id: "clm_1",
          source_id: "src_1",
          evidence_id: "evi_1",
          inline_marker: "[1]",
          citation_index: 1,
        },
      ],
      egiScore: 0.92,
      trustMetrics: {
        source_quality: 0.94,
        evidence_confidence: 0.92,
        claim_grounding: 0.95,
        citation_fidelity: 0.98,
        contradiction_penalty: 0.0,
        formula: "EGI = 0.25*Q_src + 0.30*C_evi + 0.25*G_clm + 0.20*F_cit - P_con",
      },
      stageTimings: [
        { stage: "retrieval", duration_ms: 320 },
        { stage: "synthesis", duration_ms: 1250 },
        { stage: "verification", duration_ms: 410 },
      ],
      contradictions: [],
      assumptions: [],
    });
  });

  it("CitationPopover renders citation button and displays popover on click", () => {
    render(
      <CitationPopover
        marker="[1]"
        citationIndex={1}
        source={mockSources[0]}
        evidence={mockEvidence[0]}
      />
    );

    const button = screen.getByText("[1]");
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(screen.getByText(/Surface Code Thresholds in Superconducting Qubits/i)).toBeDefined();
    expect(screen.getByText(/Fault-tolerance error threshold of 0.7%/i)).toBeDefined();
    expect(screen.getByText(/Evidence Matrix/i)).toBeDefined();
    expect(screen.getByText(/3D Topology/i)).toBeDefined();
  });

  it("EGIGauge renders radial score, status tier, and sub-metrics breakdown", () => {
    render(
      <EGIGauge
        score={0.92}
        trustMetrics={{
          source_quality: 0.94,
          evidence_confidence: 0.92,
          claim_grounding: 0.95,
          citation_fidelity: 0.98,
          contradiction_penalty: 0.0,
          formula: "EGI = 0.25*Q_src + 0.30*C_evi + 0.25*G_clm + 0.20*F_cit",
        }}
        stageTimings={[
          { stage: "retrieval", duration_ms: 320 },
          { stage: "synthesis", duration_ms: 1250 },
        ]}
      />
    );

    expect(screen.getAllByText(/92%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/EGI 2.0 Indicator/i)).toBeDefined();
    expect(screen.getByText(/High Grounding \(Verified\)/i)).toBeDefined();
    expect(screen.getByText(/Source Quality/i)).toBeDefined();
    expect(screen.getByText(/Claim Grounding/i)).toBeDefined();
    expect(screen.getByText(/Citation Fidelity/i)).toBeDefined();
  });

  it("ClaimMatrix filters claims by status and searches by keyword", () => {
    render(
      <ClaimMatrix
        claims={mockClaims}
        evidence={mockEvidence}
        sources={mockSources}
        contradictions={[]}
      />
    );

    expect(screen.getByText(/Surface codes exhibit an error threshold/i)).toBeDefined();
    expect(screen.getByText(/Bosonic cat codes provide hardware-efficient/i)).toBeDefined();

    const searchInput = screen.getByPlaceholderText(/Search claims or topics/i);
    fireEvent.change(searchInput, { target: { value: "Bosonic" } });

    expect(screen.queryByText(/Surface codes exhibit an error threshold/i)).toBeNull();
    expect(screen.getByText(/Bosonic cat codes provide hardware-efficient/i)).toBeDefined();
  });

  it("SourcesView lists registered literature with authority score and triggers preview modal", () => {
    render(<SourcesView />);

    expect(screen.getByText(/Surface Code Thresholds in Superconducting Qubits/i)).toBeDefined();
    expect(screen.getByText(/Bosonic Cat Code Realization/i)).toBeDefined();

    const previewButtons = screen.getAllByRole("button", { name: /Preview/i });
    expect(previewButtons.length).toBeGreaterThan(0);

    fireEvent.click(previewButtons[0]!);
    expect(screen.getByText(/Extracted Verbatim Content/i)).toBeDefined();
    expect(screen.getByText(/Extracted Evidence Snippets/i)).toBeDefined();
  });

  it("ResearchCanvas displays the 4 specialized tabs and switches views", () => {
    render(<ResearchCanvas />);

    const overviewTab = screen.getByRole("button", { name: /Overview/i });
    const evidenceTab = screen.getByRole("button", { name: /Evidence/i });
    const graphTab = screen.getByRole("button", { name: /Graph/i });
    const sourcesTab = screen.getByRole("button", { name: /Sources/i });

    expect(overviewTab).toBeDefined();
    expect(evidenceTab).toBeDefined();
    expect(graphTab).toBeDefined();
    expect(sourcesTab).toBeDefined();

    // Switch to Sources
    fireEvent.click(sourcesTab);
    expect(useUIStore.getState().activeCanvasTab).toBe("sources");

    // Switch to Evidence
    fireEvent.click(evidenceTab);
    expect(useUIStore.getState().activeCanvasTab).toBe("evidence");
  });
});
