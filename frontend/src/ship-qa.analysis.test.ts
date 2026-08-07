import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveClaimFocus } from "@/lib/claim-focus";
import { buildResponseStructureGraph } from "@/lib/response-graph";
import { primaryUnsupportedAssertionId } from "@/lib/unsupported-claims";
import { analyzeResponse } from "@/lib/xai/response-analyzer";

const dataPath = resolve(__dirname, "../../backend/scripts/_ship_qa_last.json");

describe("ship QA OpenAI responses → single analysis path", () => {
  const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
    results: Array<{ prompt: string; ok: boolean; text: string }>;
  };

  it("has 10 OpenAI results", () => {
    expect(data.results).toHaveLength(10);
  });

  for (const row of data.results) {
    it(`analyzes: ${row.prompt}`, () => {
      expect(row.ok).toBe(true);
      expect(row.text.toLowerCase().startsWith("you said:")).toBe(false);

      const analysis = analyzeResponse(row.text);
      const graph = buildResponseStructureGraph(analysis);
      const unsupported = primaryUnsupportedAssertionId(analysis);
      if (unsupported) {
        expect(resolveClaimFocus(analysis, unsupported)).not.toBeNull();
      }

      expect(Number.isFinite(analysis.score.confidence)).toBe(true);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
      expect(analysis.score.sentenceCount).toBeGreaterThanOrEqual(0);
    });
  }
});
