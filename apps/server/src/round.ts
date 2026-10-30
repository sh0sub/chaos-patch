import { randomUUID } from "node:crypto";
import {
  candidateSchema,
  defaultSessionSettings,
  patchSchema,
  proposalSchema,
  sessionSettingsSchema,
  type BroadcastState,
  type Candidate,
  type PatchV1,
  type Proposal,
  type RoundPhase,
  type SessionSettings
} from "@chaos-patch/schema";

const phases: RoundPhase[] = ["play", "pitch", "vote", "compile", "apply"];
const defaultPhaseSeconds: Record<RoundPhase, number> = {
  idle: 0,
  play: 60,
  pitch: 30,
  vote: 20,
  compile: 6,
  apply: 5
};

export class RoundStore {
  private settings: SessionSettings = structuredClone(defaultSessionSettings);
  private state: BroadcastState = {
    round: 0,
    version: 1,
    phase: "idle",
    remainingSeconds: 0,
    proposals: [],
    candidates: [],
    activePatch: null,
    patchHistory: []
  };

  snapshot(): BroadcastState {
    return structuredClone(this.state);
  }

  settingsSnapshot(): SessionSettings {
    return structuredClone(this.settings);
  }

  configure(settings: SessionSettings): SessionSettings {
    this.settings = sessionSettingsSchema.parse(settings);
    return this.settingsSnapshot();
  }

  start(): BroadcastState {
    this.state = {
      ...this.state,
      round: Math.max(1, this.state.round || 1),
      phase: "play",
      remainingSeconds: this.phaseSeconds("play")
    };
    return this.snapshot();
  }

  startPitch(): BroadcastState {
    this.votesByUser.clear();
    this.state = {
      ...this.state,
      round: this.state.phase === "idle" ? Math.max(1, this.state.round || 1) : this.state.round + 1,
      phase: "pitch",
      remainingSeconds: this.phaseSeconds("pitch"),
      proposals: [],
      candidates: []
    };
    return this.snapshot();
  }

  advance(voteCandidates?: Candidate[]): BroadcastState {
    const currentIndex = phases.indexOf(this.state.phase);
    const nextPhase = currentIndex < 0 || currentIndex === phases.length - 1 ? "play" : phases[currentIndex + 1]!;
    const startsNewRound = this.state.phase === "apply" || this.state.phase === "idle";
    this.state = {
      ...this.state,
      round: startsNewRound ? Math.max(1, this.state.round + 1) : this.state.round,
      phase: nextPhase,
      remainingSeconds: this.phaseSeconds(nextPhase),
      proposals: nextPhase === "play" ? [] : this.state.proposals,
      candidates: nextPhase === "play"
        ? []
        : nextPhase === "vote"
          ? (voteCandidates ?? this.buildCandidates()).map((candidate) => candidateSchema.parse(candidate))
          : this.state.candidates
    };
    return this.snapshot();
  }

  addProposal(userId: string, userName: string, text: string): Proposal | null {
    const normalized = text.replace(/^!(patch|idea)\s+/i, "").trim();
    if (!normalized || normalized.length > 120 || this.state.phase !== "pitch") return null;
    const normalizedLower = normalized.toLocaleLowerCase();
    if (this.settings.blockedTerms.some((term) => normalizedLower.includes(term.toLocaleLowerCase()))) return null;
    const proposal = proposalSchema.parse({
      id: randomUUID(),
      userId,
      userName,
      text: normalized,
      createdAt: new Date().toISOString()
    });
    this.state.proposals = [...this.state.proposals, proposal];
    return proposal;
  }

  vote(userId: string, choice: number): BroadcastState {
    if (this.state.phase !== "vote" || choice < 1 || choice > 3) return this.snapshot();
    const previousVote = this.votesByUser.get(userId);
    if (previousVote !== undefined) {
      const previous = this.state.candidates[previousVote];
      if (previous) previous.votes = Math.max(0, previous.votes - 1);
    }
    const candidate = this.state.candidates[choice - 1];
    if (candidate) candidate.votes += 1;
    this.votesByUser.set(userId, choice - 1);
    return this.snapshot();
  }

