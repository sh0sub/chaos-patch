import type { BroadcastState, PatchV1 } from "@chaos-patch/schema";
import type { EmoteCatalog } from "../gameVisuals";
import type { TwitchEventSubStatus } from "../twitchStatus";
import { createApplyPresentation, createCompilePresentation, createOverlayPresentation, createOverlayRail, createPitchPresentation, createRollbackLabel, createVoteRailPresentation, formatOverlayVersion } from "../overlay";
import { GameCanvas } from "./GameCanvas";

type ChatLine = { userName: string; text: string };
type PatchEvent = { kind: "applied" | "rolled_back"; patch: PatchV1; automatic?: boolean };

type Props = {
  round: BroadcastState;
  twitchUser: { display_name: string; profile_image_url: string } | null;
  eventSubStatus: TwitchEventSubStatus;
  chat: ChatLine[];
  patchEvent: PatchEvent | null;
  compileError: string | null;
  emoteCatalog: EmoteCatalog;
  paused: boolean;
  onPatchFailure: (version: number, reason: "early_crash" | "low_fps") => void;
};

export function BroadcastOverlay({ round, twitchUser, eventSubStatus, chat, patchEvent, compileError, emoteCatalog, paused, onPatchFailure }: Props) {
  const presentation = createOverlayPresentation(round);
  const rail = createOverlayRail(round, chat);
  const applyPresentation = createApplyPresentation(round);
  const pitchPresentation = createPitchPresentation(round);
  const voteRail = createVoteRailPresentation(round);
  const compilePresentation = createCompilePresentation(round);
  const rolledBack = patchEvent?.kind === "rolled_back";
  const visiblePatch = round.activePatch ?? patchEvent?.patch ?? null;

  return (
    <main className={`broadcast-overlay phase-${round.phase}${rolledBack ? " rollback-active" : ""}`}>
      <header className="broadcast-status">
        <div className="broadcast-brand">
          <span className="broadcast-brand-mark">⚡</span>
          <span>CHAOS <em>PATCH</em></span>
          <b className="broadcast-version">{round.activePatch ? formatOverlayVersion(round.version) : "v1.0"}</b>
        </div>
        <div className="broadcast-round">ROUND {round.round || "—"} · <strong>{paused ? "PAUSED" : presentation.phase}</strong></div>
        <time>{presentation.timer}</time>
        <div className={`broadcast-live ${eventSubStatus}`}><i />{eventSubStatus === "connected" ? "CHAT LIVE" : "CHAT OFFLINE"}</div>
      </header>

      <section className="broadcast-stage" aria-label="Emote Dodge live broadcast arena">
        <div className="broadcast-game-column">
          <div className="broadcast-game-viewport">
            <div className="broadcast-game-toolbar">
              <span className="broadcast-game-mode">EMOTE DODGE / LIVE</span>
              <div className="broadcast-active" aria-label="Active patches">
                {rail.activeTitles.map((title) => <span key={title}>✦ {title}</span>)}
              </div>
            </div>
            <GameCanvas
              patch={round.activePatch}
              paused={round.phase !== "play" || paused}
              emoteCatalog={emoteCatalog}
              playerImageUrl={twitchUser?.profile_image_url ?? null}
              playerLabel={twitchUser?.display_name ?? null}
              onPatchFailure={onPatchFailure}
            />

            {round.phase === "pitch" && (
              <>
                <div className="broadcast-pitch">
                  <strong>PATCH PITCH — <code>!patch &lt;idea&gt;</code> · <time>{pitchPresentation.timer}</time></strong>
                </div>
                <div className="broadcast-pitch-ticker">
                  {pitchPresentation.ticker.length ? pitchPresentation.ticker.map((idea) => <span key={`${idea.userName}-${idea.text}`}><b>{idea.userName}</b> {idea.text}</span>) : <span>WAITING FOR CHAT IDEAS…</span>}
                </div>
              </>
            )}

            {round.phase === "vote" && (
              <div className="broadcast-vote phase-card">
                <div className="broadcast-vote-title"><span>VOTE</span><time className={presentation.urgent ? "urgent" : undefined}>{presentation.timer}</time><strong>{presentation.instruction}</strong></div>
                <div className="broadcast-vote-grid">
                  {presentation.candidates.map((candidate) => (
                    <article className={candidate.leading ? "leading" : candidate.tied ? "tied" : ""} key={candidate.number}>
                      {candidate.leading && <em className="vote-leading">LEADING</em>}
                      <span>{candidate.number}</span>
                      <h2>{candidate.title}</h2>
                      <p>{candidate.description}</p>
                      <small>by {candidate.proposer}</small>
                      <b>{candidate.votes}</b>
                      <i style={{ "--vote": `${Math.min(100, candidate.votes * 2)}%` } as React.CSSProperties} />
                    </article>
                  ))}
                </div>
              </div>
            )}

            {round.phase === "compile" && (
              <div className="broadcast-compile phase-card" role="status">
                <header><span>CHAOS COMPILER</span><i className="compile-cursor" aria-hidden="true" /></header>
                {compilePresentation.map((line, index) => <code style={{ animationDelay: `${index * 380}ms` }} key={line}>{line}</code>)}
              </div>
            )}

            {(round.phase === "apply" || patchEvent) && visiblePatch && (
              <div className={`broadcast-apply phase-card ${patchEvent?.kind ?? "applied"}`} role="status">
                <span>{rolledBack ? createRollbackLabel(round) : "PATCH APPLIED"}</span>
                <strong>{rolledBack ? "SAFE BUILD RESTORED" : `${formatOverlayVersion(visiblePatch.version)} · ${visiblePatch.title}`}</strong>
                {!rolledBack && compileError && <p className="compile-fallback">{compileError}</p>}
                {!rolledBack && (
                  <ul className="broadcast-apply-notes">
                    {applyPresentation.notes.map((note) => <li key={`${note.label}-${note.text}`}><b>{note.label}</b><span>{note.text}</span></li>)}
                  </ul>
                )}
                <footer>
                  <small>{rolledBack ? "health guard restored a safe build" : `proposed by @${visiblePatch.proposer}`}</small>
                  <small>{rolledBack ? createRollbackLabel(round) : applyPresentation.footer}</small>
                </footer>
              </div>
            )}
          </div>

          <div className="broadcast-next">
            <span>NEXT</span>
            {round.phase === "play" ? <>NEXT PITCH: TYPE <code>!patch &lt;idea&gt;</code> IN CHAT</> : presentation.instruction}
            <b>· {presentation.phase} ends in {presentation.timer}</b>
          </div>
        </div>

        <aside className="broadcast-sidecar" aria-label="Live patch information">
          {round.phase === "vote" ? (
            <>
              <section className="broadcast-vote-results">
                <p>PITCH RESULTS</p>
                <strong>{voteRail.ideaCount}</strong>
                <small>compressed to {round.candidates.length} choices</small>
                {voteRail.proposals.map((proposal) => <div key={`${proposal.userName}-${proposal.text}`}><b>{proposal.userName}</b><span>{proposal.text}</span></div>)}
              </section>
              <section className="broadcast-live-votes">
                <p>LIVE VOTES</p>
                {voteRail.liveVotes.map((candidate) => <div key={candidate.number}><b>{candidate.number}</b><span>{candidate.title}</span><strong>{candidate.votes}</strong></div>)}
              </section>
            </>
          ) : (
            <>
              <section className="broadcast-credits">
                {round.phase === "pitch" && <strong className="pitch-idea-count">{pitchPresentation.ideaCount}</strong>}
                <p>PATCH CREDITS</p>
                {rail.credits.map(({ name, count }) => <div key={name}><b>{name.slice(0, 1).toUpperCase()}</b><span>{name}</span><strong>×{count}</strong></div>)}
                {!rail.credits.length && <small>Chat authors appear here</small>}
              </section>

              <section className="broadcast-patches">
                <p>LIVE PATCH NOTES</p>
                {rail.notes.map((patch) => (
                  <div className={patch.status} key={`${patch.version}-${patch.title}`}>
                    <code>{formatOverlayVersion(patch.version)}</code><span>{patch.title}</span>
                  </div>
                ))}
                <div className="base"><code>v1.0</code><span>Base game</span></div>
              </section>

              <section className="broadcast-chat">
                <p>CHAT</p>
                {rail.chat.map((line, index) => <div key={`${line.userName}-${index}`}><b>{line.userName}</b> {line.text}</div>)}
                {!rail.chat.length && <small>Waiting for the first message…</small>}
              </section>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
