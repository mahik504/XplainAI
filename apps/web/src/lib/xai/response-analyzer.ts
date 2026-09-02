/**
 * Response Structure Analyzer (XAI surface).
 *
 * Analyzes the *generated assistant text* only — sentence structure cues,
 * not model chain-of-thought or internal reasoning. Naming reflects that.
 *
 * Analysis runs on a markdown-stripped projection (`toAnalysisText`) so the
 * display layer can render full Markdown without corrupting structure cues.
 */

import { toAnalysisText } from "./analysis-text";

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

function maskCodeFences(text: string): { masked: string; blocks: { start: number; end: number; text: string }[] } {
  const blocks: { start: number; end: number; text: string }[] = [];
  const masked = text.replace(/```[\s\S]*?```/g, (match, offset: number) => {
    blocks.push({ start: offset, end: offset + match.length, text: match });
    return " ".repeat(match.length);
  });
  return { masked, blocks };
}

function pushSegment(
  segments: { text: string; start: number; end: number }[],
  source: string,
  start: number,
  end: number,
) {
  const piece = source.slice(start, end).trim();
  if (!piece) return;
  const localStart = source.indexOf(piece, start);
  if (localStart < 0) return;
  segments.push({
    text: piece,
    start: localStart,
    end: localStart + piece.length,
  });
}

/**
 * Split on sentence terminators while preserving offsets.
 * Markdown-aware: keeps fenced code as one unit; splits headings/bullets/numbered lines.
 */
export function segmentSentences(text: string): { text: string; start: number; end: number }[] {
  const source = text;
  if (!source.trim()) return [];

  const { masked, blocks } = maskCodeFences(source);
  const segments: { text: string; start: number; end: number }[] = [];

  // Prefer line-oriented split for markdown structure.
  const lineRe = /[^\n]+/g;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = lineRe.exec(masked)) !== null) {
    const lineStart = lineMatch.index;
    const lineEnd = lineStart + lineMatch[0].length;
    const line = source.slice(lineStart, lineEnd);
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const isMdBlock =
      /^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)/.test(trimmedLine) ||
      trimmedLine.startsWith("```");

    if (isMdBlock) {
      pushSegment(segments, source, lineStart, lineEnd);
      continue;
    }

    let start = lineStart;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = masked.charAt(i);
      if (ch !== "." && ch !== "!" && ch !== "?") continue;
      if (ch === ".") {
        if (isDecimalDot(masked, i)) continue;
        if (isAbbreviationDot(masked, i)) continue;
        if (isInsideUrl(masked, i)) continue;
      }
      let end = i + 1;
      while (end < lineEnd && /["')\]]/.test(masked.charAt(end))) end += 1;
      pushSegment(segments, source, start, end);
      start = end;
      while (start < lineEnd && /\s/.test(masked.charAt(start))) start += 1;
      i = start - 1;
    }
    if (start < lineEnd) {
      pushSegment(segments, source, start, lineEnd);
    }
  }

  // Restore/ensure fenced code blocks appear as dedicated segments if missed.
  for (const block of blocks) {
    const overlaps = segments.some(
      (segment) => segment.start < block.end && segment.end > block.start,
    );
    if (!overlaps) {
      segments.push({ text: block.text, start: block.start, end: block.end });
    }
  }

  segments.sort((a, b) => a.start - b.start);
  return segments;
}

function classifySentence(sentence: string): { category: ResponseStructureCategory; confidence: number } {
  const text = sentence.trim();
  if (text.length === 0) {
    return { category: "neutral", confidence: 1 };
  }

  if (text.startsWith("```")) {
    return { category: "neutral", confidence: 0.95 };
  }
  if (/^#{1,6}\s+/.test(text)) {
    return { category: "conclusion", confidence: 0.7 };
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
  const source = toAnalysisText(text);
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
