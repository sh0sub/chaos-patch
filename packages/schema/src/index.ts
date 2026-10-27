import { z } from "zod";

const boundedNumber = (min: number, max: number) => z.number().min(min).max(max);

export const patchParamsSchema = z
  .object({
    gravity: boundedNumber(0.2, 3).optional(),
    playerScale: boundedNumber(0.5, 3).optional(),
    playerSpeed: boundedNumber(0.5, 3).optional(),
    controlsMirrored: z.boolean().optional(),
    obstacleSprite: z
      .string()
      .regex(/^(circle|square|emote:[A-Za-z0-9_]{1,32})$/)
      .optional(),
    obstacleScale: boundedNumber(0.5, 3).optional(),
    spawnRate: boundedNumber(0.35, 3).optional(),
    wind: boundedNumber(-2, 2).optional(),
    floorMode: z.enum(["normal", "lava", "ice"]).optional(),
    cameraShake: boundedNumber(0, 1).optional(),
    fog: boundedNumber(0, 0.85).optional(),
    palette: z.enum(["default", "neon", "lava", "ice", "mono"]).optional(),
    timeScale: boundedNumber(0.5, 1.8).optional(),
    bounce: boundedNumber(0, 1).optional(),
    obstacleHoming: boundedNumber(0, 1).optional(),
    invertColors: z.boolean().optional(),
    labelPlayer: z.string().trim().min(1).max(24).optional(),
    labelTitle: z.string().trim().min(1).max(36).optional()
  })
  .strict();

export const patchSchema = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(25),
    notes: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
    proposer: z.string().trim().min(1).max(25),
    params: patchParamsSchema
  })
  .strict();

export const candidateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(25),
    description: z.string().trim().min(1).max(60),
    proposer: z.string().trim().min(1).max(25),
    difficulty: z.enum(["mild", "spicy", "chaos"]),
    votes: z.number().int().min(0)
  })
  .strict();

export const proposalSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    userName: z.string().trim().min(1).max(25),
    text: z.string().trim().min(1).max(120),
    createdAt: z.string().datetime()
  })
  .strict();

export const roundPhaseSchema = z.enum(["idle", "play", "pitch", "vote", "compile", "apply"]);

export type PatchParams = z.infer<typeof patchParamsSchema>;
export type PatchV1 = z.infer<typeof patchSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type RoundPhase = z.infer<typeof roundPhaseSchema>;

export type BroadcastState = {
  round: number;
  version: number;
  phase: RoundPhase;
  remainingSeconds: number;
  proposals: Proposal[];
  candidates: Candidate[];
  activePatch: PatchV1 | null;
  patchHistory: Array<PatchV1 & { status: "applied" | "rolled_back" }>;
};

export const defaultPatchParams: Required<PatchParams> = {
  gravity: 1,
  playerScale: 1,
  playerSpeed: 1,
  controlsMirrored: false,
  obstacleSprite: "circle",
  obstacleScale: 1,
  spawnRate: 1,
  wind: 0,
  floorMode: "normal",
  cameraShake: 0,
  fog: 0,
  palette: "default",
  timeScale: 1,
  bounce: 0,
  obstacleHoming: 0,
  invertColors: false,
  labelPlayer: "STREAMER",
  labelTitle: "EMOTE DODGE"
};
