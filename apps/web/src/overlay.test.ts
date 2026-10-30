import { describe, expect, it } from "vitest";
import type { BroadcastState } from "@chaos-patch/schema";
import { createApplyPresentation, createOverlayPresentation, createOverlayRail } from "./overlay";

const voteRound: BroadcastState = {
  round: 7,
  version: 6,
  phase: "vote",
  remainingSeconds: 8,
  proposals: [],
  candidates: [
    { id: "1", title: "Lava Floor", description: "The floor is lava", proposer: "mina", difficulty: "spicy", votes: 12 },
    { id: "2", title: "Giant Emotes", description: "Huge Kappa rain", proposer: "kim", difficulty: "chaos", votes: 41 },
    { id: "3", title: "Mirror Controls", description: "Left becomes right", proposer: "tom", difficulty: "mild", votes: 9 }
  ],
  activePatch: null,
  patchHistory: []
};

describe("broadcast overlay presentation", () => {
  it("turns a vote round into three audience-readable choices", () => {
    expect(createOverlayPresentation(voteRound)).toMatchObject({
      phase: "VOTE",
      timer: "00:08",
      instruction: "TYPE 1 · 2 · 3 IN CHAT",
      candidates: [
        { number: 1, title: "Lava Floor", votes: 12, leading: false },
        { number: 2, title: "Giant Emotes", votes: 41, leading: true },
        { number: 3, title: "Mirror Controls", votes: 9, leading: false }
      ]
    });
  });

  it("distinguishes a sole leader from a last-five-second tie", () => {
    const tied = createOverlayPresentation({
      ...voteRound,
      remainingSeconds: 5,
      candidates: voteRound.candidates.map((candidate, index) => ({
        ...candidate,
        votes: index < 2 ? 12 : 4
      }))
    });

    expect(tied.urgent).toBe(true);
    expect(tied.candidates).toMatchObject([
      { leading: false, tied: true },
      { leading: false, tied: true },
      { leading: false, tied: false }
    ]);
  });

  it("builds the artifact side rail in credits, notes, chat order", () => {
    const round: BroadcastState = {
      ...voteRound,
      activePatch: {
        version: 6,
        title: "Giant Emotes",
        proposer: "kim",
        notes: ["Huge Kappa rain"],
        params: { obstacleScale: 2.6 }
      },
      patchHistory: [
        { version: 6, title: "Giant Emotes", proposer: "kim", notes: ["Huge Kappa rain"], params: { obstacleScale: 2.6 }, status: "applied" },
        { version: 5, title: "Wind Gusts", proposer: "mina", notes: ["Push the player"], params: { wind: 1 }, status: "applied" },
        { version: 4, title: "Mirror Controls", proposer: "kim", notes: ["Left becomes right"], params: { controlsMirrored: true }, status: "rolled_back" }
      ]
    };

    expect(createOverlayRail(round, [
      { userName: "night_owl", text: "!patch bigger emotes" },
      { userName: "mina", text: "this is chaos" }
    ])).toEqual({
      sectionOrder: ["credits", "patches", "chat"],
      activeTitles: ["Giant Emotes", "Wind Gusts"],
      credits: [
        { name: "kim", count: 2 },
        { name: "mina", count: 1 }
      ],
      notes: [
        { version: 6, title: "Giant Emotes", status: "applied" },
        { version: 5, title: "Wind Gusts", status: "applied" },
        { version: 4, title: "Mirror Controls", status: "rolled_back" }
      ],
      chat: [
        { userName: "night_owl", text: "!patch bigger emotes" },
        { userName: "mina", text: "this is chaos" }
      ]
    });
  });

  it("presents every applied patch note with vote and round context", () => {
    const round: BroadcastState = {
      ...voteRound,
      phase: "apply",
      activePatch: {
        version: 6,
        title: "Giant Emotes",
        proposer: "kim",
        notes: ["Kappa obstacles enabled", "Obstacle scale raised", "Spawn rate reduced"],
        params: { obstacleSprite: "emote:Kappa", obstacleScale: 2.6, spawnRate: 0.8 }
      }
    };

    expect(createApplyPresentation(round)).toEqual({
      notes: [
        { label: "NEW", text: "Kappa obstacles enabled" },
        { label: "BALANCE", text: "Obstacle scale raised" },
        { label: "BALANCE", text: "Spawn rate reduced" }
      ],
      footer: "41 votes · Round 7"
    });
  });
});
