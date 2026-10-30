import { defaultPatchParams, type PatchParams, type PatchV1 } from "@chaos-patch/schema";

type PatchHistoryEntry = PatchV1 & { status: "applied" | "rolled_back" };

const knobNames: Partial<Record<keyof PatchParams, string>> = {
  playerScale: "player.scale",
  playerSpeed: "player.speed",
  controlsMirrored: "controls.mirrored",
  obstacleSprite: "obstacle.sprite",
  obstacleScale: "obstacle.scale",
  spawnRate: "spawn.rate",
  floorMode: "floor.mode",
  cameraShake: "camera.shake",
  timeScale: "time.scale",
  obstacleHoming: "obstacle.homing",
  invertColors: "colors.inverted",
  labelPlayer: "label.player",
  labelTitle: "label.title"
};

const safety = ["schema strict", "allowed knobs", "blocked terms", "rollback watch"] as const;

export function patchHistoryPresentation(history: PatchHistoryEntry[]) {
  return history.map((entry, index) => {
    const previous = history.slice(index + 1).find((candidate) => candidate.status === "applied");
    const before = { ...defaultPatchParams, ...previous?.params };
    const after = { ...defaultPatchParams, ...entry.params };
    const diffs = (Object.keys(defaultPatchParams) as Array<keyof PatchParams>).flatMap((key) => {
      if (before[key] === after[key]) return [];
      return [{ knob: knobNames[key] ?? key, before: formatKnobValue(before[key]), after: formatKnobValue(after[key]) }];
    });
    return { ...entry, diffs, safety: [...safety] };
  });
}

function formatKnobValue(value: unknown): string {
  if (typeof value === "number") return value.toFixed(1);
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}
