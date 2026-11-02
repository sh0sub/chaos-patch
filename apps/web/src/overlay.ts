import type { BroadcastState, PatchV1 } from "@chaos-patch/schema";

type ChatLine = { userName: string; text: string };

const instructions: Record<BroadcastState["phase"], string> = {
  idle: "SESSION STANDBY",
  play: "SURVIVE THE PATCH",
  pitch: "!PATCH YOUR IDEA",
  vote: "TYPE 1 · 2 · 3 IN CHAT",
  compile: "AI IS COMPILING THE WINNER",
  apply: "PATCH SHIPPING LIVE"
};

export function createOverlayPresentation(round: BroadcastState) {
  const highestVotes = Math.max(0, ...round.candidates.map((candidate) => candidate.votes));
  const leaderCount = round.candidates.filter((candidate) => highestVotes > 0 && candidate.votes === highestVotes).length;
  return {
    phase: round.phase.toUpperCase(),
    timer: formatTimer(round.remainingSeconds),
    urgent: round.phase === "vote" && round.remainingSeconds <= 5,
    instruction: instructions[round.phase],
    candidates: round.candidates.map((candidate, index) => ({
      number: index + 1,
      title: candidate.title,
      description: candidate.description,
      proposer: candidate.proposer,
      votes: candidate.votes,
      leading: candidate.votes > 0 && candidate.votes === highestVotes && leaderCount === 1,
      tied: candidate.votes > 0 && candidate.votes === highestVotes && leaderCount > 1
    }))
  };
}

export function createPitchPresentation(round: BroadcastState) {
  return {
    timer: formatTimer(round.remainingSeconds),
    ideaCount: `${round.proposals.length} ${round.proposals.length === 1 ? "idea" : "ideas"}`,
    ticker: round.proposals.slice(-5).map(({ userName, text }) => ({ userName, text }))
  };
}

export function createCompilePresentation(round: BroadcastState) {
  const winner = [...round.candidates].sort((a, b) => b.votes - a.votes)[0];
  return [
    `title ← ${winner?.title ?? "awaiting winner"}`,
    "params diff ← bounded knobs",
    "notes ← generating patch notes",
    "safety ok"
  ];
}

export function createVoteRailPresentation(round: BroadcastState) {
  return {
    ideaCount: `${round.proposals.length} ${round.proposals.length === 1 ? "idea" : "ideas"}`,
    proposals: round.proposals.slice(0, 5).map(({ userName, text }) => ({ userName, text })),
    liveVotes: round.candidates.map((candidate, index) => ({
      number: index + 1,
      title: candidate.title,
      votes: candidate.votes
    }))
  };
}

export function createActivePatchChips(patch: PatchV1 | null) {
  if (!patch) return [];
  const { params } = patch;
  const chips: string[] = [];
  if ((params.obstacleScale ?? 1) > 1.15 || params.obstacleSprite?.startsWith("emote:")) chips.push("Giant Emotes");
  if (Math.abs(params.wind ?? 0) > 0.05) chips.push(`Wind ${(params.wind ?? 0) > 0 ? "→" : "←"}`);
  if (params.controlsMirrored) chips.push("Mirror");
  if (params.floorMode === "lava") chips.push("Lava Floor");
  if ((params.gravity ?? 1) < 0.8) chips.push("Low Gravity");
  if ((params.obstacleHoming ?? 0) > 0.05) chips.push("Homing");
  return chips.slice(0, 3);
}

export function createOverlayRail(round: BroadcastState, chat: ChatLine[]) {
  const credits = Array.from(round.patchHistory.reduce((counts, patch) => {
    counts.set(patch.proposer, (counts.get(patch.proposer) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())).slice(0, 5).map(([name, count]) => ({ name, count }));

  return {
    sectionOrder: ["credits", "patches", "chat"] as const,
    activeTitles: createActivePatchChips(round.activePatch),
    credits,
    notes: round.patchHistory.slice(0, 6).map(({ version, title, status }) => ({ version, title, status })),
    chat: chat.slice(0, 5)
  };
}

export function createApplyPresentation(round: BroadcastState) {
  const votes = Math.max(0, ...round.candidates.map((candidate) => candidate.votes));
  return {
    notes: (round.activePatch?.notes ?? []).map((text, index) => ({
      label: index === 0 ? "NEW" : "BALANCE",
      text
    })),
    footer: `${votes} votes · Round ${round.round}`
  };
}

export function createRollbackLabel(round: BroadcastState) {
  return `ROLLBACK → ${round.activePatch ? formatOverlayVersion(round.activePatch.version) : "v1.0"}`;
}

export function formatOverlayVersion(version: number) {
  return `v1.${Math.max(0, Math.floor(version))}`;
}

function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
