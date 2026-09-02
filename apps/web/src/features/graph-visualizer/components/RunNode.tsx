import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  FileText,
  Link2,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { memo } from "react";

import type { StructureNodeKind } from "@/lib/response-graph";
import type { RunNodeTone } from "@/lib/run-graph";
import { cn } from "@/lib/utils";
import type { ResponseStructureCategory } from "@/lib/xai";
import { useUIStore } from "@/stores/ui-store";

export type RunFlowNode = Node<
  {
    label: string;
    tone: RunNodeTone;
    subtitle?: string;
    structureKind?: StructureNodeKind;
    structureCategory?: ResponseStructureCategory | "meta";
    count?: number;
    confidence?: number;
    emptySupport?: boolean;
    focusActive?: boolean;
    focusRole?: "assertion" | "evidence" | "context" | "dimmed";
  },
  "runNode"
>;

const STRUCTURE_ICONS: Record<StructureNodeKind, LucideIcon> = {
  question: MessageCircleQuestion,
  response: FileText,
  assertion: ShieldCheck,
  evidence: Sparkles,
  connector: Waypoints,
  uncertainty: TriangleAlert,
  conclusion: Link2,
};

function RunNodeComponent({ data, selected }: NodeProps<RunFlowNode>) {
  const structureKind = data.structureKind;
  const structureCategory = data.structureCategory;
  const focusActive = Boolean(data.focusActive);
  const emptySupport = Boolean(data.emptySupport);
  const isHighlighted = useUIStore((state) =>
    !focusActive && structureCategory ? state.highlightCategory === structureCategory : false,
  );
  const setHighlightCategory = useUIStore((state) => state.setHighlightCategory);
  const Icon = structureKind ? STRUCTURE_ICONS[structureKind] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{
        opacity: 1,
        scale: selected || isHighlighted || data.focusRole === "assertion" ? 1.05 : 1,
        y: 0,
      }}
      transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.85 }}
      onMouseEnter={() => {
        if (focusActive) return;
        if (structureCategory && structureCategory !== "meta") {
          setHighlightCategory(structureCategory);
        }
      }}
      onMouseLeave={() => {
        if (focusActive) return;
        if (structureCategory && structureCategory !== "meta") {
          setHighlightCategory(null);
        }
      }}
      className={cn(
        "nn-node",
        `nn-node--${data.tone}`,
        structureKind && `nn-node--structure-${structureKind}`,
        selected && "nn-node--selected",
        isHighlighted && "nn-node--structure-lit",
        data.focusRole === "assertion" && "nn-node--claim-focus",
        structureKind === "assertion" && "nn-node--assertion-clickable",
        data.tone === "active" && "nn-node--pulse",
      )}
    >
      {emptySupport ? (
        <span className="nn-node__empty-support" aria-hidden>
          <svg viewBox="0 0 120 120" className="nn-node__empty-arc">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="5 6"
              className="nn-node__empty-arc-path"
            />
          </svg>
          <span className="nn-node__empty-label">No supporting evidence detected</span>
        </span>
      ) : null}
      {data.tone === "active" ? <span className="nn-node__halo" aria-hidden /> : null}
      <Handle type="target" position={Position.Left} className="nn-handle" />
      <span className="nn-node__body">
        {Icon ? (
          <span className="nn-node__icon" aria-hidden>
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <span className="nn-node__label">{data.label}</span>
        {data.subtitle ? <span className="nn-node__subtitle">{data.subtitle}</span> : null}
        {typeof data.count === "number" && data.count > 0 ? (
          <span className="nn-node__meta">{String(data.count)}</span>
        ) : null}
      </span>
      <Handle type="source" position={Position.Right} className="nn-handle" />
    </motion.div>
  );
}

export const RunNode = memo(RunNodeComponent);
