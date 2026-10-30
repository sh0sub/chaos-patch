import { defaultPatchParams, type PatchParams, type PatchV1 } from "@chaos-patch/schema";

export type Vec2 = { x: number; y: number };

export type Player = Vec2 & {
  radius: number;
  velocityX: number;
};

export type Obstacle = Vec2 & {
  id: number;
  radius: number;
  velocityY: number;
  velocityX: number;
};

type ActivePatchParams = {
  [Key in keyof PatchParams]-?: Exclude<PatchParams[Key], undefined>;
};

export type GameState = {
  width: number;
  height: number;
  player: Player;
  obstacles: Obstacle[];
  score: number;
  elapsed: number;
  spawnAccumulator: number;
  nextObstacleId: number;
  alive: boolean;
  params: ActivePatchParams;
};

export type GameInput = {
  left: boolean;
  right: boolean;
};

export function createGameState(width = 960, height = 640): GameState {
  return {
    width,
    height,
    player: {
      x: width / 2,
      y: height - 72,
      radius: 22,
      velocityX: 0
    },
    obstacles: [],
    score: 0,
    elapsed: 0,
    spawnAccumulator: 0,
    nextObstacleId: 1,
    alive: true,
    params: { ...defaultPatchParams } as ActivePatchParams
  };
}

export function applyPatch(state: GameState, patch: PatchV1): GameState {
  return {
    ...state,
    params: {
      ...state.params,
      ...patch.params
    } as ActivePatchParams
  };
}

export function restartGame(state: GameState): GameState {
  return {
    ...createGameState(state.width, state.height),
    params: { ...state.params }
  };
}

export function resizeGame(state: GameState, width: number, height: number): GameState {
  return {
    ...state,
    width,
    height,
    player: {
      ...state.player,
      x: Math.min(width - state.player.radius, Math.max(state.player.radius, state.player.x)),
      y: height - 72
    }
  };
}

export function stepGame(state: GameState, rawDeltaSeconds: number, input: GameInput, random = Math.random): GameState {
  if (!state.alive) return state;

  const deltaSeconds = Math.min(rawDeltaSeconds, 0.05) * state.params.timeScale;
  const inputDirection = Number(input.right) - Number(input.left);
  const direction = state.params.controlsMirrored ? -inputDirection : inputDirection;
  const iceMultiplier = state.params.floorMode === "ice" ? 0.35 : 1;
  const targetVelocity = direction * 360 * state.params.playerSpeed;
  const velocityX = state.player.velocityX + (targetVelocity - state.player.velocityX) * Math.min(1, deltaSeconds * 12 * iceMultiplier);
  const playerRadius = 22 * state.params.playerScale;
  const playerX = clamp(state.player.x + velocityX * deltaSeconds, playerRadius, state.width - playerRadius);
  const player = { ...state.player, x: playerX, radius: playerRadius, velocityX };

  let spawnAccumulator = state.spawnAccumulator + deltaSeconds;
  let nextObstacleId = state.nextObstacleId;
  const obstacles = state.obstacles.map((obstacle) => {
    const homingDirection = Math.sign(player.x - obstacle.x);
    const homing = homingDirection * 90 * state.params.obstacleHoming;
    let velocityXNext = obstacle.velocityX + (state.params.wind * 30 + homing) * deltaSeconds;
    const rawX = obstacle.x + velocityXNext * deltaSeconds;
    if (
      state.params.bounce > 0 &&
      ((rawX <= obstacle.radius && velocityXNext < 0) || (rawX >= state.width - obstacle.radius && velocityXNext > 0))
    ) {
      velocityXNext *= -(0.6 + state.params.bounce * 0.4);
    }
    return {
      ...obstacle,
      x: clamp(obstacle.x + velocityXNext * deltaSeconds, obstacle.radius, state.width - obstacle.radius),
      y: obstacle.y + obstacle.velocityY * deltaSeconds * state.params.gravity,
      velocityX: velocityXNext
    };
  });

  const spawnEvery = 0.9 / state.params.spawnRate;
  if (spawnAccumulator >= spawnEvery) {
    spawnAccumulator -= spawnEvery;
    const radius = 18 * state.params.obstacleScale;
    obstacles.push({
      id: nextObstacleId,
      x: radius + random() * Math.max(1, state.width - radius * 2),
      y: -radius,
      radius,
      velocityY: 170 + random() * 90,
      velocityX: state.params.wind * 12
    });
    nextObstacleId += 1;
  }

  const activeObstacles = obstacles.filter((obstacle) => obstacle.y < state.height + obstacle.radius);
  const hit = activeObstacles.some((obstacle) => circlesOverlap(player, obstacle));
  const lavaHit = state.params.floorMode === "lava" && Math.abs(player.velocityX) < 8 && state.elapsed > 1.5;

  return {
    ...state,
    player,
    obstacles: activeObstacles,
    score: state.score + deltaSeconds * 10,
    elapsed: state.elapsed + deltaSeconds,
    spawnAccumulator,
    nextObstacleId,
    alive: !hit && !lavaHit
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function circlesOverlap(a: Vec2 & { radius: number }, b: Vec2 & { radius: number }): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distanceSquared = dx * dx + dy * dy;
  const radius = a.radius + b.radius;
  return distanceSquared <= radius * radius;
}
