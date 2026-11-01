# Devpost submission draft

Official deadline: **November 2, 2026 at 2:00 PM Pacific Time**. Source: [Codex x TwitchCon Hackathon official rules](https://twitchcon-codex.devpost.com/rules).

Replace every `TODO` before submission. Keep all submitted materials in English.

## Project name

Chaos Patch

## Tagline

Twitch chat writes the patch notes, and AI ships them live.

## Repository

https://github.com/sh0sub/chaos-patch

Repository visibility before submission: `TODO — verify public, or share a private GitHub repository with testing@devpost.com`

## Demonstration video

`TODO — public YouTube URL`

The final video must be under three minutes, show the project functioning on Twitch, show how it was built with Codex, and avoid unlicensed music or third-party copyrighted material.

## Codex Session ID

`01a1788b-2f7f-7f11-b496-5fe706a6e0fa`

Use the single Codex thread in which the project was implemented, tested, documented, and prepared for submission.

## Inspiration

Most Twitch interactions ask viewers to react to a finished game. Chaos Patch lets them rewrite the game while the stream is still running. The audience proposes changes in chat, votes on the next update, and immediately sees a new build—or watches the safety system roll it back.

## What it does

Chaos Patch is a live Twitch game and broadcast control room built around a repeatable loop:

1. The streamer plays Emote Dodge.
2. Viewers send `!patch <idea>` in Twitch chat.
3. The server turns the proposals into three candidates.
4. Viewers vote with `1`, `2`, or `3`.
5. OpenAI compiles the winning idea into a schema-constrained `PatchV1`.
6. The browser game applies the patch as a new BUILD.
7. A six-second health check automatically rolls back a patch that destabilizes the run.

The dashboard shows the live phase, timer, proposals, votes, Twitch connection state, active build, patch history, recap, and emergency rollback control. A local Mock Chat input keeps rehearsals possible when Twitch is unavailable, while the main flow uses real Twitch chat.

## How we built it

- **Twitch Authorization Code flow** authenticates the current broadcaster without storing OAuth tokens on disk.
- **Twitch EventSub WebSockets** receive `channel.chat.message` events.
- **Twitch Helix** sends chat messages and implements the optional stream Marker path.
- **OpenAI Responses API** converts the winning candidate into a structured, schema-validated game patch using `gpt-4o-mini`.
- **Fastify and WebSockets** coordinate the round state and push snapshots to the dashboard.
- **React, Vite, and Canvas** render the streamer control room and playable Emote Dodge arena.
- **OBS Browser Source** turns the same dashboard into the live broadcast overlay.
- **Vitest and strict TypeScript** cover the patch schema, game behavior, Twitch client, HTTP flow, recap formatting, Marker formatting, and browser reconnection.

Safety and cost controls are part of the product behavior:

- Patch parameters are bounded by a strict `PatchV1` schema.
- Server-owned fields such as version and proposer are normalized before application.
- A VOTE with zero votes skips OpenAI compilation.
- Overlapping compile requests share one in-flight operation.
- A failed six-second health check automatically restores the previous build.
- Concurrent Twitch operations share one token refresh.
- The browser reconnects its state socket after a server restart without requiring a page reload.

## How we used Codex

The entire project was developed in one continuous Codex thread. Codex helped turn the product plan into a tracer-bullet implementation, inspect current Twitch and OpenAI documentation, build each behavior test-first, run mechanical gates, operate the local Twitch/OBS rehearsal, diagnose external integration failures, and maintain submission evidence.

For each behavior change, we added or updated focused tests before moving to the next task. Once several behaviors formed a coherent user flow, Codex ran integration tests and then verified the flow against the real Twitch account. The submitted Codex Session ID links the implementation, test, and live-verification history.

Codex is the development agent. The live product uses the OpenAI Responses API—not a hidden Codex session—to compile viewer ideas into bounded runtime patches.

## Challenges we ran into

The hardest boundary was distinguishing application defects from Twitch channel state. Twitch chat, OAuth, EventSub, token refresh, and Helix chat all worked in live tests. Clip creation consistently returned `403 User not authorized to create clips`. We implemented the rules-approved Marker alternative and tested it during several healthy broadcasts, but Twitch returned `404 VOD_NOT_READY` even after a five-minute stream with past broadcasts and publishing enabled.

We preserved the exact external error, verified the request path and OAuth scope with automated tests, confirmed OBS had zero dropped frames, and stopped spending demo time on repeated retries. Clip and Marker are therefore documented as an externally blocked optional path and are not presented as successful functionality in the video.

Another useful failure was a no-participant round that could have triggered an unnecessary model call. We added a no-vote guard and duplicate-compile suppression before recording the main demo.

## Accomplishments that we're proud of

- A real Twitch `!patch` proposal and public chat vote traveled through EventSub and shipped BUILD v3.
- The applied patch visibly changes the game without deploying new frontend code.
- Unsafe patches can roll back automatically while preserving a clear recap trail.
- The same interface works as a desktop control room, mobile dashboard, and OBS overlay.
- The project gate currently passes strict type checking, 111 automated tests, and a production build.
- Raw evidence captures are kept outside Git, while the repository contains reproducible tests and clear setup instructions.

## What we learned

Interactive streaming systems need two kinds of safety: gameplay safety and integration safety. A bounded patch schema protects the game, while idempotent compilation, token-refresh coordination, reconnect behavior, and explicit degraded states protect the live show. We also learned to treat successful external API requests and successful viewer-visible outcomes as separate milestones.

## What's next for Chaos Patch

- Publish the verified 2:10 submission cut and add captions on the hosting platform.
- Add more Emote Dodge patch parameters while keeping the same bounded schema.
- Add a separate branded chat bot account after the broadcaster-owned MVP.
- Revisit Twitch Clip/Marker only after the channel becomes VOD-eligible.
- Add a reusable patch preset library and post-stream audience analytics after the hackathon.

## Testing instructions for judges

Requirements: Node.js 22.12+, pnpm 10+, a Twitch developer application, a Twitch broadcaster account, and an OpenAI API key.

1. Clone the repository.
2. Run `pnpm install`.
3. Run `bash scripts/setup-secrets.sh` and enter credentials without recording the screen.
4. Set the Twitch application callback to `http://localhost:3000/auth/callback`.
5. Run `pnpm check`; all checks must pass.
6. Run `pnpm dev` and open `http://localhost:5173`.
7. Connect the Twitch broadcaster account.
8. Start a session, advance to PITCH, and send three `!patch` messages from Twitch chat.
9. Advance to VOTE and send `1`, `2`, or `3`.
10. Compile the winner and verify that BUILD increments and the active game parameters change.
11. Use Mock Chat only if Twitch is unavailable; it exercises the same proposal and vote state machine after ingestion.

The project is free to run for judging. API usage is limited to the entrant's configured Twitch and OpenAI credentials.

## Final submission checklist

- [ ] Repository URL is accessible to judges and contains all source, assets, and instructions.
- [x] `pnpm check` passes from the final commit (111 tests, strict type checking, production build).
- [x] Text description is in English and accurately distinguishes Codex from the runtime OpenAI API.
- [x] Codex Session ID is copied from the final redacted `/status`.
- [ ] Public YouTube video is under three minutes (verified local 2:11.40 V3 cut is ready to upload).
- [x] Video shows the project functioning on Twitch.
- [x] Video shows how Codex was used to build it.
- [x] Video contains no secrets, personal tabs, unlicensed music, or unsupported success claims.
- [ ] Final Devpost submission is completed before November 2, 2026 at 2:00 PM Pacific Time.
- [ ] Submission confirmation is captured after the final submit action.