  apply(patch: PatchV1): BroadcastState {
    const safePatch = patchSchema.parse(patch);
    this.state = {
      ...this.state,
      version: safePatch.version,
      phase: "apply",
      remainingSeconds: this.phaseSeconds("apply"),
      activePatch: safePatch,
      patchHistory: [{ ...safePatch, status: "applied" }, ...this.state.patchHistory]
    };
    return this.snapshot();
  }

  rollback(expectedVersion?: number): { patch: PatchV1; round: BroadcastState } | null {
    const failedPatch = this.state.activePatch;
    if (!failedPatch || (expectedVersion !== undefined && failedPatch.version !== expectedVersion)) return null;

    const patchHistory = this.state.patchHistory.map((entry) =>
      entry.version === failedPatch.version ? { ...entry, status: "rolled_back" as const } : entry
    );
    const previousEntry = patchHistory.find(
      (entry) => entry.status === "applied" && entry.version !== failedPatch.version
    );
    const activePatch = previousEntry
      ? patchSchema.parse({
          version: previousEntry.version,
          title: previousEntry.title,
          notes: previousEntry.notes,
          proposer: previousEntry.proposer,
          params: previousEntry.params
        })
      : null;

    this.state = {
      ...this.state,
      phase: "apply",
      remainingSeconds: this.phaseSeconds("apply"),
      activePatch,
      patchHistory
    };
    return { patch: failedPatch, round: this.snapshot() };
  }

  winner(): Candidate | null {
    const winner = [...this.state.candidates].sort((a, b) => b.votes - a.votes)[0];
    return winner && winner.votes > 0 ? winner : null;
  }

  tick(): RoundPhase | null {
    if (this.state.phase === "idle") return null;
    if (this.state.remainingSeconds > 1) {
      this.state.remainingSeconds -= 1;
      return null;
    }
    if (this.state.phase === "compile") {
      this.state.remainingSeconds = 0;
      return null;
    }
    if (this.state.phase === "pitch") {
      this.state.remainingSeconds = 0;
      return "pitch";
    }
    const expiredPhase = this.state.phase;
    if (expiredPhase === "vote") {
      if (this.winner()) {
        this.state.phase = "compile";
        this.state.remainingSeconds = this.phaseSeconds("compile");
      } else {
        this.state = {
          ...this.state,
          round: this.state.round + 1,
          phase: "play",
          remainingSeconds: this.phaseSeconds("play"),
          proposals: [],
          candidates: []
        };
        return null;
      }
    } else {
      this.advance();
    }
    return expiredPhase;
  }

  private readonly votesByUser = new Map<string, number>();

  private phaseSeconds(phase: RoundPhase): number {
    return phase === "play" ? this.settings.playSeconds : defaultPhaseSeconds[phase];
  }

  private buildCandidates(): Candidate[] {
    this.votesByUser.clear();
    const fallback = [
      { id: "seed-1", userName: "chat", text: "Giant emotes" },
      { id: "seed-2", userName: "chat", text: "Mirror controls" },
      { id: "seed-3", userName: "chat", text: "Lava floor" }
    ];
    const source = [
      ...this.state.proposals,
      ...fallback.filter((seed) =>
        !this.state.proposals.some((proposal) => proposal.text.toLowerCase() === seed.text.toLowerCase())
      )
    ].slice(0, 3);

    return source.map((proposal, index) =>
      candidateSchema.parse({
        id: proposal.id,
        title: proposal.text.slice(0, 25),
        description: proposal.text.slice(0, 60),
        proposer: proposal.userName,
        difficulty: (["mild", "spicy", "chaos"] as const)[index] ?? "spicy",
        votes: 0
      })
    );
  }
}
