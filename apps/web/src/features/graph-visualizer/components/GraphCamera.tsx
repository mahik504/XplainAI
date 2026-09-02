import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef } from "react";

interface GraphCameraProps {
  activeNodeId: string | null;
  enabled?: boolean;
  /** When topology surface changes, refit without remounting ReactFlow. */
  viewKey?: string;
  /** Claim Focus Mode — gently center the focused assertion node. */
  focusNodeId?: string | null;
}

export function GraphCamera({
  activeNodeId,
  enabled = true,
  viewKey = "pipeline",
  focusNodeId = null,
}: GraphCameraProps) {
  const { getNode, setCenter, fitView, getZoom } = useReactFlow();
  const lastFocused = useRef<string | null>(null);
  const lastViewKey = useRef<string | null>(null);
  const lastClaimFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    lastFocused.current = null;
    lastClaimFocus.current = null;

    if (viewKey.startsWith("structure") && !viewKey.includes("claim-focus")) {
      void fitView({
        padding: 0.34,
        duration: 720,
        maxZoom: 1.05,
        minZoom: 0.65,
      });
    }
  }, [enabled, fitView, viewKey]);

  useEffect(() => {
    if (!enabled) return;

    if (!focusNodeId) {
      lastClaimFocus.current = null;
      return;
    }

    if (lastClaimFocus.current === focusNodeId) return;
    const node = getNode(focusNodeId);
    if (!node) return;

    lastClaimFocus.current = focusNodeId;
    lastFocused.current = focusNodeId;

    const width = node.measured?.width ?? 140;
    const height = node.measured?.height ?? 64;
    const x = node.position.x + width / 2;
    const y = node.position.y + height / 2;

    void setCenter(x, y, {
      zoom: Math.min(1.12, Math.max(0.88, getZoom())),
      duration: 780,
    });
  }, [enabled, focusNodeId, getNode, getZoom, setCenter]);

  useEffect(() => {
    if (!enabled || !activeNodeId || focusNodeId) return;
    if (lastFocused.current === activeNodeId) return;

    const node = getNode(activeNodeId);
    if (!node) return;

    lastFocused.current = activeNodeId;

    if (activeNodeId === "output") {
      void fitView({
        padding: 0.34,
        duration: 720,
        maxZoom: 1.05,
        minZoom: 0.7,
      });
      return;
    }

    const width = node.measured?.width ?? 120;
    const height = node.measured?.height ?? 44;
    const x = node.position.x + width / 2;
    const y = node.position.y + height / 2;
    const currentZoom = getZoom();
    const targetZoom = Math.min(1.05, Math.max(0.82, currentZoom > 1.2 ? 0.95 : currentZoom));

    void setCenter(x, y, {
      zoom: targetZoom,
      duration: 680,
    });
  }, [activeNodeId, enabled, fitView, focusNodeId, getNode, getZoom, setCenter]);

  return null;
}
