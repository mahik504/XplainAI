/**
 * Response Structure Analyzer (XAI surface).
 *
 * Analyzes the *generated assistant text* only — sentence structure cues,
 * not model chain-of-thought or internal reasoning. Naming reflects that.
 */

export type ResponseStructureCategory =
  | "conclusion"
  | "reasoning"
  | "evidence"
  | "example"
  | "hedge"
  | "claim"
  | "neutral";

export interface ClassifiedSentence {
  text: string;
  start: number;
  end: number;
  category: ResponseStructureCategory;
  confidence: number;
}

export interface ResponseStructureScore {
  claimCount: number;
  reasoningCount: number;
  evidenceCount: number;
  exampleCount: number;
  hedgeCount: number;
  conclusionCount: number;
  neutralCount: number;
  sentenceCount: number;
  hedgingRatio: number;
  claimEvidenceRatio: number;
  reasoningDepth: number;
  /** 0–1 structural reasoning signal from classified sentence mix */
  reasoningScore: number;
  /** 0–1 structural evidence signal from classified sentence mix */
  evidenceScore: number;
  /** Weighted structural confidence (not model self-report) */
  confidence: number;
}

export interface ResponseStructureAnalysis {
  claims: ClassifiedSentence[];
  evidence: ClassifiedSentence[];
  reasoning: ClassifiedSentence[];
  examples: ClassifiedSentence[];
  hedges: ClassifiedSentence[];
  conclusions: ClassifiedSentence[];
  /** Full ordered list including neutral sentences */
  sentences: ClassifiedSentence[];
  score: ResponseStructureScore;
}

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
  "inc",
  "ltd",
  "approx",
  "fig",
  "al",
  "no",
  "vol",
]);

const CONCLUSION_RE =
  /\b(in conclusion|to summarize|to summarise|overall|finally|in summary|all in all|to conclude)\b/i;
const REASONING_RE =
  /\b(because|therefore|thus|since|hence|as a result|which means|leading to|due to)\b/i;
const EVIDENCE_RE =
  /\b(according to|research|study|studies|reported|report|data shows|survey)\b|\bhttps?:\/\/\S+|\bwww\.\S+|\b\d{1,3}(?:\.\d+)?%|\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\b/i;
const EXAMPLE_RE = /\b(for example|for instance|such as)\b|(?:^|\s)like\s+/i;
const HEDGE_RE = /\b(may|might|could|possibly|likely|appears|suggests|seem|seems|perhaps|probably)\b/i;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isAbbreviationDot(text: string, dotIndex: number): boolean {
  let start = dotIndex - 1;
  while (start >= 0) {
    const ch = text.charAt(start);
    if (!/[A-Za-z.]/.test(ch)) break;
    start -= 1;
  }
  const token = text.slice(start + 1, dotIndex).toLowerCase();
  if (!token) return false;
  if (ABBREVIATIONS.has(token)) return true;
  // Initials like "U.S." or "A.I."
  if (/^(?:[a-z]\.)+[a-z]?$/i.test(`${token}.`)) return true;
  return false;
}

function isDecimalDot(text: string, dotIndex: number): boolean {
  const prev = text.charAt(dotIndex - 1);
  const next = text.charAt(dotIndex + 1);
  return Boolean(prev && next && /\d/.test(prev) && /\d/.test(next));
}

function isInsideUrl(text: string, index: number): boolean {
  const left = text.lastIndexOf("http", index);
  if (left === -1 || left > index) return false;
  const slice = text.slice(left, index + 1);
  return /^https?:\/\/\S*$/i.test(slice) || /^www\.\S*$/i.test(slice);
}

/** Split on sentence terminators while preserving offsets; skips decimals, URLs, abbreviations. */
export function segmentSentences(text: string): { text: string; start: number; end: number }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const baseOffset = text.indexOf(trimmed);
  const segments: { text: string; start: number; end: number }[] = [];
  let start = 0;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed.charAt(i);
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    if (ch === ".") {
      if (isDecimalDot(trimmed, i)) continue;
      if (isAbbreviationDot(trimmed, i)) continue;
      if (isInsideUrl(trimmed, i)) continue;
    }

    // Consume trailing quotes/brackets
    let end = i + 1;
    while (end < trimmed.length && /["')\]]/.test(trimmed.charAt(end))) {
      end += 1;
    }

    const piece = trimmed.slice(start, end).trim();
    if (piece.length > 0) {
      const localStart = trimmed.indexOf(piece, start);
      segments.push({
        text: piece,
        start: baseOffset + localStart,
        end: baseOffset + localStart + piece.length,
      });
    }

    start = end;
    while (start < trimmed.length && /\s/.test(trimmed.charAt(start))) {
      start += 1;
    }
    i = start - 1;
  }

  if (start < trimmed.length) {
    const piece = trimmed.slice(start).trim();
    if (piece.length > 0) {
      const localStart = trimmed.indexOf(piece, start);
      segments.push({
        text: piece,
        start: baseOffset + localStart,
        end: baseOffset + localStart + piece.length,
      });
    }
  }

  return segments;
}

