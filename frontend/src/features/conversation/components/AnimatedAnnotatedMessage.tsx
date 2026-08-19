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
    border: "border-l-amber-400",
    bg: "bg-amber-400/10",
    label: "Assertion",
  },
  evidence: {
    border: "border-l-emerald-400",
    bg: "bg-emerald-400/10",
    label: "Empirical Evidence",
  },
  reasoning: {
    border: "border-l-indigo-400",
    bg: "bg-indigo-400/10",
    label: "Connector",
  },
  example: {
    border: "border-l-orange-400",
    bg: "bg-orange-400/10",
    label: "Example",
  },
  hedge: {
    border: "border-l-amber-300",
    bg: "bg-amber-300/10",
    label: "Uncertainty",
  },
  conclusion: {
    border: "border-l-rose-400",
    bg: "bg-rose-400/10",
    label: "Conclusion",
  },
  neutral: {
    border: "border-l-zinc-700",
    bg: "bg-white/[0.02]",
    label: "Neutral",
  },
};

interface AnimatedAnnotatedMessageProps {
  content: string;
  /** Prefer store analysis for the latest finished response when content matches. */
  analysis?: ResponseStructureAnalysis | null;
  className?: string;
  sourcesLinked?: number;
}

const StructureChip = memo(function StructureChip({
  sentence,
  index,
  analysis,
  sourcesLinked = 0,
}: {
  sentence: ClassifiedSentence;
  index: number;
  analysis: ResponseStructureAnalysis;
  sourcesLinked?: number;
}) {
  const style = CATEGORY_STYLE[sentence.category];
  const id = sentenceId(sentence);
  const chipRef = useRef<HTMLDivElement>(null);
  const isClaim = sentence.category === "claim";
  const unsupported = isClaim && isUnsupportedAssertion(analysis, id);

  const isFocusedAssertion = useUIStore((state) => state.focusedAssertionId === id);
  const isSpotlight = useUIStore((state) => state.spotlightAssertionId === id);
  const evidenceDemandHighlight = useUIStore((state) => state.evidenceDemandHighlight);
  const enterClaimFocus = useUIStore((state) => state.enterClaimFocus);
  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
  const setEvidenceDemandHighlight = useUIStore((state) => state.setEvidenceDemandHighlight);

  useEffect(() => {
    if (!isFocusedAssertion && !isSpotlight) return;
    chipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isFocusedAssertion, isSpotlight]);

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

  if (sentence.category === "neutral" || sentence.category === "example") {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          ref={chipRef}
          data-sentence-id={id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.28) }}
          className={cn(
            "flex w-full items-start gap-2 rounded-md border-l-2 px-2 py-1.5 text-left text-[12px] leading-snug transition",
            style.border,
            style.bg,
            (isFocusedAssertion || isSpotlight) && "ring-1 ring-neon-cyan/35",
          )}
        >
          <button
            type="button"
            onClick={openClaimFocus}
            disabled={!isClaim}
            className={cn(
              "flex min-w-0 flex-1 items-start gap-2 text-left",
              isClaim && "cursor-pointer hover:opacity-95",
              !isClaim && "cursor-default",
            )}
          >
            <span className="mt-0.5 shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
              {style.label}
            </span>
            <span className="min-w-0 flex-1 text-foreground/90">{sentence.text}</span>
          </button>
          {unsupported ? (
            <button
              type="button"
              aria-label="Ask for evidence"
              title="Ask for evidence — prefills the composer; you still press Send"
              onClick={requestEvidence}
              className={cn(
                "nn-evidence-demand inline-flex size-5 shrink-0 items-center justify-center rounded-full border font-semibold",
                "border-neon-amber/55 bg-neon-amber/18 text-neon-amber",
                evidenceDemandHighlight && isSpotlight && "nn-evidence-demand--lit",
              )}
            >
              ?
            </button>
          ) : null}
          {isClaim && sourcesLinked === 0 && unsupported ? (
            <span className="sr-only">No retrieved source linked</span>
          ) : null}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{style.label}</p>
        <p className="text-muted-foreground">
          {isClaim
            ? unsupported
              ? "Inspect claim · No retrieved source linked · ? asks for evidence"
              : "Inspect claim — syncs chat, graph, and signals"
            : "Observable response structure — not factual verification"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

export function AnimatedAnnotatedMessage({
  content,
  analysis: provided,
  className,
  sourcesLinked = 0,
}: AnimatedAnnotatedMessageProps) {
  const analysis = useMemo(() => {
    if (provided) return provided;
    return analyzeResponse(content);
  }, [content, provided]);

  const structural = analysis.sentences.filter(
    (sentence) =>
      sentence.category === "claim" ||
      sentence.category === "evidence" ||
      sentence.category === "reasoning" ||
      sentence.category === "hedge" ||
      sentence.category === "conclusion",
  );

  return (
    <div className={cn("w-full", className)}>
      {/* DISPLAY MARKDOWN — first-class assistant rendering */}
      <div className="max-w-[85%] rounded-xl border border-border bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-foreground/90">
        <MessageMarkdown content={content} />
      </div>

      {/* ANALYZED STRUCTURE — separate from display markdown */}
      {structural.length > 0 ? (
        <div className="mt-2 max-w-[85%] space-y-1.5 rounded-xl border border-border/50 bg-black/20 px-2 py-2">
          <p className="px-1 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Observable response structure
          </p>
          {structural.map((sentence, index) => (
            <StructureChip
              key={`${String(sentence.start)}-${String(sentence.end)}`}
              sentence={sentence}
              index={index}
              analysis={analysis}
              sourcesLinked={sourcesLinked}
            />
          ))}
        </div>
      ) : null}

      {analysis.sentences.length > 0 ? <ReasoningAnatomyBar analysis={analysis} /> : null}
    </div>
  );
}
