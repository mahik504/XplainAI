import {
  BaseEdge,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

export type ParticleEdgeData = {
  active?: boolean;
};

export type ParticleFlowEdge = Edge<ParticleEdgeData, "particle">;

function ParticleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<ParticleFlowEdge>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const active = Boolean(data?.active) || selected;
  const stroke = (style?.stroke as string | undefined) ?? "oklch(0.82 0.135 199 / 70%)";
  const strokeWidth = Number(style?.strokeWidth ?? (active ? 2.2 : 1.5));

  return (
    <g className={active ? "nn-edge nn-edge--active" : "nn-edge"}>
      <BaseEdge
        id={id}
        path={edgePath}
        {...(markerEnd ? { markerEnd } : {})}
        style={{
          ...style,
          stroke,
          strokeWidth,
          ...(active
            ? {
                filter:
                  "drop-shadow(0 0 6px color-mix(in oklab, var(--neon-cyan) 65%, transparent))",
              }
            : {}),
        }}
      />
      {active ? (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth + 4}
            strokeOpacity={0.18}
            className="nn-edge-glow"
          />
          <circle r={2.6} className="nn-edge-particle" fill="var(--neon-cyan)">
            <animateMotion dur="1.35s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r={1.8} className="nn-edge-particle nn-edge-particle--lag" fill="var(--neon-violet)">
            <animateMotion
              dur="1.35s"
              begin="0.45s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
          <circle r={1.4} className="nn-edge-particle" fill="oklch(0.95 0.04 197)">
            <animateMotion
              dur="1.35s"
              begin="0.9s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
        </>
      ) : null}
    </g>
  );
}

export const ParticleEdge = memo(ParticleEdgeComponent);
