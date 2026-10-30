import { describe, expect, it } from "vitest";
import type { Proposal } from "@chaos-patch/schema";
import { compressProposalsFallback, materializeCandidateSummaries } from "../src/candidateCompressor";

const proposal = (id: string, userName: string, text: string): Proposal => ({
  id,
  userId: `user-${id}`,
  userName,
  text,
  createdAt: "2026-10-29T00:00:00.000Z"
});

describe("candidate compressor", () => {
  it("deduplicates similar pitch text and always returns three vote choices", () => {
    const candidates = compressProposalsFallback([
      proposal("1", "mina", "Giant Emotes"),
      proposal("2", "kim", "  giant   emotes "),
      proposal("3", "tom", "Lava Floor")
    ]);

    expect(candidates).toHaveLength(3);
    expect(candidates.map(({ title, proposer }) => [title, proposer])).toEqual([
      ["Giant Emotes", "mina"],
      ["Lava Floor", "tom"],
      ["Mirror Controls", "chat"]
    ]);
  });

  it("maps AI summaries back to the viewers who proposed them", () => {
    const proposals = [
      proposal("1", "mina", "make the floor lava"),
      proposal("2", "kim", "huge falling Kappas"),
      proposal("3", "tom", "reverse left and right")
    ];

    const candidates = materializeCandidateSummaries(proposals, [
      { sourceProposalId: "2", title: "Kappa Storm", description: "Giant emotes fill the arena", difficulty: "chaos" },
      { sourceProposalId: "1", title: "Lava Floor", description: "Stopping becomes dangerous", difficulty: "spicy" },
      { sourceProposalId: "3", title: "Mirror Mode", description: "Left and right are reversed", difficulty: "mild" }
    ]);

    expect(candidates.map(({ title, proposer }) => [title, proposer])).toEqual([
      ["Kappa Storm", "kim"],
      ["Lava Floor", "mina"],
      ["Mirror Mode", "tom"]
    ]);
  });
});
