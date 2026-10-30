import { describe, expect, it } from "vitest";
import { compileFallbackPatch } from "../src/compiler";

describe("fallback patch compiler", () => {
  it("uses a current Twitch emote for the default giant-emotes patch", () => {
    const patch = compileFallbackPatch({
      id: "candidate-1",
      title: "giant emotes",
      description: "make every obstacle a giant emote",
      proposer: "viewer",
      difficulty: "spicy",
      votes: 4
    }, 2);

    expect(patch.params).toMatchObject({ obstacleSprite: "emote:Kappa", obstacleScale: 2.4 });
  });

  it("scales fallback patches to the configured session intensity", () => {
    const candidate = {
      id: "candidate-1",
      title: "giant emotes",
      description: "make every obstacle a giant emote",
      proposer: "viewer",
      difficulty: "spicy" as const,
      votes: 4
    };

    expect(compileFallbackPatch(candidate, 2, "mild").params.obstacleScale).toBe(1.6);
    expect(compileFallbackPatch(candidate, 2, "chaos").params.obstacleScale).toBe(2.8);
  });
});
