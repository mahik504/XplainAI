import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import { ArrowLeft, Workflow } from "lucide-react";
import { useEffect, useMemo } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PanelShell, type PanelProps } from "@/components/common/PanelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StructureLegend } from "@/features/demo";
import { ASSERTION_NODE_ID } from "@/lib/claim-focus";
import { resolveActiveNodeId } from "@/lib/run-graph";
import { cn } from "@/lib/utils";

import { GraphCamera } from "./GraphCamera";
import { ParticleEdge } from "./ParticleEdge";
import { RunNode } from "./RunNode";

interface GraphPanelProps extends PanelProps {
  nodes?: Node[];
  edges?: Edge[];
  interactive?: boolean;
  cameraEnabled?: boolean;
  onNodeClick?: NodeMouseHandler<Node>;
  title?: string;
  description?: string;
  /** Bumps camera fit when pipeline ↔ structure morphs (does not remount ReactFlow). */
  viewKey?: string;
  surface?: "pipeline" | "structure";
  claimFocusActive?: boolean;
  onExitClaimFocus?: () => void;
  /** Hide outer panel chrome when embedded in ExplainabilityPanel. */
  compactChrome?: boolean;
}

const emptyNodes: Node[] = [];
const emptyEdges: Edge[] = [];

export function GraphPanel({
  nodes = emptyNodes,
  edges = emptyEdges,
  interactive = true,
  cameraEnabled = true,
  onNodeClick,
  active,
  className,
  title = "Reasoning Pipeline",
  description = "Live execution surface",
  viewKey = "pipeline",
  surface = "pipeline",
  claimFocusActive = false,
  onExitClaimFocus,
  compactChrome = false,
}: GraphPanelProps) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);
  const nodeTypes = useMemo<NodeTypes>(() => ({ runNode: RunNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ particle: ParticleEdge }), []);

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

  const isEmpty = flowNodes.length === 0;
  const activeNodeId = useMemo(() => resolveActiveNodeId(flowNodes), [flowNodes]);
  const focusNodeId = claimFocusActive ? ASSERTION_NODE_ID : null;

  const body = (
    <>
      {compactChrome && claimFocusActive && onExitClaimFocus ? (
        <div className="absolute top-2 left-2 z-20">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={onExitClaimFocus}
          >
            <ArrowLeft className="size-3" />
            Back
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          "size-full transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          claimFocusActive && "nn-flow--claim-focus",
        )}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          {...(onNodeClick ? { onNodeClick } : {})}
          nodesDraggable={interactive && !claimFocusActive}
          nodesConnectable={false}
          elementsSelectable={interactive}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.32 }}
          minZoom={0.55}
          maxZoom={1.8}
          className="size-full"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.05}
            color="oklch(0.82 0.135 199 / 16%)"
            className="opacity-65"
          />
          {!isEmpty ? (
            <>
              <Controls
                showInteractive={false}
                className="nn-flow-controls overflow-hidden rounded-xl border border-border/70 bg-black/45 shadow-xl backdrop-blur-xl"
              />
              <GraphCamera
                activeNodeId={activeNodeId}
                enabled={cameraEnabled && !isEmpty}
                viewKey={viewKey}
                focusNodeId={focusNodeId}
              />
            </>
          ) : null}
        </ReactFlow>
      </div>

      {isEmpty ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <EmptyState
            icon={Workflow}
            title={
              surface === "structure"
                ? "No explainable structure detected."
                : "Structure appears after a reply"
            }
            description={
              surface === "structure"
                ? "This reply had no classifiable claims, evidence, or reasoning cues. You can still read the message and start a new prompt."
                : "While the model streams, the pipeline tracks the run. When it finishes, this surface morphs into the response structure graph."
            }
          />
        </div>
      ) : null}

      {surface === "structure" && !isEmpty && !compactChrome ? <StructureLegend /> : null}
    </>
  );

  if (compactChrome) {
    return (
      <div className={cn("relative size-full", className)} data-active={active ? "true" : undefined}>
        {body}
      </div>
    );
  }

  return (
    <PanelShell
      icon={Workflow}
      title={title}
      description={description}
      active={active}
      className={className}
      contentClassName="relative"
      actions={
        <div className="flex items-center gap-2">
          {claimFocusActive && onExitClaimFocus ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={onExitClaimFocus}
            >
              <ArrowLeft className="size-3" />
              Back
            </Button>
          ) : null}
          {!isEmpty ? (
            <Badge variant={claimFocusActive ? "cyan" : surface === "structure" ? "emerald" : "violet"}>
              {claimFocusActive ? "Focus" : `${String(flowNodes.length)} nodes`}
            </Badge>
          ) : null}
        </div>
      }
    >
      {body}
    </PanelShell>
  );
}
