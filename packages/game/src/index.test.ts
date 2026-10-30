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

  it("reflects patched obstacles from arena walls", () => {
    const base = applyPatch(createGameState(300, 300), {
      version: 2,
      title: "Pinball Rain",
      notes: ["Obstacles bounce from walls"],
      proposer: "chat",
      params: { bounce: 1 }
    });
    const state = {
      ...base,
      obstacles: [{ id: 1, x: 281, y: 40, radius: 18, velocityY: 170, velocityX: 100 }]
    };

    const next = stepGame(state, 0.05, { left: false, right: false }, () => 0.5);

    expect(next.obstacles[0]?.velocityX).toBeLessThan(0);
    expect(next.obstacles[0]?.x).toBeLessThanOrEqual(282);
  });
});
