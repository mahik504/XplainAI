export type StoryStepId =
  | "streaming"
  | "response_complete"
  | "analyzing_structure"
  | "evidence_found"
  | "unsupported_claim"
  | "inspect_claim"
  | "ask_for_evidence"
  | "improved_answer";

export interface StoryStep {
  id: StoryStepId;
  title: string;
  detail: string;
}

export const STORY_STEPS: StoryStep[] = [
  {
    id: "streaming",
    title: "Streaming…",
    detail: "Tokens arrive live. The pipeline graph tracks the run.",
  },
  {
    id: "response_complete",
    title: "Response Complete",
    detail: "The assistant turn finished. Structure analysis begins next.",
  },
  {
    id: "analyzing_structure",
    title: "Analyzing Structure",
    detail: "Observable sentence categories become the Response Structure graph.",
  },
  {
    id: "evidence_found",
    title: "Evidence Found",
    detail: "Evidence markers were detected in the finished text.",
  },
  {
    id: "unsupported_claim",
    title: "Unsupported Claim",
    detail: "An assertion lacks nearby supporting evidence — honest gap signal.",
  },
  {
    id: "inspect_claim",
    title: "Inspect Claim",
    detail: "Click the Assertion node (or the claim) to enter Claim Focus.",
  },
  {
    id: "ask_for_evidence",
    title: "Ask For Evidence",
    detail: "Click ? to prefill an evidence demand — then press Send yourself.",
  },
  {
    id: "improved_answer",
    title: "Improved Answer",
    detail: "The follow-up response is ready — re-check structure and trust.",
  },
];

export function storyStepIndex(id: StoryStepId | null): number {
  if (!id) return -1;
  return STORY_STEPS.findIndex((step) => step.id === id);
}
