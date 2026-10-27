import { describe, expect, it } from "vitest";
import { patchSchema } from "./index";

describe("patchSchema", () => {
  it("accepts a safe bounded patch", () => {
    const result = patchSchema.parse({
      version: 2,
      title: "Giant Emotes",
      notes: ["Obstacles are now 2.6x larger"],
      proposer: "kim_pog",
      params: { obstacleSprite: "emote:PogChamp", obstacleScale: 2.6 }
    });

    expect(result.params.obstacleScale).toBe(2.6);
  });

  it("rejects parameters outside the safety envelope", () => {
    expect(() =>
      patchSchema.parse({
        version: 2,
        title: "Impossible",
        notes: ["Break the game"],
        proposer: "chaos",
        params: { obstacleScale: 99 }
      })
    ).toThrow();
  });
});
