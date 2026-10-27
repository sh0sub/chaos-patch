import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { patchSchema, type Candidate, type PatchV1 } from "@chaos-patch/schema";
import { env } from "./env";

export async function compileCandidate(candidate: Candidate, nextVersion: number): Promise<PatchV1> {
  if (!env.OPENAI_API_KEY) return fallbackPatch(candidate, nextVersion);

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You compile a viewer's game idea into one safe Emote Dodge patch. Change only the supplied schema fields. Keep the title under 25 characters and each note under 60 characters. Prefer a visually obvious but playable change."
      },
      {
        role: "user",
        content: JSON.stringify({ candidate, nextVersion })
      }
    ],
    text: {
      format: zodTextFormat(patchSchema, "patch_v1")
    }
  });

  if (!response.output_parsed) return fallbackPatch(candidate, nextVersion);
  return patchSchema.parse({ ...response.output_parsed, version: nextVersion, proposer: candidate.proposer });
}

function fallbackPatch(candidate: Candidate, version: number): PatchV1 {
  const lower = `${candidate.title} ${candidate.description}`.toLowerCase();
  if (lower.includes("mirror") || lower.includes("반전")) {
    return patchSchema.parse({
      version,
      title: "Mirror Controls",
      notes: ["Left and right controls are reversed"],
      proposer: candidate.proposer,
      params: { controlsMirrored: true }
    });
  }
  if (lower.includes("lava") || lower.includes("용암")) {
    return patchSchema.parse({
      version,
      title: "Lava Floor",
      notes: ["Keep moving or the floor wins"],
      proposer: candidate.proposer,
      params: { floorMode: "lava", palette: "lava", spawnRate: 1.15 }
    });
  }
  return patchSchema.parse({
    version,
    title: "Giant Emotes",
    notes: ["Obstacles are now 2.4x larger", "Spawn rate reduced for balance"],
    proposer: candidate.proposer,
    params: { obstacleSprite: "emote:PogChamp", obstacleScale: 2.4, spawnRate: 0.82 }
  });
}
