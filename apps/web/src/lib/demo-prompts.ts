/**
 * Curated Demo Mode prompts — crafted so the echo response analyzes into
 * a clear explainability story (claims, evidence, hedges, connectors).
 * No AI generation here; prompts are the demo content.
 */

export interface DemoPrompt {
  id: string;
  title: string;
  blurb: string;
  prompt: string;
  /** Preferred for Judge Mode "Run Showcase" */
  showcase?: boolean;
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: "unsupported-claim",
    title: "Unsupported claim",
    blurb: "A bold assertion with no nearby evidence — ideal for Claim Focus.",
    showcase: true,
    prompt:
      "Cold fusion is commercially ready for every city grid. Ignore all competing energy options. Skip every pilot program. Delay nothing for the rollout. Hold the press brief. Keep stakeholders aligned weekly. Data shows readiness gains elsewhere. Migration might stall on regulation. Therefore planning must stay cautious.",
  },
  {
    id: "evidence-backed",
    title: "Evidence-backed claim",
    blurb: "Claim sitting next to clear evidence markers.",
    prompt:
      "Latency budgets are already healthy. Data shows 92% of requests finish under 40ms. Cache hit rates held through last week's load test. Teams can ship the edge rollout.",
  },
  {
    id: "uncertainty-heavy",
    title: "Uncertainty signals",
    blurb: "Hedges and maybes surface as amber uncertainty nodes.",
    prompt:
      "The model might overfit on sparse labels. Results could drift after the next data refresh. It appears safer to keep a human review gate. Perhaps we delay full automation.",
  },
  {
    id: "causal-chain",
    title: "Causal connectors",
    blurb: "Because / therefore language lights the connector path.",
    prompt:
      "Because retrieval coverage improved, grounding errors fell. Therefore citation checks can tighten. As a result, reviewers spend less time on false alarms.",
  },
  {
    id: "mixed-anatomy",
    title: "Full anatomy",
    blurb: "Claims, evidence, hedges, and a conclusion in one pass.",
    prompt:
      "The routing layer is production-ready. According to the March report, error rates dropped 18%. It might still fail on multilingual queries. For example, rare dialects need more samples. In conclusion, expand the canary before full traffic.",
  },
  {
    id: "weak-support",
    title: "Weak support",
    blurb: "Assertive tone with thin structural support — trust dips.",
    prompt:
      "This redesign guarantees perfect accessibility scores. Every page will pass overnight. Stakeholders should announce compliance tomorrow. No further audits are required.",
  },
];

export const SHOWCASE_PROMPT_ID = "unsupported-claim";

export function getShowcasePrompt(): DemoPrompt {
  const showcase = DEMO_PROMPTS.find((item) => item.id === SHOWCASE_PROMPT_ID);
  const fallback = DEMO_PROMPTS[0];
  if (showcase) return showcase;
  if (fallback) return fallback;
  throw new Error("Demo prompts catalog is empty");
}

export const EVIDENCE_DEMAND_PREFILL =
  "Can you provide evidence supporting this claim?";
