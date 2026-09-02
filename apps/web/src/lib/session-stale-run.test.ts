import { describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";

const base = { id: "f1", seq: 1, ts: new Date().toISOString() };

describe("stale run ignore", () => {
  it("ignores tokens and finished frames for ignored run ids", () => {
    useSessionStore.setState({
      activeRunId: "run-new",
      ignoredRunIds: ["run-old"],
      messages: [{ id: "a1", role: "assistant", content: "current" }],
      isStreaming: true,
      phase: "streaming",
      retrievedSources: [],
    });

    useSessionStore.getState().applyFrame({
      ...base,
      type: "run.token",
      run_id: "run-old",
      delta: " STALE",
    });

    expect(useSessionStore.getState().messages.at(-1)?.content).toBe("current");

    useSessionStore.getState().applyFrame({
      ...base,
      id: "f2",
      seq: 2,
      type: "run.finished",
      run_id: "run-old",
      finish_reason: "stop",
      usage: null,
      orchestration: {
        sources: [{ source_id: "s1", title: "x", tool: "web_search", source_type: "web" }],
      },
    });

    expect(useSessionStore.getState().retrievedSources).toHaveLength(0);
  });
});
