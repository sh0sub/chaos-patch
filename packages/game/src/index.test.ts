import { describe, expect, it } from "vitest";
import { applyPatch, createGameState, stepGame } from "./index";

describe("game engine", () => {
  it("moves the player and respects mirrored controls", () => {
    const base = createGameState();
    const normal = stepGame(base, 0.05, { left: false, right: true }, () => 0.5);
    const mirrored = stepGame(
      applyPatch(base, {
        version: 2,
        title: "Mirror Controls",
        notes: ["Left is right"],
        proposer: "chat",
        params: { controlsMirrored: true }
      }),
      0.05,
      { left: false, right: true },
      () => 0.5
    );

    expect(normal.player.x).toBeGreaterThan(base.player.x);
    expect(mirrored.player.x).toBeLessThan(base.player.x);
  });

  it("spawns obstacles according to the patch rate", () => {
    let state = createGameState();
    for (let index = 0; index < 20; index += 1) {
      state = stepGame(state, 0.05, { left: false, right: false }, () => 0.5);
    }
    expect(state.obstacles).toHaveLength(1);
  });
});
