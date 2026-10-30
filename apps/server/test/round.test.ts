import { describe, expect, it } from "vitest";
import { RoundStore } from "../src/round";

const patch = (version: number, title: string) => ({
  version,
  title,
  notes: [`${title} notes`],
  proposer: "viewer",
  params: { playerSpeed: 1.2 }
});

describe("RoundStore", () => {
  it("uses the configured PLAY duration for the next round", () => {
    const store = new RoundStore();

    store.configure({ intensity: "mild", playSeconds: 75, blockedTerms: [] });

    expect(store.start()).toMatchObject({ phase: "play", remainingSeconds: 75 });
    expect(store.settingsSnapshot()).toEqual({ intensity: "mild", playSeconds: 75, blockedTerms: [] });
  });

  it("filters pitch ideas that contain a configured blocked term", () => {
    const store = new RoundStore();
    store.configure({ intensity: "spicy", playSeconds: 60, blockedTerms: ["private info"] });
    store.start();
    store.advance();

    expect(store.addProposal("1", "viewer", "!patch show private info")).toBeNull();
    expect(store.addProposal("2", "viewer", "!patch giant emotes")?.text).toBe("giant emotes");
  });

  it("enters vote with candidates compressed from the current pitch", () => {
    const store = new RoundStore();
    store.start();
    store.advance();
    store.addProposal("1", "viewer", "!patch giant emotes");
    const compressed = [
      { id: "ai-1", title: "Emote Storm", description: "Kappa rain gets huge", proposer: "viewer", difficulty: "chaos" as const, votes: 0 }
    ];

    const vote = store.advance(compressed);

    expect(vote.phase).toBe("vote");
    expect(vote.candidates).toEqual(compressed);
  });

  it("runs through play, pitch and vote with proposals", () => {
    const store = new RoundStore();
    expect(store.start().phase).toBe("play");
    expect(store.advance().phase).toBe("pitch");
    expect(store.addProposal("1", "viewer", "!patch giant emotes")?.text).toBe("giant emotes");
    expect(store.advance().phase).toBe("vote");
    expect(store.snapshot().candidates).toHaveLength(3);
    expect(store.vote("1", 1).candidates[0]?.votes).toBe(1);
  });

  it("moves through timed phases", () => {
    const store = new RoundStore();
    store.start();
    for (let index = 0; index < 60; index += 1) store.tick();
    expect(store.snapshot().phase).toBe("pitch");
    for (let index = 0; index < 30; index += 1) store.tick();
    expect(store.snapshot()).toMatchObject({ phase: "pitch", remainingSeconds: 0 });
    store.advance();
    expect(store.snapshot().phase).toBe("vote");
    for (let index = 0; index < 20; index += 1) store.tick();
    expect(store.snapshot().phase).toBe("play");
    expect(store.snapshot().round).toBe(2);
  });

  it("only enters compile when chat cast a vote", () => {
    const store = new RoundStore();
    store.start();
    store.advance();
    store.addProposal("1", "viewer", "!patch giant emotes");
    store.advance();
    store.vote("1", 1);
    for (let index = 0; index < 20; index += 1) store.tick();
    expect(store.snapshot().phase).toBe("compile");
  });

  it("rolls back a failed patch to the previously applied patch", () => {
    const store = new RoundStore();
    store.apply(patch(2, "Fast feet"));
    store.apply(patch(3, "Too much chaos"));

    const result = store.rollback(3);

    expect(result?.patch.version).toBe(3);
    expect(result?.round.activePatch?.version).toBe(2);
    expect(result?.round.version).toBe(3);
    expect(result?.round.patchHistory.map(({ version, status }) => [version, status])).toEqual([
      [3, "rolled_back"],
      [2, "applied"]
    ]);
  });

  it("returns to vanilla and ignores stale rollback reports", () => {
    const store = new RoundStore();
    store.apply(patch(2, "First patch"));

    expect(store.rollback(99)).toBeNull();
    expect(store.rollback(2)?.round.activePatch).toBeNull();
    expect(store.snapshot().patchHistory[0]?.status).toBe("rolled_back");
  });
});
