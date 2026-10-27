export type SessionRecap = {
  round: number;
  build: number;
  applied: number;
  rolledBack: number;
  activePatch: string | null;
  recent: Array<{
    version: number;
    title: string;
    proposer: string;
    status: "applied" | "rolled_back";
  }>;
};

export function recapMetrics(recap: SessionRecap) {
  return [
    { label: "BUILD", value: `v${recap.build}` },
    { label: "SHIPPED", value: String(recap.applied) },
    { label: "ROLLED BACK", value: String(recap.rolledBack) },
    { label: "ACTIVE", value: recap.activePatch ?? "VANILLA" }
  ];
}