function classifySentence(sentence: string): { category: ResponseStructureCategory; confidence: number } {
  const text = sentence.trim();
  if (text.length === 0) {
    return { category: "neutral", confidence: 1 };
  }

  // Priority: Conclusion → Reasoning → Evidence → Example → Hedge → Claim → Neutral
  if (CONCLUSION_RE.test(text)) {
    return { category: "conclusion", confidence: 0.92 };
  }
  if (REASONING_RE.test(text)) {
    return { category: "reasoning", confidence: 0.88 };
  }
  if (EVIDENCE_RE.test(text)) {
    const strong =
      /\bhttps?:\/\/|\b\d{1,3}(?:\.\d+)?%|\baccording to\b|\bresearch\b|\bstudy\b/i.test(text);
    return { category: "evidence", confidence: strong ? 0.9 : 0.78 };
  }
  if (EXAMPLE_RE.test(text)) {
    return { category: "example", confidence: 0.86 };
  }
  if (HEDGE_RE.test(text)) {
    return { category: "hedge", confidence: 0.84 };
  }

  // Neutral: questions, imperatives-without-substance, tiny fragments
  if (/\?\s*$/.test(text) || text.length < 12 || /^(ok|okay|yes|no|sure|thanks)\b/i.test(text)) {
    return { category: "neutral", confidence: 0.7 };
  }

  return { category: "claim", confidence: 0.72 };
}

function buildScore(sentences: ClassifiedSentence[]): ResponseStructureScore {
  const sentenceCount = sentences.length;
  const claimCount = sentences.filter((s) => s.category === "claim").length;
  const reasoningCount = sentences.filter((s) => s.category === "reasoning").length;
  const evidenceCount = sentences.filter((s) => s.category === "evidence").length;
  const exampleCount = sentences.filter((s) => s.category === "example").length;
  const hedgeCount = sentences.filter((s) => s.category === "hedge").length;
  const conclusionCount = sentences.filter((s) => s.category === "conclusion").length;
  const neutralCount = sentences.filter((s) => s.category === "neutral").length;

  const hedgingRatio = sentenceCount === 0 ? 0 : hedgeCount / sentenceCount;
  const claimEvidenceRatio =
    evidenceCount === 0 ? (claimCount > 0 ? claimCount : 0) : claimCount / evidenceCount;

  // Reasoning depth: share of connective/reasoning + conclusions, capped.
  const reasoningDepth = clamp01((reasoningCount + conclusionCount * 0.5) / Math.max(sentenceCount, 1));

  const reasoningScore = clamp01(
    reasoningCount === 0 && conclusionCount === 0
      ? 0.12
      : 0.25 + reasoningDepth * 0.75,
  );

  const evidenceScore = clamp01(
    evidenceCount === 0
      ? exampleCount > 0
        ? 0.28
        : 0.1
      : 0.3 + Math.min(1, evidenceCount / Math.max(sentenceCount, 1)) * 0.7,
  );

  // Structural confidence: evidence + reasoning, penalize heavy hedging / unsupported claims.
  const unsupportedPenalty =
    claimCount > 0 && evidenceCount === 0 ? 0.18 : claimEvidenceRatio > 3 ? 0.12 : 0;

  const confidence = clamp01(
    0.38 * evidenceScore +
      0.32 * reasoningScore +
      0.18 * (1 - hedgingRatio) +
      0.12 * (conclusionCount > 0 ? 1 : 0.55) -
      unsupportedPenalty,
  );

  return {
    claimCount,
    reasoningCount,
    evidenceCount,
    exampleCount,
    hedgeCount,
    conclusionCount,
    neutralCount,
    sentenceCount,
    hedgingRatio,
    claimEvidenceRatio,
    reasoningDepth,
    reasoningScore,
    evidenceScore,
    confidence,
  };
}

const EMPTY_ANALYSIS: ResponseStructureAnalysis = {
  claims: [],
  evidence: [],
  reasoning: [],
  examples: [],
  hedges: [],
  conclusions: [],
  sentences: [],
  score: {
    claimCount: 0,
    reasoningCount: 0,
    evidenceCount: 0,
    exampleCount: 0,
    hedgeCount: 0,
    conclusionCount: 0,
    neutralCount: 0,
    sentenceCount: 0,
    hedgingRatio: 0,
    claimEvidenceRatio: 0,
    reasoningDepth: 0,
    reasoningScore: 0,
    evidenceScore: 0,
    confidence: 0,
  },
};

/** Analyze final assistant response structure. Pure; safe to memoize by text. */
export function analyzeResponse(text: string): ResponseStructureAnalysis {
  const source = text.trim();
  if (!source) {
    return EMPTY_ANALYSIS;
  }

  const segments = segmentSentences(source);
  const sentences: ClassifiedSentence[] = segments.map((segment) => {
    const { category, confidence } = classifySentence(segment.text);
    return {
      text: segment.text,
      start: segment.start,
      end: segment.end,
      category,
      confidence,
    };
  });

  return {
    claims: sentences.filter((s) => s.category === "claim"),
    evidence: sentences.filter((s) => s.category === "evidence"),
    reasoning: sentences.filter((s) => s.category === "reasoning"),
    examples: sentences.filter((s) => s.category === "example"),
    hedges: sentences.filter((s) => s.category === "hedge"),
    conclusions: sentences.filter((s) => s.category === "conclusion"),
    sentences,
    score: buildScore(sentences),
  };
}
