import { describe, expect, it } from "vitest";
import { createGameState } from "@chaos-patch/game";
import { advanceGameFrame, bestSurvivalSeconds, canRestartRun, formatRunTime } from "./gameRuntime";

describe("game runtime", () => {
  it("freezes the current run outside the PLAY phase", () => {
    const state = createGameState();

    const frozen = advanceGameFrame(state, 0.5, { left: false, right: false }, true, () => 0.5);
    const playing = advanceGameFrame(state, 0.5, { left: false, right: false }, false, () => 0.5);

    expect(frozen).toBe(state);
    expect(playing.elapsed).toBeGreaterThan(state.elapsed);
  });

  it("formats survival time and keeps the longest completed run", () => {
    expect(formatRunTime(41.9)).toBe("00:41");
    expect(formatRunTime(125)).toBe("02:05");
    expect(bestSurvivalSeconds(51, 42)).toBe(51);
    expect(bestSurvivalSeconds(51, 68)).toBe(68);
  });

  it("only allows restart after a run ends while gameplay is active", () => {
    expect(canRestartRun(false, false)).toBe(true);
    expect(canRestartRun(false, true)).toBe(false);
    expect(canRestartRun(true, false)).toBe(false);
  });
});
