import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EvidenceConstellation3D, type Graph3DNode, type Graph3DEdge } from "./EvidenceConstellation3D";

describe("EvidenceConstellation3D", () => {
  const mockNodes: Graph3DNode[] = [
    {
      id: "node_1",
      type: "claim",
      label: "Quantum Error Correction",
      description: "Surface code threshold is approx 1%",
      position_3d: [0, 0, 0],
    },
    {
      id: "node_2",
      type: "evidence",
      label: "Empirical Threshold",
      description: "Measured 0.7% error rate per physical gate",
      position_3d: [20, 10, 10],
    },
  ];

  const mockEdges: Graph3DEdge[] = [
    {
      id: "edge_1",
      source_node_id: "node_2",
      target_node_id: "node_1",
      type: "supports",
    },
  ];

  it("handles WebGL context loss or absence gracefully with fallback UI", () => {
    const onSwitchTo2D = vi.fn();
    const onContextLost = vi.fn();

    render(
      <EvidenceConstellation3D
        nodes={mockNodes}
        edges={mockEdges}
        onSwitchTo2D={onSwitchTo2D}
        onContextLost={onContextLost}
      />
    );

    // In jsdom without native GPU, renders context fallback or canvas
    const alertElement = screen.queryByRole("alert");
    if (alertElement) {
      expect(screen.getByText("WebGL Context Interrupted")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: /Retry 3D Canvas/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);

      const switchBtn = screen.getByRole("button", { name: /Switch to 2D Flow/i });
      expect(switchBtn).toBeInTheDocument();
      fireEvent.click(switchBtn);
      expect(onSwitchTo2D).toHaveBeenCalledTimes(1);
    } else {
      expect(screen.getByTitle("Reset Camera Angle")).toBeInTheDocument();
    }
  });

  it("unmounts cleanly and disposes resources without throwing", () => {
    const { unmount } = render(
      <EvidenceConstellation3D nodes={mockNodes} edges={mockEdges} />
    );

    expect(() => unmount()).not.toThrow();
  });
});
