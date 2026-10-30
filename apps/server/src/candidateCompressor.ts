import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { candidateSchema, type Candidate, type Proposal } from "@chaos-patch/schema";
import { env } from "./env";

const seedIdeas = [
  { id: "seed-1", userName: "chat", text: "Giant Emotes" },
  { id: "seed-2", userName: "chat", text: "Mirror Controls" },
  { id: "seed-3", userName: "chat", text: "Lava Floor" }
];

export type CandidateSummary = {
  sourceProposalId: string;
  title: string;
  description: string;
  difficulty: "mild" | "spicy" | "chaos";
};

const candidateSummarySchema = z.object({
  candidates: z.array(z.object({
    sourceProposalId: z.string().min(1),
    title: z.string().trim().min(1).max(25),
    description: z.string().trim().min(1).max(60),
    difficulty: z.enum(["mild", "spicy", "chaos"])
  }).strict()).min(1).max(3)
}).strict();

export async function compressProposals(proposals: Proposal[]): Promise<Candidate[]> {
  if (!env.OPENAI_API_KEY || proposals.length === 0) return compressProposalsFallback(proposals);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "Compress Twitch chat game-patch proposals into at most three distinct, safe, audience-readable vote choices. Merge duplicates and near-duplicates, discard harassment, sexual content, personal data, self-harm, gambling, and ideas that cannot be represented as bounded Emote Dodge parameters. Use only sourceProposalId values from the input. Keep titles under 25 characters and descriptions under 60 characters. Preserve the strongest visual intent."
      },
      {
        role: "user",
        content: JSON.stringify({ proposals: proposals.map(({ id, userName, text }) => ({ id, userName, text })) })
      }
    ],
    text: { format: zodTextFormat(candidateSummarySchema, "candidate_summary") }
  });
  return response.output_parsed
    ? materializeCandidateSummaries(proposals, response.output_parsed.candidates)
    : compressProposalsFallback(proposals);
}

export function compressProposalsFallback(proposals: Proposal[]): Candidate[] {
  const unique = new Map<string, Pick<Proposal, "id" | "userName" | "text">>();
  for (const proposal of proposals) {
    const key = normalizeIdea(proposal.text);
    if (key && !unique.has(key)) unique.set(key, proposal);
  }
  for (const seed of seedIdeas) {
    const key = normalizeIdea(seed.text);
    if (!unique.has(key)) unique.set(key, seed);
  }
  return Array.from(unique.values()).slice(0, 3).map((proposal, index) => candidateSchema.parse({
    id: proposal.id,
    title: proposal.text.trim().slice(0, 25),
    description: proposal.text.trim().slice(0, 60),
    proposer: proposal.userName,
    difficulty: (["mild", "spicy", "chaos"] as const)[index] ?? "spicy",
    votes: 0
  }));
}

export function materializeCandidateSummaries(proposals: Proposal[], summaries: CandidateSummary[]): Candidate[] {
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const usedSources = new Set<string>();
  const candidates = summaries.flatMap((summary, index) => {
    const source = proposalsById.get(summary.sourceProposalId);
    if (!source || usedSources.has(source.id)) return [];
    usedSources.add(source.id);
    return [candidateSchema.parse({
      id: `ai-${index + 1}-${source.id}`,
      title: summary.title,
      description: summary.description,
      proposer: source.userName,
      difficulty: summary.difficulty,
      votes: 0
    })];
  });
  const usedTitles = new Set(candidates.map(({ title }) => normalizeIdea(title)));
  for (const fallback of compressProposalsFallback(proposals)) {
    if (candidates.length >= 3) break;
    if (usedTitles.has(normalizeIdea(fallback.title))) continue;
    usedTitles.add(normalizeIdea(fallback.title));
    candidates.push(fallback);
  }
  return candidates.slice(0, 3);
}

function normalizeIdea(text: string): string {
  return text.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
