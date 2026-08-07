import { motion } from "framer-motion";
import { memo, useEffect, useMemo, useRef, type MouseEvent } from "react";

import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveClaimFocus, sentenceId } from "@/lib/claim-focus";
import { EVIDENCE_DEMAND_PREFILL } from "@/lib/demo-prompts";
import { isUnsupportedAssertion } from "@/lib/unsupported-claims";
import {
  analyzeResponse,
  type ClassifiedSentence,
  type ResponseStructureAnalysis,
  type ResponseStructureCategory,
} from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

import { ReasoningAnatomyBar } from "./ReasoningAnatomyBar";

const CATEGORY_STYLE: Record<
  ResponseStructureCategory,
  { border: string; bg: string; label: string }
> = {
  claim: {
    border: "border-l-neon-cyan",
    bg: "bg-neon-cyan/10",
    label: "Claim",
  },
  evidence: {
    border: "border-l-neon-emerald",
    bg: "bg-neon-emerald/10",
    label: "Evidence",
  },
  reasoning: {
    border: "border-l-neon-violet",
    bg: "bg-neon-violet/10",
    label: "Reasoning cue",
  },
  example: {
    border: "border-l-orange-400",
    bg: "bg-orange-400/10",
    label: "Example",
  },
  hedge: {
    border: "border-l-neon-amber",
    bg: "bg-neon-amber/10",
    label: "Hedge",
  },
  conclusion: {
    border: "border-l-pink-400",
    bg: "bg-pink-400/10",
    label: "Conclusion",
  },
  neutral: {
    border: "border-l-muted-foreground/50",
    bg: "bg-white/[0.03]",
    label: "Neutral",
  },
};

interface AnimatedAnnotatedMessageProps {
  content: string;
  /** Prefer store analysis for the latest finished response when content matches. */
  analysis?: ResponseStructureAnalysis | null;
  className?: string;
}

