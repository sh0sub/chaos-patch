import { describe, expect, it } from "vitest";
import { recapMetrics, type SessionRecap } from "./recap";

describe("recapMetrics", () => {
  it("turns a session recap into four operator-facing metrics", () => {
    const recap: SessionRecap = {
      round: 3,
      build: 7,
      applied: 2,
      rolledBack: 1,
      activePatch: "Mirror Controls",
      recent: []
    };

    expect(recapMetrics(recap)).toEqual([
      { label: "BUILD", value: "v7" },
      { label: "SHIPPED", value: "2" },
      { label: "ROLLED BACK", value: "1" },
      { label: "ACTIVE", value: "Mirror Controls" }
    ]);
  });
});
