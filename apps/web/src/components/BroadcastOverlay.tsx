import type { BroadcastState, PatchV1 } from "@chaos-patch/schema";
import type { EmoteCatalog } from "../gameVisuals";
import { createApplyPresentation, createOverlayPresentation, createOverlayRail } from "../overlay";
import { GameCanvas } from "./GameCanvas";

type ChatLine = { userName: string; text: string };
type PatchEvent = { kind: "applied" | "rolled_back"; patch: PatchV1; automatic?: boolean };

type Props = {
  round: BroadcastState;
  twitchUser: { display_name: string; profile_image_url: string } | null;
  eventSubStatus: string;
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

  return (
    <main className={`broadcast-overlay phase-${round.phase}`}>
      <header className="broadcast-status">
        <div className="broadcast-brand"><span>CP</span>CHAOS PATCH <b>v{round.version}.0</b></div>
        <div className="broadcast-round">ROUND {round.round || "—"} · <strong>{paused ? "PAUSED" : presentation.phase}</strong></div>
        <time>{presentation.timer}</time>
        <div className={`broadcast-live ${eventSubStatus}`}><i />{eventSubStatus === "connected" ? "CHAT LIVE" : "CHAT OFFLINE"}</div>
      </header>

      <section className="broadcast-stage" aria-label="Emote Dodge live broadcast arena">
        <div className="broadcast-game-column">
          <div className="broadcast-game-toolbar">
            <span className="broadcast-game-mode">EMOTE DODGE / LIVE</span>
            <div className="broadcast-active" aria-label="Active patches">
              {rail.activeTitles.map((title) => <span key={title}>✦ {title}</span>)}
            </div>
          </div>

          <div className="broadcast-game-viewport">
            <GameCanvas
              patch={round.activePatch}
              paused={round.phase !== "play" || paused}
              emoteCatalog={emoteCatalog}
              playerImageUrl={twitchUser?.profile_image_url ?? null}
              onPatchFailure={onPatchFailure}
            />

            {round.phase === "pitch" && (
              <div className="broadcast-pitch phase-card">
                <span>PATCH PITCH</span>
                <strong><code>!patch</code> your idea</strong>
                <small>{round.proposals.length} ideas received · chat designs the next build</small>
              </div>
            )}

            {round.phase === "vote" && (
              <div className="broadcast-vote phase-card">
                <div className="broadcast-vote-title"><span>VOTE · {presentation.timer}</span><strong>{presentation.instruction}</strong></div>
                <div className="broadcast-vote-grid">
                  {presentation.candidates.map((candidate) => (
                    <article className={candidate.leading ? "leading" : ""} key={candidate.number}>
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
                <span>CHAOS COMPILER</span>
                <strong>$ chaos compile --winner</strong>
                <code>schema PatchV1 (strict)</code>
                <code>allowed knobs only · safety guard armed</code>
                <b>{compileError ?? "COMPILING…"}</b>
              </div>
            )}

            {(round.phase === "apply" || patchEvent) && round.activePatch && (
              <div className={`broadcast-apply phase-card ${patchEvent?.kind ?? "applied"}`} role="status">
                <span>{patchEvent?.kind === "rolled_back" ? "ROLLBACK COMPLETE" : "PATCH APPLIED"}</span>
                <strong>v{round.activePatch.version} · {round.activePatch.title}</strong>
                {compileError && <p className="compile-fallback">{compileError}</p>}
                <ul className="broadcast-apply-notes">
                  {applyPresentation.notes.map((note) => <li key={`${note.label}-${note.text}`}><b>{note.label}</b><span>{note.text}</span></li>)}
                </ul>
                <footer><small>proposed by @{round.activePatch.proposer}</small><small>{applyPresentation.footer}</small></footer>
              </div>
            )}
          </div>

          <div className="broadcast-next"><span>NEXT</span>{presentation.instruction}<b>· {presentation.phase} ends in {presentation.timer}</b></div>
        </div>

        <aside className="broadcast-sidecar" aria-label="Live patch information">
          <section className="broadcast-credits">
            <p>PATCH CREDITS</p>
            {rail.credits.map(({ name, count }) => <div key={name}><b>{name.slice(0, 1).toUpperCase()}</b><span>{name}</span><strong>×{count}</strong></div>)}
            {!rail.credits.length && <small>Chat authors appear here</small>}
          </section>

          <section className="broadcast-patches">
            <p>LIVE PATCH NOTES</p>
            {rail.notes.map((patch) => (
              <div className={patch.status} key={`${patch.version}-${patch.title}`}>
                <code>v{patch.version}</code><span>{patch.title}</span>
              </div>
            ))}
            <div className="base"><code>v1.0</code><span>Base game</span></div>
          </section>

          <section className="broadcast-chat">
            <p>CHAT</p>
            {rail.chat.map((line, index) => <div key={`${line.userName}-${index}`}><b>{line.userName}</b> {line.text}</div>)}
            {!rail.chat.length && <small>Waiting for the first message…</small>}
          </section>
        </aside>
      </section>
    </main>
  );
}
