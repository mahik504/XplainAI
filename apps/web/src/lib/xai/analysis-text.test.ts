import { describe, expect, it } from "vitest";

import { analyzeResponse } from "./response-analyzer";
import { toAnalysisText } from "./analysis-text";

describe("toAnalysisText", () => {
  it("strips markdown markers while preserving readable prose", () => {
    const raw = "## Title\n\n**Bold** claim about React.\n\n- item one\n- item two";
    const text = toAnalysisText(raw);
    expect(text).not.toContain("**");
    expect(text).not.toContain("##");
    expect(text).toContain("Bold claim about React");
  });

  it("collapses fenced code into a single placeholder", () => {
    const raw = [
      "Here is an example.",
      "```ts",
      "const x = 1;",
      "const y = 2;",
      "```",
      "Therefore the approach works.",
    ].join("\n");
    const text = toAnalysisText(raw);
    expect(text).toContain("[code block]");
    expect(text).not.toContain("const x");
  });
});

describe("analyzeResponse markdown safety", () => {
  it("does not turn code fences into dozens of assertions", () => {
    const codeLines = Array.from({ length: 20 }, (_, i) => `line${String(i)} = ${String(i)};`).join(
      "\n",
    );
    const raw = `React is useful for UI.\n\n\`\`\`js\n${codeLines}\n\`\`\`\n\nIn conclusion, choose carefully.`;
    const analysis = analyzeResponse(raw);
    expect(analysis.claims.length).toBeLessThan(5);
    expect(analysis.score.sentenceCount).toBeLessThan(10);
  });

  it("handles empty response", () => {
    const analysis = analyzeResponse("");
    expect(analysis.score.sentenceCount).toBe(0);
    expect(analysis.claims).toHaveLength(0);
  });
});
