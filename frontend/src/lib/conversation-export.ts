import type { ConversationMessage } from "@/features/conversation";
import type { RetrievedSource } from "@/lib/sources";
import type { ResponseStructureAnalysis } from "@/lib/xai";

export interface ConversationExportPayload {
  id?: string | undefined;
  title: string;
  updatedAt?: string | undefined;
  modelId?: string | null | undefined;
  runMode?: string | undefined;
  messages: ConversationMessage[];
  responseAnalysis?: ResponseStructureAnalysis | null | undefined;
  retrievedSources?: RetrievedSource[] | undefined;
  missingContext?: Array<{ item: string; importance: string; why_it_matters: string }> | undefined;
  counterPerspective?: string | null | undefined;
  graphNodes?: unknown[] | undefined;
  graphEdges?: unknown[] | undefined;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "inquiry";
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportConversationAsJson(payload: ConversationExportPayload): string {
  const exportData = {
    xplainai_version: "2.1.0",
    exported_at: new Date().toISOString(),
    session: {
      id: payload.id ?? "session_export",
      title: payload.title,
      updated_at: payload.updatedAt ?? new Date().toISOString(),
      model: payload.modelId ?? "default",
      mode: payload.runMode ?? "deep_research",
    },
    conversation: payload.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
    epistemic_analysis: payload.responseAnalysis ?? null,
    sources: payload.retrievedSources ?? [],
    missing_context: payload.missingContext ?? [],
    counter_perspective: payload.counterPerspective ?? null,
    graph: {
      nodes: payload.graphNodes ?? [],
      edges: payload.graphEdges ?? [],
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `xplainai-${slugify(payload.title)}-${dateStr}.json`;
  downloadBlob(jsonString, filename, "application/json");
  return jsonString;
}

export function exportConversationAsMarkdown(payload: ConversationExportPayload): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const lines: string[] = [];

  lines.push(`# XplainAI Epistemic Research Report: ${payload.title}`);
  lines.push(`**Generated**: ${new Date().toUTCString()}`);
  lines.push(`**Model**: ${payload.modelId ?? "Default"}`);
  lines.push(`**Research Mode**: ${payload.runMode ?? "Deep Research"}`);
  lines.push(`---`);
  lines.push(``);

  // 1. Epistemic Metrics Overview (if analysis exists)
  if (payload.responseAnalysis) {
    const a = payload.responseAnalysis;
    lines.push(`## 📊 Epistemic Grounding Overview`);
    lines.push(`- **Total Assertions / Claims**: ${a.sentences.filter((s) => s.category === "claim").length}`);
    lines.push(`- **Empirical Evidence Points**: ${a.sentences.filter((s) => s.category === "evidence").length}`);
    lines.push(`- **Reasoning Chains**: ${a.sentences.filter((s) => s.category === "reasoning").length}`);
    lines.push(`- **Hedges & Assumptions**: ${a.sentences.filter((s) => s.category === "hedge").length}`);
    lines.push(`- **Verified Sources Linked**: ${payload.retrievedSources?.length ?? 0}`);
    lines.push(``);
  }

  // 2. Conversation Transcript
  lines.push(`## 💬 Research Dialogue`);
  lines.push(``);
  for (const m of payload.messages) {
    const speaker = m.role === "user" ? "🧑‍💻 User Inquiry" : "🤖 XplainAI Synthesis";
    lines.push(`### ${speaker} (${m.timestamp})`);
    lines.push(m.content);
    lines.push(``);
  }

  // 3. Retrieved Sources
  if (payload.retrievedSources && payload.retrievedSources.length > 0) {
    lines.push(`## 📚 Grounding Sources & Citations`);
    lines.push(``);
    payload.retrievedSources.forEach((src, idx) => {
      lines.push(`${idx + 1}. **${src.title || src.source_type || "Source"}**`);
      if (src.url) lines.push(`   - URL: [${src.url}](${src.url})`);
      if (src.snippet) lines.push(`   - Snippet: _"${src.snippet}"_`);
      lines.push(``);
    });
  }

  // 4. Missing Context & Epistemic Counter-Perspectives
  if (payload.missingContext && payload.missingContext.length > 0) {
    lines.push(`## 🔍 Identified Epistemic Blindspots`);
    lines.push(``);
    payload.missingContext.forEach((mc) => {
      lines.push(`- **${mc.item}** (Priority: ${mc.importance})`);
      lines.push(`  _${mc.why_it_matters}_`);
    });
    lines.push(``);
  }

  if (payload.counterPerspective) {
    lines.push(`## ⚖️ Counter-Perspective & Critical Analysis`);
    lines.push(``);
    lines.push(payload.counterPerspective);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`_Exported from XplainAI Quantum Obsidian Epistemic Platform._`);

  const mdString = lines.join("\n");
  const filename = `xplainai-report-${slugify(payload.title)}-${dateStr}.md`;
  downloadBlob(mdString, filename, "text/markdown");
  return mdString;
}
