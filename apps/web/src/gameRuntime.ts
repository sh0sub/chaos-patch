import { stepGame, type GameInput, type GameState } from "@chaos-patch/game";

export function advanceGameFrame(
  state: GameState,
  deltaSeconds: number,
  input: GameInput,
  paused: boolean,
  random: () => number = Math.random
): GameState {
  return paused ? state : stepGame(state, deltaSeconds, input, random);
}

export function formatRunTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function bestSurvivalSeconds(previousBest: number, completedRun: number): number {
  return Math.max(previousBest, completedRun);
}

export function canRestartRun(alive: boolean, paused: boolean): boolean {
  return !alive && !paused;
}
