import type { SessionSettings } from "@chaos-patch/schema";
import { maskOverlaySourceUrl } from "../sessionControls";
import type { TwitchEventSubStatus } from "../twitchStatus";

type Props = {
  twitch: {
    authenticated: boolean;
    eventSub: TwitchEventSubStatus;
    user: { display_name: string; profile_image_url: string } | null;
  };
  overlayClients: number;
  obsUrl: string | null;
  obsCopied: boolean;
  settings: SessionSettings;
  blockedTerms: string;
  busy: boolean;
  error: string | null;
  onCopyObs: () => void;
  onSettingsChange: (settings: SessionSettings) => void;
  onBlockedTermsChange: (terms: string) => void;
  onStart: () => void;
  onRunDemo: () => void;
};

export function SetupDashboard({
  twitch,
  overlayClients,
  obsUrl,
  obsCopied,
  settings,
  blockedTerms,
  busy,
  error,
  onCopyObs,
  onSettingsChange,
  onBlockedTermsChange,
  onStart,
  onRunDemo
}: Props) {
  const twitchReady = twitch.authenticated && twitch.eventSub === "connected";
  const overlayReady = overlayClients > 0;
  const activeStep = !twitchReady ? 1 : !overlayReady ? 2 : 3;
  const readyCount = Number(twitchReady) + Number(overlayReady) + 1;
  const displayName = twitch.user?.display_name ?? "Streamer";

  return (
    <main className="setup-dashboard">
      <aside className="setup-sidebar">
        <a className="setup-brand" href="/dashboard/setup"><span>CP</span><strong>CHAOS PATCH</strong></a>
        <div className="setup-nav-label">SETUP · {readyCount}/3</div>
        <nav className="setup-steps" aria-label="Setup steps">
          <a className={twitchReady ? "done" : activeStep === 1 ? "current" : ""} href="#connect"><i>01</i><span>Connect Twitch<small>{twitchReady ? "EventSub connected" : "Authorization required"}</small></span></a>
          <a className={overlayReady ? "done" : activeStep === 2 ? "current" : ""} href="#obs"><i>02</i><span>OBS Overlay<small>{overlayReady ? "Source is live" : "Add browser source"}</small></span></a>
          <a className="done" href="#session"><i>03</i><span>Session settings<small>{settings.intensity} · {settings.playSeconds}s</small></span></a>
        </nav>
        <div className="setup-nav-label setup-tools-label">TOOLS</div>
        <nav className="setup-tools">
          <a href="/dashboard/live">Live Control <span>↗</span></a>
          <a href="/dashboard/live#history">Patch History <span>↗</span></a>
          <a href="/recap">Session Recap <span>↗</span></a>
        </nav>
        <div className="setup-profile">
          {twitch.user?.profile_image_url ? <img src={twitch.user.profile_image_url} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{twitch.authenticated ? displayName : "No session"}</strong><small>{twitch.authenticated ? "TWITCH CONNECTED" : "CONNECT TO BEGIN"}</small></div>
        </div>
      </aside>

      <section className="setup-main">
        <header className="setup-topbar">
          <div><strong>Setup</strong><code>BUILD v1.0</code></div>
          <div className="setup-signals">
            <span><i className={twitchReady ? "live" : ""} />CHAT {twitchReady ? "LIVE" : "OFF"}</span>
            <span><i className={overlayReady ? "live" : ""} />OVERLAY {overlayReady ? "LIVE" : "WAITING"}</span>
            <b>{displayName.slice(0, 1).toUpperCase()}</b>
          </div>
        </header>

        <div className="setup-content-grid">
          <div className="setup-form-column">
            <header className="setup-intro"><p>PRE-FLIGHT CHECK</p><h1>Ready the room.<br /><em>Ship the chaos.</em></h1><span>Connect Twitch, place the secure OBS source, then tune one short session.</span></header>

            <section className="setup-card" id="connect">
              <div className="setup-card-number">01</div>
              <div className="setup-card-body">
                <header><div><p>TWITCH CONNECTION</p><h2>{twitchReady ? "Channel connected" : "Connect your channel"}</h2></div><span className={twitchReady ? "setup-pill ready" : "setup-pill"}>{twitchReady ? "CONNECTED" : "ACTION NEEDED"}</span></header>
                {twitch.authenticated ? <div className="setup-account-row"><span className="setup-avatar">{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>EventSub WebSocket · Chat messages</small></div><a href="/auth/twitch">Reconnect</a></div> : <a className="setup-connect" href="/auth/twitch">Connect with Twitch <span>→</span></a>}
              </div>
            </section>

            <section className="setup-card" id="obs">
              <div className="setup-card-number">02</div>
              <div className="setup-card-body">
                <header><div><p>OBS BROWSER SOURCE</p><h2>Place the live overlay</h2></div><span className={overlayReady ? "setup-pill ready" : "setup-pill"}>{overlayReady ? "SOURCE LIVE" : "WAITING"}</span></header>
                <p className="setup-help">Create a Browser Source at 1920 × 1080 and paste this private URL. The key is masked on screen.</p>
                <div className="setup-url"><code>{obsUrl ? maskOverlaySourceUrl(obsUrl) : "Issuing secure overlay URL…"}</code><button type="button" disabled={!obsUrl} onClick={onCopyObs}>{obsCopied ? "COPIED" : "COPY URL"}</button></div>
              </div>
            </section>

            <section className="setup-card" id="session">
              <div className="setup-card-number">03</div>
              <div className="setup-card-body">
                <header><div><p>SESSION SETTINGS</p><h2>Tune the patch cycle</h2></div><span className="setup-pill ready">READY</span></header>
                <fieldset className="setup-intensity"><legend>PATCH INTENSITY</legend>{(["mild", "spicy", "chaos"] as const).map((value) => <button type="button" className={settings.intensity === value ? "selected" : ""} onClick={() => onSettingsChange({ ...settings, intensity: value })} key={value}>{value}</button>)}</fieldset>
                <label className="setup-range" htmlFor="setup-play"><span>PLAY DURATION <output>{settings.playSeconds} SEC</output></span><input id="setup-play" type="range" min="45" max="90" step="15" value={settings.playSeconds} onChange={(event) => onSettingsChange({ ...settings, playSeconds: Number(event.target.value) })} /></label>
                <label className="setup-terms" htmlFor="setup-terms">BLOCKED TERMS · MAX 5<input id="setup-terms" value={blockedTerms} onChange={(event) => onBlockedTermsChange(event.target.value)} /></label>
                <div className="setup-automations"><span>✓ Automatic safety rollback</span><span>✓ Chat round announcements</span></div>
              </div>
            </section>

            {error && <p className="setup-error" role="alert">{error}</p>}
            <button className="setup-start" type="button" disabled={busy} onClick={onStart}>{busy ? "PREPARING SESSION…" : "START SESSION"}<span>→</span></button>
            {!twitch.authenticated && <button className="setup-demo" type="button" disabled={busy} onClick={onRunDemo}>Run scripted demo without Twitch</button>}
          </div>

          <aside className="setup-preview-column">
            <section className="setup-preview">
              <header><span>OVERLAY PREVIEW</span><code>1920 × 1080</code></header>
              <div className="setup-preview-stage"><span className="preview-kicker">CHAOS PATCH</span><strong>WAITING FOR<br />SESSION</strong><small>Chat will build the next update.</small><div className="preview-patch"><i>ACTIVE PATCH</i><b>VANILLA BUILD</b></div></div>
            </section>
            <section className="setup-progress"><header><span>SETUP PROGRESS</span><b>{readyCount}/3</b></header><div><i className={twitchReady ? "done" : ""} />Twitch chat connected</div><div><i className={overlayReady ? "done" : ""} />OBS overlay detected</div><div><i className="done" />Session rules configured</div></section>
            <section className="setup-announcement"><span>CHAT ANNOUNCEMENT</span><p>Chaos Patch is ready. Pitch with <code>!patch your idea</code>, then vote with 1, 2, or 3.</p></section>
            <button className="setup-mock" type="button" disabled={busy} onClick={onRunDemo}><span>▶</span><div><strong>MOCK CHAT</strong><small>Rehearse one complete round</small></div><b>RUN</b></button>
          </aside>
        </div>
      </section>
    </main>
  );
}
