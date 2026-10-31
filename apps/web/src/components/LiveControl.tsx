import type { BroadcastState, SessionSettings } from "@chaos-patch/schema";
import { overlayConnectionLabel } from "../overlayConnection";
import { patchHistoryPresentation } from "../patchHistory";
import { runtimeStatusPresentation } from "../runtimeStatus";
import type { TwitchEventSubStatus } from "../twitchStatus";
import { HoldRollbackButton } from "./HoldRollbackButton";

type ChatLine = { userName: string; text: string; muted: boolean };

type Props = {
  round: BroadcastState;
  twitch: { authenticated: boolean; eventSub: TwitchEventSubStatus; user: { display_name: string } | null };
  session: { paused: boolean; settings: SessionSettings; filteredCount: number; overlayClients: number };
  telemetry: { chatMessagesPerMinute: number; lastCompileMs: number | null };
  chat: ChatLine[];
  busy: boolean;
  error: string | null;
  onAdvance: () => void;
  onPause: () => void;
  onRollback: () => void;
  onIntensityChange: (intensity: SessionSettings["intensity"]) => void;
};

export function LiveControl({ round, twitch, session, telemetry, chat, busy, error, onAdvance, onPause, onRollback, onIntensityChange }: Props) {
  const status = runtimeStatusPresentation({
    round: round.round,
    phase: round.phase,
    remainingSeconds: round.remainingSeconds,
    version: round.version,
    ...telemetry
  });
  const history = patchHistoryPresentation(round.patchHistory);
  const latest = history[0];
  const proposals = round.proposals.slice(-8).reverse();
  const nextAction = round.phase === "vote" ? "Compile winner" : round.phase === "idle" ? "Start session" : "Skip phase";
  const accountInitial = twitch.user?.display_name.slice(0, 1).toUpperCase() ?? "CP";

  return (
    <main className="live-control">
      <header className="live-control-topbar">
        <a href="/dashboard/setup" className="live-control-brand"><span>CP</span><strong>Live Control</strong></a>
        <div className="live-control-runtime">
          <span className="live-flag"><i />LIVE</span>
          <span>{status.round}</span>
          <strong>{status.phase}</strong>
          <code>{status.version}</code>
        </div>
        <div className="live-control-telemetry">
          <span><i className={twitch.eventSub === "connected" ? "ok" : "bad"} />Chat {status.chatRate}</span>
          <span><i className={session.overlayClients > 0 ? "ok" : ""} />{overlayConnectionLabel(session.overlayClients)}</span>
          <span><i className={telemetry.lastCompileMs && telemetry.lastCompileMs > 4000 ? "slow" : "ok"} />LLM {status.llmLatency}</span>
          <b>{accountInitial}</b>
        </div>
      </header>

      {twitch.eventSub !== "connected" && <div className="live-control-alert" role="alert"><strong>CHAT RECONNECTING</strong><span>EventSub is not live. Local controls and the overlay remain available.</span><a href="/auth/twitch">Reconnect</a></div>}

      <section className="live-control-grid">
        <aside className="live-chat-panel">
          <header className="live-panel-head"><div><p>ROUND INPUT</p><h1>Live chat</h1></div><span>All <b>!patch {round.proposals.length}</b></span></header>
          {round.activePatch && <div className="live-applied"><code>v{round.activePatch.version}.0</code><span>APPLIED</span><p><strong>ChaosPatchBot:</strong> {round.activePatch.title} · proposed by @{round.activePatch.proposer}</p></div>}
          <div className="live-chat-scroll" aria-live="polite">
            {chat.length ? chat.map((line, index) => <p className={line.muted ? "filtered" : line.text.startsWith("!patch") ? "proposal" : ""} key={`${line.userName}-${index}`}><time>{String(index + 1).padStart(2, "0")}</time><span><b>{line.userName}</b> {line.text}</span></p>) : <div className="live-empty">Waiting for EventSub messages.<br /><code>!patch your idea</code></div>}
            {proposals.map((proposal) => <p className="proposal" key={proposal.id}><time>P</time><span><b>{proposal.userName}</b> {proposal.text}</span></p>)}
          </div>
          <footer className="live-chat-summary">{round.proposals.length} proposals · filtered {session.filteredCount}</footer>
        </aside>

        <section className="live-round-panel">
          <header className="live-panel-head"><div><p>ROUND {round.round || "—"}</p><h1>Proposals &amp; Vote</h1></div><span className={`live-phase ${round.phase}`}>{round.phase.toUpperCase()}</span></header>
          <div className="live-round-clock"><strong>{status.phase.split(" ")[1] ?? "00:00"}</strong><div><span>{round.phase.toUpperCase()}</span><p>{round.phase === "pitch" ? "Collecting patch ideas" : round.phase === "vote" ? "Chat votes 1, 2, or 3" : round.phase === "compile" ? "Compiling structured patch" : round.phase === "play" ? "Game in progress" : "Ready for the next phase"}</p></div></div>

          <div className="live-candidates">
            {round.candidates.length ? round.candidates.map((candidate, index) => <article className="live-candidate" key={candidate.id}><span>{index + 1}</span><div><h2>{candidate.title}</h2><p>{candidate.description}</p><small>@{candidate.proposer} · {candidate.difficulty}</small></div><strong>{candidate.votes}</strong></article>) : proposals.length ? proposals.slice(0, 6).map((proposal) => <article className="live-proposal" key={proposal.id}><span>+</span><div><h2>{proposal.text}</h2><small>@{proposal.userName}</small></div></article>) : <div className="live-empty live-round-empty">No proposals yet. Advance to PITCH and ask chat for <code>!patch</code> ideas.</div>}
          </div>

          <div className="live-emergency-controls">
            <button type="button" disabled={busy || round.phase === "idle"} onClick={onPause}>{session.paused ? "Resume" : "Pause"}</button>
            <button className="live-skip" type="button" disabled={busy} onClick={onAdvance}>{nextAction}</button>
            <div className="live-rollback"><span>Force rollback</span><HoldRollbackButton disabled={busy || !round.activePatch} onConfirm={onRollback} /></div>
          </div>
          <div className="live-intensity"><span>INTENSITY</span>{(["mild", "spicy", "chaos"] as const).map((value) => <button type="button" className={session.settings.intensity === value ? "selected" : ""} onClick={() => onIntensityChange(value)} key={value}>{value}</button>)}</div>
          {error && <p className="live-control-error" role="alert">{error}</p>}
        </section>

        <aside className="live-patch-panel">
          <section className="live-queue">
            <header className="live-panel-head"><div><p>BUILD HISTORY</p><h1>Patch queue</h1></div><span>{round.round} rounds · {history.filter((patch) => patch.status === "rolled_back").length} rollback</span></header>
            <div className="live-history-list">
              {history.length ? history.slice(0, 5).map((patch) => <article className={patch.status} key={patch.version}><code>v{patch.version}.0</code><div><strong>{patch.title}</strong><small>by @{patch.proposer} · {patch.status.replace("_", " ")}</small></div><span>{patch.status === "applied" ? "LIVE" : "ROLLED BACK"}</span></article>) : <div className="live-empty">Compiled patches will appear here.</div>}
            </div>
          </section>

          <section className="live-compile-log">
            <header><span>compile.log</span><b>{latest ? `v${latest.version}.0` : "waiting"}</b></header>
            <div><p><i>$</i> chaos compile --strict PatchV1</p>{latest?.diffs.length ? latest.diffs.slice(0, 5).map((diff) => <p key={diff.knob}><code>- {diff.knob} {diff.before}</code><code>+ {diff.knob} {diff.after}</code></p>) : <p className="muted"># waiting for a compiled patch</p>}<p className="compile-ok">✓ schema ok &nbsp; ✓ safety ok</p></div>
          </section>

          <section className="live-safety">
            <header><div><p>RUNTIME</p><h1>Safety guard</h1></div><strong>4 / 4 PASS</strong></header>
            <div><span>✓</span><p>PatchV1 schema validation<small>strict</small></p></div>
            <div><span>✓</span><p>Allowed knobs only<small>25 parameters</small></p></div>
            <div><span>✓</span><p>Blocked-term filter<small>{session.settings.blockedTerms.length} terms</small></p></div>
            <div><span>✓</span><p>Automatic rollback watch<small>crash · fps&lt;20/3s</small></p></div>
          </section>
        </aside>
      </section>
    </main>
  );
}
