import { describe, expect, it } from "vitest";
import { patchHistoryPresentation } from "./patchHistory";

describe("patch history presentation", () => {
  it("shows knob changes against the previously active build with safety evidence", () => {
    const rows = patchHistoryPresentation([
      { version: 3, title: "Giant Emotes", proposer: "kim", notes: ["Huge Kappas"], params: { obstacleScale: 2.6 }, status: "applied" },
      { version: 2, title: "Wind Gust", proposer: "mina", notes: ["Wind rises"], params: { wind: 1 }, status: "applied" }
    ]);

    expect(rows[0]).toMatchObject({
      version: 3,
      diffs: [
        { knob: "obstacle.scale", before: "1.0", after: "2.6" },
        { knob: "wind", before: "1.0", after: "0.0" }
      ],
      safety: ["schema strict", "allowed knobs", "blocked terms", "rollback watch"]
    });
    expect(rows[1]?.diffs).toEqual([{ knob: "wind", before: "0.0", after: "1.0" }]);
  });
});