const SentenceChip = memo(function SentenceChip({
  sentence,
  index,
  analysis,
}: {
  sentence: ClassifiedSentence;
  index: number;
  analysis: ResponseStructureAnalysis;
}) {
  const style = CATEGORY_STYLE[sentence.category];
  const pct = Math.round(sentence.confidence * 100);
  const id = sentenceId(sentence);
  const chipRef = useRef<HTMLSpanElement>(null);
  const isClaim = sentence.category === "claim";
  const unsupported = isClaim && isUnsupportedAssertion(analysis, id);

  const isFocusedAssertion = useUIStore((state) => state.focusedAssertionId === id);
  const isFocusedEvidence = useUIStore((state) => state.focusedEvidenceIds.includes(id));
  const claimFocusActive = useUIStore((state) => state.focusedAssertionId !== null);
  const isSpotlight = useUIStore((state) => state.spotlightAssertionId === id);
  const evidenceDemandHighlight = useUIStore((state) => state.evidenceDemandHighlight);
  const isLit = useUIStore(
    (state) =>
      state.focusedAssertionId === null && state.highlightCategory === sentence.category,
  );
  const isHoverDimmed = useUIStore((state) => {
    if (state.focusedAssertionId !== null) return false;
    const highlight = state.highlightCategory;
    return highlight !== null && highlight !== sentence.category;
  });
  const setHighlightCategory = useUIStore((state) => state.setHighlightCategory);
  const enterClaimFocus = useUIStore((state) => state.enterClaimFocus);
  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
  const setEvidenceDemandHighlight = useUIStore((state) => state.setEvidenceDemandHighlight);

  useEffect(() => {
    if (!isFocusedAssertion && !isSpotlight) return;
    chipRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isFocusedAssertion, isSpotlight]);

  const focusDimmed = claimFocusActive && !isFocusedAssertion && !isFocusedEvidence;
  const opacity = focusDimmed || isHoverDimmed ? 0.35 : 1;

  const openClaimFocus = () => {
    if (!isClaim) return;
    const resolved = resolveClaimFocus(analysis, id);
    if (!resolved) return;
    enterClaimFocus(id, resolved.evidenceIds);
  };

  const requestEvidence = (event: MouseEvent) => {
    event.stopPropagation();
    setEvidenceDemandHighlight(true);
    setComposerPrefill(EVIDENCE_DEMAND_PREFILL);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.span
          ref={chipRef}
          data-sentence-id={id}
          role={isClaim ? "button" : undefined}
          tabIndex={isClaim ? 0 : undefined}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity, y: 0 }}
          transition={{
            duration: 0.28,
            delay: Math.min(index * 0.035, 0.35),
            ease: [0.22, 1, 0.36, 1],
          }}
          onClick={openClaimFocus}
          onKeyDown={(event) => {
            if (!isClaim) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openClaimFocus();
            }
          }}
          onMouseEnter={() => {
            if (claimFocusActive) return;
            if (sentence.category !== "neutral") {
              setHighlightCategory(sentence.category);
            }
          }}
          onMouseLeave={() => {
            if (claimFocusActive) return;
            setHighlightCategory(null);
          }}
          className={cn(
            "mb-1.5 block rounded-md border-l-2 px-2 py-1 transition-[background-color,box-shadow,opacity,text-decoration-color] duration-200 last:mb-0",
            style.border,
            style.bg,
            (isLit || isFocusedAssertion || isFocusedEvidence || isSpotlight) &&
              "shadow-[0_0_24px_-10px_currentColor] ring-1 ring-current/25",
            isFocusedAssertion && "ring-neon-cyan/40 bg-neon-cyan/15",
            isFocusedEvidence && "ring-neon-emerald/35 bg-neon-emerald/15",
            isSpotlight && "nn-claim-spotlight",
            isClaim && "nn-claim-clickable cursor-pointer underline decoration-neon-cyan/30 underline-offset-4",
          )}
        >
          <MessageMarkdown content={sentence.text} inline className="inline" />
          {unsupported ? (
            <button
              type="button"
              aria-label="Ask for evidence"
              title="Ask for evidence — prefills the composer; you still press Send"
              onClick={requestEvidence}
              className={cn(
                "nn-evidence-demand ml-1.5 inline-flex translate-y-[-1px] items-center justify-center gap-0.5 rounded-full border font-semibold",
                "border-neon-amber/55 bg-neon-amber/18 text-neon-amber outline-none transition",
                "hover:bg-neon-amber/30 focus-visible:ring-[3px] focus-visible:ring-ring",
                evidenceDemandHighlight && isSpotlight && "nn-evidence-demand--lit",
              )}
            >
              <span aria-hidden>?</span>
              <span className="sr-only">Ask for evidence</span>
            </button>
          ) : null}
        </motion.span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">
          {style.label}
          {unsupported ? " · unsupported" : ""}
        </p>
        <p className="text-muted-foreground">
          {isClaim
            ? "Click to inspect · ? prefills an evidence ask (you still Send)"
            : `Structure match ${String(pct)}% · response text only`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

export function AnimatedAnnotatedMessage({
  content,
  analysis: provided,
  className,
}: AnimatedAnnotatedMessageProps) {
  // Prefer the single session-store analysis for the latest finished reply.
  const analysis = useMemo(() => {
    if (provided) return provided;
    return analyzeResponse(content);
  }, [content, provided]);

  if (analysis.sentences.length === 0) {
    return (
      <div
        className={cn(
          "max-w-[85%] rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-foreground/90",
          className,
        )}
      >
        <MessageMarkdown content={content} />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="max-w-[85%] rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-foreground/90">
        {analysis.sentences.map((sentence, index) => (
          <SentenceChip
            key={`${String(sentence.start)}-${String(sentence.end)}`}
            sentence={sentence}
            index={index}
            analysis={analysis}
          />
        ))}
      </div>
      <ReasoningAnatomyBar analysis={analysis} />
    </div>
  );
}
