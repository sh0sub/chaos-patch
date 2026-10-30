export type SessionRecap = {
  round: number;
  build: number;
  applied: number;
  rolledBack: number;
  activePatch: string | null;
  patchCount: number;
  contributorCount: number;
  sessionDate: string;
  broadcaster: { displayName: string; avatarUrl: string } | null;
  recent: Array<{
    version: number;
    title: string;
    proposer: string;
    status: "applied" | "rolled_back";
  }>;
  topPatches: RecapPatch[];
  timeline: RecapPatch[];
  credits: Array<{ proposer: string; patches: number }>;
};

export type RecapPatch = {
  version: number;
  title: string;
  proposer: string;
  votes: number;
  status: "applied" | "rolled_back";
  appliedAt: string | null;
};

export function recapMetrics(recap: SessionRecap) {
  return [
    { label: "BUILD", value: `v${recap.build}` },
    { label: "SHIPPED", value: String(recap.applied) },
    { label: "ROLLED BACK", value: String(recap.rolledBack) },
    { label: "ACTIVE", value: recap.activePatch ?? "VANILLA" }
  ];
}

export function recapShareMessage(recap: SessionRecap, url: string): string {
  return `Chaos Patch recap: ${recap.patchCount} patches by ${recap.contributorCount} contributors — ${url}`;
}
