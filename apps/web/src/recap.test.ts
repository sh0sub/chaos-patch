import { describe, expect, it } from "vitest";
import { recapMetrics, recapShareMessage, type SessionRecap } from "./recap";

describe("recapMetrics", () => {
  it("turns a session recap into four operator-facing metrics", () => {
    const recap: SessionRecap = {
      round: 3,
      build: 7,
      applied: 2,
      rolledBack: 1,
      activePatch: "Mirror Controls",
      patchCount: 2,
      contributorCount: 2,
      sessionDate: "2026-10-31",
      broadcaster: null,
      recent: [],
      topPatches: [],
      timeline: [],
      credits: []
    };

    expect(recapMetrics(recap)).toEqual([
      { label: "BUILD", value: "v7" },
      { label: "SHIPPED", value: "2" },
      { label: "ROLLED BACK", value: "1" },
      { label: "ACTIVE", value: "Mirror Controls" }
    ]);
  });

  it("formats the public recap announcement", () => {
    expect(recapShareMessage({
      round: 3,
      build: 7,
      applied: 2,
      rolledBack: 1,
      activePatch: "Mirror Controls",
      patchCount: 3,
      contributorCount: 2,
      sessionDate: "2026-10-31",
      broadcaster: null,
      recent: [],
      topPatches: [],
      timeline: [],
      credits: []
    }, "https://example.test/recap")).toBe("Chaos Patch recap: 3 patches by 2 contributors — https://example.test/recap");
  });
});
