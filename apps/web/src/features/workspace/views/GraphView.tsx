import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minimize2,
} from "lucide-react";
import type { Node, NodeMouseHandler } from "@xyflow/react";

import { hudAudio } from "@/features/audio/audio-sfx";
import { EvidenceConstellation3D, type Graph3DNode, type Graph3DEdge } from "@/features/graph-visualizer/components/EvidenceConstellation3D";
import { GraphPanel } from "@/features/graph-visualizer/components/GraphPanel";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

export interface GraphViewProps {
  className?: string;
}

export function GraphView({ className }: GraphViewProps) {
  const [activeViewMode, setActiveViewMode] = useState<"3d" | "2d">("3d");
  const [selectedNode, setSelectedNode] = useState<Graph3DNode | null>(null);
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("all");

  const domainGraph = useSessionStore((state) => state.domainGraph);
  const domainSources = useSessionStore((state) => state.domainSources);
  const domainEvidence = useSessionStore((state) => state.domainEvidence);
  const domainClaims = useSessionStore((state) => state.domainClaims);
  const graphNodes = useSessionStore((state) => state.graphNodes);
  const graphEdges = useSessionStore((state) => state.graphEdges);
  const selectedNodeId = useSessionStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useSessionStore((state) => state.setSelectedNodeId);

  // Build 3D nodes from domainGraph or fallback from claims/evidence/sources
  const nodes3D: Graph3DNode[] = useMemo(() => {
    if (domainGraph && domainGraph.nodes.length > 0) {
      return domainGraph.nodes.map((n) => ({
        id: n.id,
        type: n.type as any,
        label: n.label,
        description: n.description,
        position_3d: n.position_3d,
        status: n.status,
        cluster: n.cluster,
        metadata: n.metadata,
      }));
    }

    const generated: Graph3DNode[] = [];

    domainClaims.forEach((c) => {
      generated.push({
        id: c.id,
        type: "claim",
        label: `Claim #${c.sentence_index + 1}`,
        description: c.text,
        status: c.status,
      });
    });

    domainEvidence.forEach((e, idx) => {
      generated.push({
        id: e.id,
        type: "evidence",
        label: `Evidence [${idx + 1}]`,
        description: e.text,
        metadata: { source_title: e.source_title, confidence: e.confidence },
      });
    });

    domainSources.forEach((s) => {
      generated.push({
        id: s.id,
        type: "source",
        label: s.title || s.domain,
        description: s.snippet || s.url,
        metadata: { authority_score: s.authority_score, url: s.url },
      });
    });

    return generated;
  }, [domainGraph, domainClaims, domainEvidence, domainSources]);

  // Build 3D edges
  const edges3D: Graph3DEdge[] = useMemo(() => {
    if (domainGraph && domainGraph.edges.length > 0) {
      return domainGraph.edges.map((e) => ({
        id: e.id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        type: (e.type === "contradicts" || e.type === "contradiction" ? "contradicts" : "supports") as any,
        weight: e.weight,
        label: e.label ?? undefined,
      }));
    }

    const generated: Graph3DEdge[] = [];
    domainClaims.forEach((c) => {
      c.evidence_ids.forEach((eviId) => {
        generated.push({
          id: `edge_${eviId}_${c.id}`,
          source_node_id: eviId,
          target_node_id: c.id,
          type: c.status === "contradicted" ? "contradicts" : "supports",
        });
      });
    });

    domainEvidence.forEach((e) => {
      if (e.source_id) {
        generated.push({
          id: `edge_${e.source_id}_${e.id}`,
          source_node_id: e.source_id,
          target_node_id: e.id,
          type: "derived_from" as any,
        });
      }
    });

    return generated;
  }, [domainGraph, domainClaims, domainEvidence]);

  const filteredNodes3D = useMemo(() => {
    if (nodeTypeFilter === "all") return nodes3D;
    return nodes3D.filter((n) => n.type === nodeTypeFilter);
  }, [nodes3D, nodeTypeFilter]);

  const handleNodeClick3D = useCallback((node: Graph3DNode) => {
    hudAudio.playClick(1500);
    setSelectedNode(node);
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const handleNodeClick2D = useCallback<NodeMouseHandler<Node>>((_event, node) => {
    hudAudio.playClick(1500);
    const matched3D = nodes3D.find((n) => n.id === node.id);
    if (matched3D) {
      setSelectedNode(matched3D);
    }
    setSelectedNodeId(node.id);
  }, [nodes3D, setSelectedNodeId]);

  const getNodeTypeBadge = (type: string) => {
    switch (type) {
      case "claim":
        return "bg-cyan-950/80 border-cyan-500/40 text-cyan-300";
      case "evidence":
        return "bg-emerald-950/80 border-emerald-500/40 text-emerald-300";
      case "source":
        return "bg-indigo-950/80 border-indigo-500/40 text-indigo-300";
      case "contradiction":
        return "bg-rose-950/80 border-rose-500/40 text-rose-300";
      default:
        return "bg-amber-950/80 border-amber-500/40 text-amber-300";
    }
  };

  return (
    <div className={cn("relative flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#030712] shadow-2xl", className)}>
      {/* Graph Top Toolbar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#070b16]/80 p-3 backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          {/* 3D vs 2D Mode Switcher */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => {
                hudAudio.playClick(1100);
                setActiveViewMode("3d");
              }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-mono font-medium transition-all",
                activeViewMode === "3d"
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.25)]"
                  : "text-slate-400 hover:text-white"
              )}
            >
              3D Constellation
            </button>
            <button
              type="button"
              onClick={() => {
                hudAudio.playClick(1100);
                setActiveViewMode("2d");
              }}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-mono font-medium transition-all",
                activeViewMode === "2d"
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.25)]"
                  : "text-slate-400 hover:text-white"
              )}
            >
              2D Flow DAG
            </button>
          </div>

          {/* Node Type Filters */}
          <div className="hidden sm:flex items-center gap-1">
            {["all", "claim", "evidence", "source"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  hudAudio.playClick(900);
                  setNodeTypeFilter(type);
                }}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11px] font-mono capitalize transition-all",
                  nodeTypeFilter === type
                    ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-200"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span>{filteredNodes3D.length} Nodes</span>
          <span>•</span>
          <span>{edges3D.length} Relations</span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {activeViewMode === "3d" ? (
          <EvidenceConstellation3D
            nodes={filteredNodes3D}
            edges={edges3D}
            activeNodeId={selectedNodeId}
            onNodeClick={handleNodeClick3D}
            onSwitchTo2D={() => setActiveViewMode("2d")}
            className="size-full"
          />
        ) : (
          <GraphPanel
            nodes={graphNodes}
            edges={graphEdges}
            onNodeClick={handleNodeClick2D}
            className="size-full"
          />
        )}

        {/* Slide-out Node Inspector Sidecar */}
        <AnimatePresence>
          {selectedNode && (
            <motion.aside
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="absolute right-0 top-0 bottom-0 z-30 w-80 max-w-[85vw] border-l border-white/[0.1] bg-[#070b16]/95 p-4 shadow-2xl backdrop-blur-2xl overflow-y-auto space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider",
                      getNodeTypeBadge(selectedNode.type)
                    )}
                  >
                    {selectedNode.type} Node
                  </span>
                  <h4 className="mt-1.5 text-xs font-bold text-white font-mono leading-tight">
                    {selectedNode.label}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Minimize2 className="size-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Description / Content
                </span>
                <p className="rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs leading-relaxed text-slate-200">
                  {selectedNode.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                {selectedNode.status && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                    <span className="text-slate-400">Status</span>
                    <p className="font-bold text-cyan-300 capitalize">{selectedNode.status}</p>
                  </div>
                )}
                {selectedNode.cluster && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                    <span className="text-slate-400">Cluster</span>
                    <p className="font-bold text-indigo-300 capitalize">{selectedNode.cluster}</p>
                  </div>
                )}
              </div>

              {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                <div className="space-y-1.5 border-t border-white/[0.08] pt-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Metadata Attributes
                  </span>
                  <div className="space-y-1">
                    {Object.entries(selectedNode.metadata).map(([key, val]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-[11px] font-mono text-slate-300"
                      >
                        <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</span>
                        <span className="text-cyan-300 truncate max-w-[140px]">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
