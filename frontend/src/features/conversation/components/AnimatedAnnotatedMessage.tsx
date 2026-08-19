import { motion } from "framer-motion";
import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

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
  { border: string; bg: string; label: string; text: string }
> = {
  claim: {
    border: "border-l-cyan-400",
    bg: "bg-cyan-950/30",
    label: "Assertion",
    text: "text-cyan-400",
  },
  evidence: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-950/30",
    label: "Empirical Evidence",
    text: "text-emerald-400",
  },
  reasoning: {
    border: "border-l-indigo-500",
    bg: "bg-indigo-950/30",
    label: "Connector",
    text: "text-indigo-400",
  },
  example: {
    border: "border-l-sky-500",
    bg: "bg-sky-950/30",
    label: "Example",
    text: "text-sky-400",
  },
  hedge: {
    border: "border-l-amber-500",
    bg: "bg-amber-950/30",
    label: "Uncertainty / Hedge",
    text: "text-amber-400",
  },
  conclusion: {
    border: "border-l-indigo-400",
    bg: "bg-indigo-950/30",
    label: "Conclusion",
    text: "text-indigo-400",
  },
  neutral: {
    border: "border-l-slate-700",
    bg: "bg-slate-950/20",
    label: "Neutral",
    text: "text-slate-400",
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
  const setInspectorOpen = useUIStore((state) => state.setInspectorOpen);

  useEffect(() => {
    if (!isFocusedAssertion && !isSpotlight) return;
    chipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isFocusedAssertion, isSpotlight]);

  const openClaimFocus = () => {
    if (!isClaim) return;
    const resolved = resolveClaimFocus(analysis, id);
    if (!resolved) return;
    enterClaimFocus(id, resolved.evidenceIds);
    setInspectorOpen(true);
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
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
          className={cn(
            "flex w-full items-start gap-2 rounded-r-md border-l-2 px-2.5 py-1.5 text-left text-xs leading-relaxed transition",
            style.border,
            style.bg,
            (isFocusedAssertion || isSpotlight) && "bg-blue-500/[0.08] ring-1 ring-blue-500/30",
          )}
        >
          <button
            type="button"
            onClick={openClaimFocus}
            disabled={!isClaim}
            className={cn(
              "flex min-w-0 flex-1 items-start gap-2 text-left",
              isClaim && "cursor-pointer hover:opacity-100",
              !isClaim && "cursor-default",
            )}
          >
            <span className={cn("mt-0.5 shrink-0 text-[10px] font-medium uppercase", style.text)}>
              {style.label}
            </span>
            <span className="min-w-0 flex-1 text-foreground/90">{sentence.text}</span>
          </button>
          {unsupported ? (
            <button
              type="button"
              aria-label="Ask for evidence"
              title="Request verifiable evidence for this assertion"
              onClick={requestEvidence}
              className={cn(
                "inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                "border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25",
                evidenceDemandHighlight && isSpotlight && "animate-pulse ring-1 ring-amber-400",
              )}
            >
              ?
            </button>
          ) : null}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium text-xs">{style.label}</p>
        <p className="text-[11px] text-muted-foreground">
          {isClaim
            ? unsupported
              ? "Unverified assertion · Click to inspect evidence in 3D graph · ? requests citations"
              : "Grounded claim · Click to highlight evidence graph"
            : "Observable response sentence classification"}
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
  const [showStructure, setShowStructure] = useState(false);

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
    <div className={cn("w-full space-y-3", className)}>
      {/* Markdown Content (Document reading mode) */}
      <div className="text-[15px] leading-7 text-foreground/90">
        <MessageMarkdown content={content} />
      </div>

      {/* Epistemic Reasoning Structure Breakdown */}
      {structural.length > 0 ? (
        <div className="pt-2 border-t border-border/40">
          <div className="flex items-center justify-between pb-1.5">
            <button
              type="button"
              onClick={() => setShowStructure((prev) => !prev)}
              className="text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              {showStructure ? "Hide reasoning breakdown" : `Show reasoning breakdown (${structural.length} elements)`}
            </button>
          </div>

          {showStructure ? (
            <div className="space-y-1 pt-1">
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
        </div>
      ) : null}

      {analysis.sentences.length > 0 ? <ReasoningAnatomyBar analysis={analysis} /> : null}
    </div>
  );
}

