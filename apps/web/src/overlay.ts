import type { BroadcastState } from "@chaos-patch/schema";

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

export function createOverlayRail(round: BroadcastState, chat: ChatLine[]) {
  const credits = Array.from(round.patchHistory.reduce((counts, patch) => {
    counts.set(patch.proposer, (counts.get(patch.proposer) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())).slice(0, 5).map(([name, count]) => ({ name, count }));

  return {
    sectionOrder: ["credits", "patches", "chat"] as const,
    activeTitles: round.patchHistory
      .filter((entry) => entry.status === "applied")
      .slice(0, 4)
      .map((entry) => entry.title),
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
  return `ROLLBACK → v${round.activePatch?.version ?? 1}`;
}

function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
