type RuntimeStatusInput = {
  round: number;
  phase: string;
  remainingSeconds: number;
  version: number;
  chatMessagesPerMinute: number;
  lastCompileMs: number | null;
};

export function runtimeStatusPresentation(input: RuntimeStatusInput) {
  const seconds = Math.max(0, Math.floor(input.remainingSeconds));
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return {
    round: `ROUND ${input.round || "—"}`,
    phase: `${input.phase.toUpperCase()} ${timer}`,
    version: `v${input.version}.0`,
    chatRate: `${Math.max(0, input.chatMessagesPerMinute)} msg/min`,
    llmLatency: `${input.lastCompileMs === null ? "—" : Math.max(0, Math.round(input.lastCompileMs))} ms`
  };
}
