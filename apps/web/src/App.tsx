import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSessionSettings, type BroadcastState, type PatchV1, type SessionSettings } from "@chaos-patch/schema";
import { BroadcastOverlay } from "./components/BroadcastOverlay";
import { GameCanvas } from "./components/GameCanvas";
import { HoldRollbackButton } from "./components/HoldRollbackButton";
import { chatLinePresentation, type ChatWireLine } from "./chatWire";
import { buildEmoteCatalog, type TwitchEmoteAsset } from "./gameVisuals";
import { markerStatus } from "./marker";
import { overlayConnectionLabel } from "./overlayConnection";
import { patchHistoryPresentation } from "./patchHistory";
import { recapMetrics, type SessionRecap } from "./recap";
import { runtimeStatusPresentation } from "./runtimeStatus";
import { overlaySourceUrl, parseBlockedTerms } from "./sessionControls";
import { compileErrorFromSocketMessage, connectStateSocket } from "./stateSocket";
import { twitchStatusPresentation, type TwitchEventSubStatus } from "./twitchStatus";

type TwitchStatus = { authenticated: boolean; eventSub: TwitchEventSubStatus; user: { display_name: string; profile_image_url: string } | null; error: string | null };
type Snapshot = { twitch: TwitchStatus; round: BroadcastState; session: { paused: boolean; settings: SessionSettings; filteredCount: number; overlayClients: number }; telemetry: { chatMessagesPerMinute: number; lastCompileMs: number | null } };
type ChatLine = ReturnType<typeof chatLinePresentation>;
type PatchEvent = { kind: "applied" | "rolled_back"; patch: PatchV1; automatic?: boolean };
type RollbackEvent = { patch: PatchV1; reason: string };
type MarkerResult = { id: string; createdAt: string; positionSeconds: number; description: string };

