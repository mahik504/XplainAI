import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ChatSkeleton,
  GraphSkeleton,
  SignalsSkeleton,
  SourcesSkeleton,
} from "./index";

describe("Loading Skeletons", () => {
  it("renders ChatSkeleton with correct bubble count", () => {
    render(<ChatSkeleton count={3} />);
    const skeletonEl = screen.getByTestId("chat-skeleton");
    expect(skeletonEl).toBeInTheDocument();
  });

  it("renders SourcesSkeleton with verified source headers", () => {
    render(<SourcesSkeleton count={4} />);
    const skeletonEl = screen.getByTestId("sources-skeleton");
    expect(skeletonEl).toBeInTheDocument();
  });

  it("renders SignalsSkeleton with metric breakdown bars", () => {
    render(<SignalsSkeleton />);
    const skeletonEl = screen.getByTestId("signals-skeleton");
    expect(skeletonEl).toBeInTheDocument();
  });

  it("renders GraphSkeleton with simulated DAG and laser edges", () => {
    render(<GraphSkeleton />);
    const skeletonEl = screen.getByTestId("graph-skeleton");
    expect(skeletonEl).toBeInTheDocument();
  });
});
