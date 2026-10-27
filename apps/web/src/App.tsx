import { useEffect, useMemo, useState } from "react";
import type { BroadcastState, PatchV1 } from "@chaos-patch/schema";
import { GameCanvas } from "./components/GameCanvas";
import { markerStatus } from "./marker";
import { recapMetrics, type SessionRecap } from "./recap";
import { connectStateSocket } from "./stateSocket";

type TwitchStatus = { authenticated: boolean; eventSub: string; user: { display_name: string; profile_image_url: string } | null; error: string | null };
type Snapshot = { twitch: TwitchStatus; round: BroadcastState };
type ChatLine = { userName: string; text: string };
type PatchEvent = { kind: "applied" | "rolled_back"; patch: PatchV1; automatic?: boolean };
type RollbackEvent = { patch: PatchV1; reason: string };
type MarkerResult = { id: string; createdAt: string; positionSeconds: number; description: string };

const empty: Snapshot = { twitch: { authenticated: false, eventSub: "disconnected", user: null, error: null }, round: { round: 0, version: 1, phase: "idle", remainingSeconds: 0, proposals: [], candidates: [], activePatch: null, patchHistory: [] } };
const emptyRecap: SessionRecap = { round: 0, build: 1, applied: 0, rolledBack: 0, activePatch: null, recent: [] };

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [mock, setMock] = useState("!patch giant emotes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patchEvent, setPatchEvent] = useState<PatchEvent | null>(null);
  const [recap, setRecap] = useState<SessionRecap>(emptyRecap);
  const [marker, setMarker] = useState<MarkerResult | null>(null);
  const statusLabel = snapshot.twitch.authenticated ? `${snapshot.twitch.user?.display_name ?? "Twitch"} · ${snapshot.twitch.eventSub}` : "Twitch disconnected";
  const recapKey = snapshot.round.patchHistory.map(({ version, status }) => `${version}:${status}`).join("|");

  useEffect(() => {
    fetch("/api/status").then((response) => response.json()).then(setSnapshot).catch(() => undefined);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return connectStateSocket(`${protocol}//${location.host}/ws`, (data) => {
      const message = JSON.parse(data) as { type: string; payload: Snapshot | ChatLine | PatchV1 | RollbackEvent };
      if (message.type === "state:snapshot") setSnapshot(message.payload as Snapshot);
      if (message.type === "chat:message") setChat((current) => [message.payload as ChatLine, ...current].slice(0, 8));
      if (message.type === "patch:applied") setPatchEvent({ kind: "applied", patch: message.payload as PatchV1 });
      if (message.type === "patch:rolled_back") {
        const rollback = message.payload as RollbackEvent;
        setPatchEvent({ kind: "rolled_back", patch: rollback.patch, automatic: rollback.reason === "early_crash" });
      }
    });
  }, []);

  useEffect(() => {
    if (!patchEvent) return;
    const timer = window.setTimeout(() => setPatchEvent(null), 3600);
    return () => window.clearTimeout(timer);
  }, [patchEvent]);

  useEffect(() => {
    fetch("/api/session/recap").then((response) => response.json()).then(setRecap).catch(() => undefined);
  }, [recapKey, snapshot.round.round]);

  const action = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Request failed (${response.status})`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed");
    }
    finally { setBusy(false); }
  };
  const nextAction = useMemo(() => snapshot.round.phase === "vote" ? "Compile winner" : snapshot.round.phase === "idle" ? "Start session" : "Advance phase", [snapshot.round.phase]);
  const runNext = () => action(snapshot.round.phase === "vote" ? "/api/session/compile" : snapshot.round.phase === "idle" ? "/api/session/start" : "/api/session/advance");
  const rollbackPatch = (version: number) => void action("/api/session/rollback", { version, reason: "early_crash" });
  const createMarker = async () => {
    setBusy(true);
    setError(null);
    setMarker(null);
    try {
      const response = await fetch("/api/twitch/marker", { method: "POST" });
      const payload = await response.json() as { marker?: MarkerResult; error?: string };
      if (!response.ok || !payload.marker) throw new Error(payload.error ?? "Marker creation failed");
      setMarker(payload.marker);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Marker creation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#arena" aria-label="Chaos Patch home"><span className="brand-mark">CP</span><span>CHAOS PATCH</span></a>
        <div className="status-line"><span className={`signal ${snapshot.twitch.eventSub}`} />{statusLabel}</div>
        <div className="version">BUILD v{snapshot.round.version}.0</div>
      </header>

      <section className="hero" id="arena">
        <div className="hero-copy">
          <p className="eyebrow">LIVE PATCH PIPELINE</p>
          <h1>Chat ships the<br /><em>next update.</em></h1>
          <p className="lede">Play. Pitch. Vote. Compile. Apply. The audience rewrites Emote Dodge while the streamer is still playing.</p>
        </div>
        <div className="phase-block" aria-label="Current round status">
          <span>ROUND {snapshot.round.round || "—"}</span>
          <strong>{snapshot.round.phase.toUpperCase()}</strong>
          <b>{String(snapshot.round.remainingSeconds).padStart(2, "0")}</b>
        </div>
      </section>

      <section className="workspace">
        <div className="arena-panel">
          <div className="panel-head"><span>EMOTE DODGE / LIVE</span><span>← A &nbsp; D →</span></div>
          <GameCanvas patch={snapshot.round.activePatch} onEarlyCrash={rollbackPatch} />
          {snapshot.round.phase === "compile" && <div className="patch-event compile-event" role="status"><span>COMPILING WINNER</span><strong>PATCH IN ≤6 SEC</strong></div>}
          {patchEvent && <div className={`patch-event ${patchEvent.kind}`} role="status"><span>{patchEvent.kind === "applied" ? "PATCH APPLIED" : patchEvent.automatic ? "AUTO ROLLBACK" : "PATCH ROLLBACK"}</span><strong>{patchEvent.kind === "applied" ? `v${patchEvent.patch.version} · ${patchEvent.patch.title}` : patchEvent.automatic ? `v${patchEvent.patch.version} failed health check` : `v${patchEvent.patch.version} restored safely`}</strong></div>}
          <div className="patch-strip">
            <span className="patch-tag">ACTIVE PATCH</span>
            <strong>{snapshot.round.activePatch?.title ?? "VANILLA BUILD"}</strong>
            <span>{snapshot.round.activePatch?.notes[0] ?? "Waiting for chat to break the game."}</span>
          </div>
        </div>

        <aside className="control-panel">
          <div className="control-head"><p className="eyebrow">CONTROL ROOM</p><h2>Run the chaos</h2></div>
          {!snapshot.twitch.authenticated ? <a className="button twitch" href="/auth/twitch">Connect current Twitch account</a> : <div className="account"><span className="signal connected" /><div><b>{snapshot.twitch.user?.display_name}</b><small>EventSub {snapshot.twitch.eventSub}</small></div></div>}
          <button className="button primary" disabled={busy} onClick={runNext}>{busy ? "Working…" : nextAction}</button>
          <div className="phase-track">
            {["play", "pitch", "vote", "compile", "apply"].map((phase, index) => <div className={snapshot.round.phase === phase ? "current" : ""} key={phase}><span>0{index + 1}</span>{phase}</div>)}
          </div>
          <div className="live-slate" aria-live="polite">
            <div className="slate-head"><span>{snapshot.round.candidates.length ? "LIVE VOTE" : "PITCH QUEUE"}</span><b>{snapshot.round.candidates.length || snapshot.round.proposals.length}/3</b></div>
            {snapshot.round.candidates.length > 0 ? snapshot.round.candidates.map((candidate, index) => (
              <div className="slate-row" key={candidate.id}><span>{index + 1}</span><p>{candidate.title}</p><b>{candidate.votes}</b></div>
            )) : snapshot.round.proposals.length > 0 ? snapshot.round.proposals.slice(0, 3).map((proposal) => (
              <div className="slate-row" key={proposal.id}><span>+</span><p>{proposal.text}</p><b>READY</b></div>
            )) : <p className="slate-empty">Waiting for <code>!patch</code> ideas.</p>}
          </div>
          <form className="mock-form" onSubmit={(event) => { event.preventDefault(); void action("/api/mock/chat", { message: mock, userName: "local_viewer" }); }}>
            <label htmlFor="mock">Local rehearsal chat</label>
            <div><input id="mock" value={mock} onChange={(event) => setMock(event.target.value)} /><button aria-label="Send mock chat">↗</button></div>
          </form>
          {snapshot.twitch.authenticated && <button className="marker-button" disabled={busy} onClick={() => void createMarker()}>Save Twitch stream marker</button>}
          {marker && <p className="marker-result" role="status">{markerStatus(marker)} · private in Video Producer</p>}
          {snapshot.round.activePatch && <button className="rollback-button" disabled={busy} onClick={() => void action("/api/session/rollback", { version: snapshot.round.activePatch?.version, reason: "manual" })}>Rollback active patch</button>}
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="fineprint">Mock input is for rehearsal only. Live mode listens to this account through EventSub WebSockets.</p>
        </aside>
      </section>

      <section className="feed">
        <div className="feed-head"><div><p className="eyebrow">AUDIENCE INPUT</p><h2>Patch proposals</h2></div><code>!patch your idea</code></div>
        <div className="feed-grid">
          <div className="proposal-list">
            {snapshot.round.candidates.length > 0 ? snapshot.round.candidates.map((candidate, index) => <article key={candidate.id}><span className="choice">{index + 1}</span><div><h3>{candidate.title}</h3><p>by {candidate.proposer} · {candidate.difficulty}</p></div><b>{candidate.votes} VOTES</b></article>) : snapshot.round.proposals.length > 0 ? snapshot.round.proposals.map((proposal) => <article key={proposal.id}><span className="choice">+</span><div><h3>{proposal.text}</h3><p>by {proposal.userName}</p></div></article>) : <div className="empty">Advance to PITCH, then send <code>!patch giant emotes</code>.</div>}
          </div>
          <div className="chat-log" aria-live="polite">
            <h3>Chat wire</h3>
            {chat.length ? chat.map((line, index) => <p key={`${line.userName}-${index}`}><b>{line.userName}</b> {line.text}</p>) : <p className="muted">No messages on the wire yet.</p>}
          </div>
        </div>
      </section>

      <section className="history" aria-labelledby="history-title">
        <div className="feed-head"><div><p className="eyebrow">ROUND {recap.round || "—"} RECAP</p><h2 id="history-title">Patch history</h2></div><span>Crash within 6s → automatic rollback</span></div>
        <div className="recap-metrics">
          {recapMetrics(recap).map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
        </div>
        <div className="history-list">
          {snapshot.round.patchHistory.length ? snapshot.round.patchHistory.map((entry) => (
            <div key={`${entry.version}-${entry.title}`}><code>v{entry.version}</code><strong>{entry.title}</strong><span className={entry.status}>{entry.status === "applied" ? "APPLIED" : "ROLLED BACK"}</span></div>
          )) : <p>No patches shipped yet. A compiled winner will appear here.</p>}
        </div>
      </section>
    </main>
  );
}
