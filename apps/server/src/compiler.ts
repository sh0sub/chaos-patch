import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { patchSchema, type Candidate, type PatchV1, type SessionSettings } from "@chaos-patch/schema";
import { env } from "./env";

export async function compileCandidate(
  candidate: Candidate,
  nextVersion: number,
  intensity: SessionSettings["intensity"] = "spicy"
): Promise<PatchV1> {
  if (!env.OPENAI_API_KEY) return compileFallbackPatch(candidate, nextVersion, intensity);

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You compile a viewer's game idea into one safe Emote Dodge patch. Change only the supplied schema fields. Keep the title under 25 characters and each note under 60 characters. Prefer a visually obvious but playable change. Respect the supplied intensity: mild must stay easy and subtle, spicy should be obvious but fair, chaos may be dramatic but must remain playable. When using an emote obstacle sprite, use emote:Kappa so the current Twitch asset can be rendered."
      },
      {
        role: "user",
        content: JSON.stringify({ candidate, nextVersion, intensity })
      }
    ],
    text: {
      format: zodTextFormat(patchSchema, "patch_v1")
    }
  });

  if (!response.output_parsed) return compileFallbackPatch(candidate, nextVersion, intensity);
  return patchSchema.parse({ ...response.output_parsed, version: nextVersion, proposer: candidate.proposer });
}

export function compileFallbackPatch(
  candidate: Candidate,
  version: number,
  intensity: SessionSettings["intensity"] = "spicy"
): PatchV1 {
  const profile = {
    mild: { obstacleScale: 1.6, spawnRate: 0.72 },
    spicy: { obstacleScale: 2.4, spawnRate: 0.82 },
    chaos: { obstacleScale: 2.8, spawnRate: 1.05 }
  }[intensity];
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
      params: { floorMode: "lava", palette: "lava", spawnRate: profile.spawnRate }
    });
  }
  return patchSchema.parse({
    version,
    title: "Giant Emotes",
    notes: [`Obstacles are now ${profile.obstacleScale}x larger`, "Spawn rate follows session intensity"],
    proposer: candidate.proposer,
    params: { obstacleSprite: "emote:Kappa", obstacleScale: profile.obstacleScale, spawnRate: profile.spawnRate }
  });
}