const empty: Snapshot = {
  twitch: { authenticated: false, eventSub: "disconnected", user: null, error: null },
  round: { round: 0, version: 1, phase: "idle", remainingSeconds: 0, proposals: [], candidates: [], activePatch: null, patchHistory: [] },
  session: { paused: false, settings: defaultSessionSettings, filteredCount: 0, overlayClients: 0 },
  telemetry: { chatMessagesPerMinute: 0, lastCompileMs: null }
};
const emptyRecap: SessionRecap = { round: 0, build: 1, applied: 0, rolledBack: 0, activePatch: null, recent: [] };

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [mock, setMock] = useState("!patch giant emotes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patchEvent, setPatchEvent] = useState<PatchEvent | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [recap, setRecap] = useState<SessionRecap>(emptyRecap);
  const [marker, setMarker] = useState<MarkerResult | null>(null);
  const [emotes, setEmotes] = useState<TwitchEmoteAsset[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<SessionSettings>(defaultSessionSettings);
  const [blockedTermsText, setBlockedTermsText] = useState(defaultSessionSettings.blockedTerms.join(", "));
  const [obsCopied, setObsCopied] = useState(false);
  const settingsKeyRef = useRef("");
  const isBroadcastOverlay = window.location.pathname === "/overlay";
  const statusPresentation = twitchStatusPresentation(snapshot.twitch.eventSub, snapshot.twitch.authenticated ? snapshot.twitch.user?.display_name ?? "Twitch" : null);
  const recapKey = snapshot.round.patchHistory.map(({ version, status }) => `${version}:${status}`).join("|");
  const emoteCatalog = useMemo(() => buildEmoteCatalog(emotes), [emotes]);
  const obsUrl = overlaySourceUrl(window.location.origin);
  const historyRows = patchHistoryPresentation(snapshot.round.patchHistory);
  const runtimeStatus = runtimeStatusPresentation({
    round: snapshot.round.round,
    phase: snapshot.round.phase,
    remainingSeconds: snapshot.round.remainingSeconds,
    version: snapshot.round.version,
    ...snapshot.telemetry
  });

  useEffect(() => {
    fetch("/api/status").then((response) => response.json()).then(setSnapshot).catch(() => undefined);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return connectStateSocket(`${protocol}//${location.host}/ws?surface=${isBroadcastOverlay ? "overlay" : "dashboard"}`, (data) => {
      const compileFailure = compileErrorFromSocketMessage(data);
      if (compileFailure) {
        setCompileError(compileFailure);
        setError(compileFailure);
      }
      const message = JSON.parse(data) as { type: string; payload: Snapshot | ChatWireLine | PatchV1 | RollbackEvent };
      if (message.type === "state:snapshot") setSnapshot(message.payload as Snapshot);
      if (message.type === "chat:message") setChat((current) => [chatLinePresentation(message.payload as ChatWireLine), ...current].slice(0, 8));
      if (message.type === "patch:applied") setPatchEvent({ kind: "applied", patch: message.payload as PatchV1 });
      if (message.type === "patch:rolled_back") {
        const rollback = message.payload as RollbackEvent;
        setPatchEvent({ kind: "rolled_back", patch: rollback.patch, automatic: rollback.reason !== "manual" });
      }
    });
  }, []);

  useEffect(() => {
    if (!compileError) return;
    const timer = window.setTimeout(() => setCompileError(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [compileError]);

  useEffect(() => {
    if (!patchEvent) return;
    const timer = window.setTimeout(() => setPatchEvent(null), 3600);
    return () => window.clearTimeout(timer);
  }, [patchEvent]);

  useEffect(() => {
    fetch("/api/session/recap").then((response) => response.json()).then(setRecap).catch(() => undefined);
  }, [recapKey, snapshot.round.round]);

  useEffect(() => {
    if (!snapshot.twitch.authenticated) {
      setEmotes([]);
      return;
    }
    fetch("/api/twitch/emotes")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Emote lookup failed")))
      .then((payload: { emotes?: TwitchEmoteAsset[] }) => setEmotes(payload.emotes ?? []))
      .catch(() => setEmotes([]));
  }, [snapshot.twitch.authenticated]);

  useEffect(() => {
    const key = JSON.stringify(snapshot.session.settings);
    if (key === settingsKeyRef.current) return;
    settingsKeyRef.current = key;
    setSettingsDraft(snapshot.session.settings);
    setBlockedTermsText(snapshot.session.settings.blockedTerms.join(", "));
  }, [snapshot.session.settings]);

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
  const nextAction = useMemo(() => snapshot.round.phase === "vote" ? "Compile winner" : snapshot.round.phase === "idle" ? "Start session" : "Skip phase", [snapshot.round.phase]);
  const runNext = () => action(snapshot.round.phase === "vote" ? "/api/session/compile" : snapshot.round.phase === "idle" ? "/api/session/start" : "/api/session/advance");
  const rollbackPatch = (version: number, reason: "early_crash" | "low_fps") => void action("/api/session/rollback", { version, reason });
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
  const copyObsUrl = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl);
      setObsCopied(true);
      window.setTimeout(() => setObsCopied(false), 1800);
    } catch {
      setError("Could not copy the OBS URL. Open the overlay and copy its address manually.");
    }
  };
  const saveSettings = () => action("/api/session/settings", { ...settingsDraft, blockedTerms: parseBlockedTerms(blockedTermsText) });

  if (isBroadcastOverlay) {
    return (
      <BroadcastOverlay
        round={snapshot.round}
        twitchUser={snapshot.twitch.user}
        eventSubStatus={snapshot.twitch.eventSub}
        chat={chat}
        patchEvent={patchEvent}
        compileError={compileError}
        emoteCatalog={emoteCatalog}
        paused={snapshot.session.paused}
        onPatchFailure={rollbackPatch}
      />
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#arena" aria-label="Chaos Patch home"><span className="brand-mark">CP</span><span>CHAOS PATCH</span></a>
        <div className="runtime-status" aria-label="Live runtime status">
          <span><small>ROUND</small><b>{runtimeStatus.round.replace("ROUND ", "")}</b></span>
          <span><small>PHASE</small><b>{runtimeStatus.phase}</b></span>
          <span><small>VERSION</small><b>{runtimeStatus.version}</b></span>
          <span><small>CHAT</small><b>{runtimeStatus.chatRate}</b></span>
          <span><small>LLM</small><b>{runtimeStatus.llmLatency}</b></span>
        </div>
        <div className="status-line"><span className={`signal ${snapshot.twitch.eventSub}`} />{statusPresentation.label}</div>
      </header>

      {statusPresentation.reconnect && <div className="reconnect-banner" role="alert"><strong>Re-connect needed</strong><span>{snapshot.twitch.error ?? "Twitch authorization expired."}</span><a href="/auth/twitch">Reconnect Twitch</a></div>}

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
          <GameCanvas
            patch={snapshot.round.activePatch}
            paused={snapshot.round.phase !== "play" || snapshot.session.paused}
            emoteCatalog={emoteCatalog}
            playerImageUrl={snapshot.twitch.user?.profile_image_url ?? null}
            onPatchFailure={rollbackPatch}
          />
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
          {!snapshot.twitch.authenticated ? <a className="button twitch" href="/auth/twitch">Connect current Twitch account</a> : <div className="account"><span className={`signal ${snapshot.twitch.eventSub}`} /><div><b>{snapshot.twitch.user?.display_name}</b><small>EventSub {snapshot.twitch.eventSub}</small></div></div>}
          {!snapshot.twitch.authenticated && <button className="button demo" disabled={busy} onClick={() => void action("/api/mock/script")}>Run scripted demo</button>}
          <div className="obs-source">
            <div><span>02 · OBS SOURCE</span><a href="/overlay" target="_blank" rel="noreferrer">Open overlay ↗</a></div>
            <code>{obsUrl}</code>
            <div className="obs-copy-row">
              <button type="button" onClick={() => void copyObsUrl()}>{obsCopied ? "Copied" : "Copy OBS URL"}</button>
              <small className={snapshot.session.overlayClients > 0 ? "live" : "waiting"}>{overlayConnectionLabel(snapshot.session.overlayClients)}</small>
            </div>
          </div>
          <div className="session-settings">
            <div className="settings-title"><span>03 · SESSION</span><b>{settingsDraft.playSeconds}s PLAY</b></div>
            <div className="intensity-control" aria-label="Patch intensity">
              {(["mild", "spicy", "chaos"] as const).map((intensity) => (
                <button
                  type="button"
                  className={settingsDraft.intensity === intensity ? "selected" : ""}
                  onClick={() => setSettingsDraft((current) => ({ ...current, intensity }))}
                  key={intensity}
                >{intensity}</button>
              ))}
            </div>
            <label htmlFor="play-seconds">PLAY duration <output>{settingsDraft.playSeconds}s</output></label>
            <input
              id="play-seconds"
              type="range"
              min="45"
              max="90"
              step="15"
              value={settingsDraft.playSeconds}
              onChange={(event) => setSettingsDraft((current) => ({ ...current, playSeconds: Number(event.target.value) }))}
            />
            <label htmlFor="blocked-terms">Blocked terms · max 5</label>
            <input
              id="blocked-terms"
              type="text"
              value={blockedTermsText}
              onChange={(event) => setBlockedTermsText(event.target.value)}
            />
            <button className="save-settings" type="button" disabled={busy} onClick={() => void saveSettings()}>Save session settings</button>
          </div>
          <button className="button primary" disabled={busy} onClick={runNext}>{busy ? "Working…" : nextAction}</button>
          {snapshot.round.phase !== "idle" && (
            <button className="pause-button" disabled={busy} onClick={() => void action("/api/session/pause", { paused: !snapshot.session.paused })}>
              {snapshot.session.paused ? "Resume timer" : "Pause timer"}
            </button>
          )}
          <div className="phase-track">
            {["play", "pitch", "vote", "compile", "apply"].map((phase, index) => <div className={snapshot.round.phase === phase ? "current" : ""} key={phase}><span>0{index + 1}</span>{phase}</div>)}
          </div>
          <div className="live-slate" aria-live="polite">
            <div className="slate-head"><span>{snapshot.round.candidates.length ? "LIVE VOTE" : "PITCH QUEUE"}</span><b>{snapshot.round.candidates.length || snapshot.round.proposals.length}/3{snapshot.session.filteredCount ? ` · ${snapshot.session.filteredCount} filtered` : ""}</b></div>
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
          {snapshot.round.activePatch && <HoldRollbackButton disabled={busy} onConfirm={() => void action("/api/session/rollback", { version: snapshot.round.activePatch?.version, reason: "manual" })} />}
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="fineprint">Scripted demo needs no Twitch account. Manual mock input is for rehearsal only; live mode listens through EventSub WebSockets.</p>
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
            {chat.length ? chat.map((line, index) => <p className={line.muted ? "filtered" : undefined} key={`${line.userName}-${index}`}><b>{line.userName}</b> {line.text}</p>) : <p className="muted">No messages on the wire yet.</p>}
          </div>
        </div>
      </section>

      <section className="history" aria-labelledby="history-title">
        <div className="feed-head"><div><p className="eyebrow">ROUND {recap.round || "—"} RECAP</p><h2 id="history-title">Patch history</h2></div><span>Crash within 6s → automatic rollback</span></div>
        <div className="recap-metrics">
          {recapMetrics(recap).map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
        </div>
        <div className="history-list">
          {historyRows.length ? historyRows.map((entry) => (
            <details key={`${entry.version}-${entry.title}`}>
              <summary className="history-summary"><code>v{entry.version}</code><strong>{entry.title}</strong><span className={entry.status}>{entry.status === "applied" ? "APPLIED" : "ROLLED BACK"}</span></summary>
              <div className="history-detail">
                <div className="knob-diff">
                  {entry.diffs.length ? entry.diffs.map((diff) => <div key={diff.knob}><code>- {diff.knob} {diff.before}</code><code>+ {diff.knob} {diff.after}</code></div>) : <small>No knob changes</small>}
                </div>
                <div className="safety-strip"><strong>Safety guard 4/4</strong>{entry.safety.map((item) => <span key={item}>✓ {item}</span>)}</div>
              </div>
            </details>
          )) : <p>No patches shipped yet. A compiled winner will appear here.</p>}
        </div>
      </section>
    </main>
  );
}
