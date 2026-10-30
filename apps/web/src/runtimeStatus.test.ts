import { describe, expect, it } from "vitest";
import { runtimeStatusPresentation } from "./runtimeStatus";

describe("runtime status presentation", () => {
  it("formats the M2 status bar fields", () => {
    expect(runtimeStatusPresentation({
      round: 4,
      phase: "vote",
      remainingSeconds: 9,
      version: 3,
      chatMessagesPerMinute: 12,
      lastCompileMs: 842
    })).toEqual({
      round: "ROUND 4",
      phase: "VOTE 00:09",
      version: "v3.0",
      chatRate: "12 msg/min",
      llmLatency: "842 ms"
    });
    expect(runtimeStatusPresentation({
      round: 0,
      phase: "idle",
      remainingSeconds: 0,
      version: 1,
      chatMessagesPerMinute: 0,
      lastCompileMs: null
    }).llmLatency).toBe("— ms");
  });
});
