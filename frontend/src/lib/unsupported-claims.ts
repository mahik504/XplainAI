import { resolveClaimFocus, sentenceId } from "@/lib/claim-focus";
import type { ClassifiedSentence, ResponseStructureAnalysis } from "@/lib/xai";

/** Assertions with zero proximity-linked evidence in responseAnalysis. */
export function findUnsupportedAssertions(
  analysis: ResponseStructureAnalysis,
): ClassifiedSentence[] {
  return analysis.claims.filter((claim) => {
    const resolved = resolveClaimFocus(analysis, sentenceId(claim));
    return resolved !== null && resolved.evidence.length === 0;
  });
}

export function primaryUnsupportedAssertionId(
  analysis: ResponseStructureAnalysis,
): string | null {
  const first = findUnsupportedAssertions(analysis)[0];
  return first ? sentenceId(first) : null;
}

export function isUnsupportedAssertion(
  analysis: ResponseStructureAnalysis,
  assertionId: string,
): boolean {
  const resolved = resolveClaimFocus(analysis, assertionId);
  return resolved !== null && resolved.evidence.length === 0;
}
