# Submission evidence plan

## Thread continuity

- Continue the project in the current Codex thread through submission.
- Do not use `codex fork`.
- When resuming locally, use `codex resume <SESSION_ID>` and verify continuity with `/status`.
- Submit the Codex Session ID required by the hackathon form.

## Agent reminder rule

The agent should proactively tell the user when the current work reaches a useful evidence moment. The reminder must state:

1. whether a screenshot, screen recording, or both are useful;
2. exactly what should be visible;
3. whether sensitive or personal information must be hidden;
4. a short suggested filename.

Do not interrupt routine edits. Suggest capture only when the result proves a meaningful milestone or would be difficult to recreate later.

## Daily screenshot

- Capture one focused screenshot per workday after a meaningful milestone.
- Prefer the Codex terminal or relevant app window rather than the entire desktop.
- When useful, include `/status`, the date, the successful command or test result, and the implemented feature.
- Keep raw screenshots in `screenshot/`, which is ignored by Git.
- Before public use, crop or redact email addresses, tokens, unrelated tabs, and other personal information.

## Recording milestones

Record short raw clips when these moments occur:

- D1: Twitch OAuth succeeds, EventSub receives the first real chat message, and Helix sends the first chat echo.
- D2: Emote Dodge is playable and a `PatchV1` parameter visibly changes gameplay.
- D3: chat proposal ingestion completes the PITCH → VOTE → COMPILE → APPLY loop, including Mock Chat fallback.
- D4: OBS overlay shows voting, compile animation, patch application, and automatic rollback.
- D5: dashboard, clip or marker integration, recap, and a rehearsal with real participants.
- D6: reconnect and token-refresh tests pass; capture a concise Codex review/test result if it is visually useful.
- D7: record the main 25-minute live session and the clean Codex implementation-to-test-to-live-patch sequence. Edit the final video to under three minutes.
- D8: capture the final `/status`, public repository, public YouTube video, and submitted Devpost confirmation as separate proof where permitted.

## Final video target

- Collect raw evidence throughout development; do not wait until D7 to recreate early milestones.
- Perform the primary recording and final edit on D7.
- Keep the final public video at or below three minutes with English narration or subtitles.
- Show `/status` and the Session ID briefly, but hide account email, tokens, OAuth codes, environment values, and unrelated browser content.

## Evidence status

- D1 raw desktop screenshot captured at `screenshot/current-screen.png`.
- The current screenshot is local evidence only because it contains personal and unrelated on-screen information; prepare a cropped or redacted version before public submission.
- On 2026-10-27, the local dashboard rendered with playable Emote Dodge, Twitch OAuth completed, EventSub reached `connected`, and a Helix message returned through EventSub into **Chat wire**.
- OpenAI returned a schema-valid patch and the runtime applied it. Typecheck, 17 automated tests, and the production build passed.
- The ignored `screenshot/current-screen.png` is intentionally reused for the latest focused evidence image; earlier milestones remain preserved in the raw recordings and this log.
- D1 recording completed at `videos/2026-10-27-d1-twitch-eventsub.mov`: 40.16 seconds, H.264, showing EventSub connected, a real Twitch proposal and vote, OpenAI compilation, BUILD v2, and the next round.
- D2 browser verification completed on 2026-10-27: Emote Dodge is playable, a compiled `controlsMirrored` patch starts a fresh run, and the run-end state has keyboard and visible restart controls.
- D3 local fallback verification completed on 2026-10-27: three Mock Chat proposals advanced through PITCH → VOTE, a chat vote selected the winner, OpenAI compiled a schema-valid BUILD v2 patch, and APPLY updated the game and history.
- D4 implementation and live verification completed on 2026-10-27: the OBS Browser Source showed EventSub connected, a real Twitch `!patch instant lava floor` proposal, a real `1` vote, OpenAI compilation, BUILD v3 application, and automatic rollback after the six-second health check failed.
- The clean D4 OBS recording is stored at `videos/2026-10-27-d4-live-auto-rollback.mov`: 35.37 seconds, H.264/AAC, 1280×720, 30 fps. Frames at 27s and 31s were inspected to verify the PATCH APPLIED and AUTO ROLLBACK overlays.
- A discovered no-participant cost leak was fixed before D4 recording: vote windows with zero votes now skip compilation, and overlapping compile requests share one external compilation. Three Fastify HTTP integration tests cover no-vote skipping, duplicate compile suppression, and OAuth → EventSub startup.
- D5 recap is implemented and verified through the HTTP interface, a web formatting test, and desktop/mobile browser checks. It reports BUILD, shipped patches, rollbacks, active patch, and recent patch outcomes.
- D5 Twitch Clip integration reached Twitch during three real broadcasts, but both the labeled request and the minimal `broadcaster_id` fallback returned `403 User not authorized to create clips`. This confirms a Twitch channel/account restriction rather than an untested request shape; the dashboard preserves and displays Twitch's exact error.
- D5 then switched to the artifact-approved **clip or marker** path. OAuth now includes `channel:manage:broadcast`; the Twitch client, HTTP endpoint, dashboard action, and marker-position formatter are covered by automated tests.
- On 2026-10-28, the marker path was exercised during a real, camera-free and microphone-muted OBS broadcast. OBS streamed for about two minutes at roughly 6 Mbps with zero lost frames. Twitch received three marker requests but returned `404 VOD_NOT_READY` each time, including after the first minute, so successful marker creation remains externally blocked by Twitch's VOD readiness state. The broadcast was stopped immediately after verification.
- A second live marker verification on 2026-10-28 ran for 5:12 at roughly 6.1 Mbps with zero lost frames, no camera source, and the microphone muted. Marker requests after three and five minutes still returned `404 VOD_NOT_READY`. Twitch settings visibly showed **Store past broadcasts**, **Always publish VODs**, and clips enabled, while Video Producer showed no matching video after the stream ended. This narrows the remaining blocker to Twitch's channel-side VOD creation rather than the app request, OAuth scope, stream duration, or dashboard settings.
- The D5 marker implementation is therefore code- and integration-tested but not yet valid submission proof. Do not describe it as a successful live marker until Twitch returns a marker ID and position.
- The same five-minute broadcast also completed a mixed live/fallback integration rehearsal: a real Twitch `!patch giant emotes` message arrived through EventSub; a no-vote round skipped compilation; the next round accepted three Mock Chat fallback proposals and a vote; OpenAI compiled `Mirrored Controls` as BUILD v2; the game applied it, failed the six-second health check, automatically rolled it back, and recap reported one rollback with the vanilla build restored.
- D6 token-refresh resilience is covered by a concurrency test: simultaneous chat and marker operations share one in-flight refresh and both use the rotated access token.
- D6 browser recovery was verified both by an isolated lifecycle test and an actual server restart on 2026-10-28. Without reloading the page, the open dashboard reconnected after one second and received the new server's `Twitch disconnected / BUILD v1 / IDLE` snapshot. OAuth returning to disconnected is expected because tokens intentionally remain in server memory only.
- Responsive browser checks passed at 360, 390, 720, 1024, and 1440 px with no horizontal overflow. No browser console errors or warnings were observed during the verified loop.
- On 2026-10-31, the responsive contract was re-verified with the same-origin dashboard report at 360, 390, 720, 1024, and 1440 CSS px. All five viewports reported `document.scrollWidth <= document.clientWidth`; the 720 CSS px case also covers a 1440 px desktop at 200% browser zoom, and expanded patch details stack to one column at that width. The local report is stored at ignored `screenshot/responsive-check.html`.
- On 2026-10-31, the dedicated `/recap` flow was verified end to end without Twitch: the scripted demo seeded 10 proposals and 12 votes, OpenAI compiled BUILD v2 `Kappa Flood`, and the recap rendered the KST session date, patch/contributor counts, 6-vote leaderboard entry, full build timeline, and `@demo_chat` credit. The share action copied the recap URL and correctly reported `Link copied` while Twitch was disconnected; the completed page was captured in the Codex browser deliverable.
- D7 preparation baseline passed on 2026-10-28: `pnpm check` completed with 24 tests, type checking, and the production build; a fresh local rehearsal completed three proposals, one vote, a real `gpt-4o-mini` compilation, BUILD v2 application, and recap update. Twitch OAuth was then renewed and EventSub returned to `connected`. The latest focused, browser-chrome-free proof is stored at `screenshot/current-screen.png`.
- The following real-channel check also passed: Helix sent `!patch giant emotes` and vote `1` to `whalebus__97`; both returned through EventSub, the proposal received one vote, `gpt-4o-mini` compiled it, and BUILD v3 `Giant Emotes` became active. A secret-free local summary is stored at `screenshot/verification-report.html`; `screenshot/current-screen.png` shows the active patch in the live dashboard.
- The final planned Marker retry on 2026-10-28 used a camera-free, microphone-muted OBS broadcast and simultaneous local recording. At 03:01, while OBS reported roughly 6.17 Mbps and zero lost frames, the single Marker request again returned `404 VOD_NOT_READY`. The broadcast was stopped at 03:13 and no further retry was made. The clean 03:23 H.264/AAC 1280×720 recording is stored at `videos/2026-10-28-d5-marker-vod-not-ready.mov`; this confirms the remaining Marker limitation is external and closes further D5 retry work.
- Judge-environment reproduction on 2026-10-29 found that Node 22.1 could install without the ESM interop required by `light-my-request → cookie@2`, causing all six HTTP integration tests to fail only in a clean checkout. The repository now declares and enforces Node 22.12+, includes `.nvmrc` for 22.13.1, and pins the web toolchain instead of following `latest`. A second fresh checkout on Node 22.13.1 passed installation, all 24 tests, type checking, and the production build.
- The 2026-10-29 artifact-parity pass added a dedicated `/overlay` broadcast surface, current Twitch emote lookup with an official Kappa rehearsal fallback, broadcaster profile rendering, AI compression of full PITCH queues into three attributed candidates, FPS<20/3s rollback monitoring, bounce/camera-shake/fog patch effects, and streamer session controls for intensity, PLAY duration, blocked terms, Pause/Resume, and Skip.
- A real `gpt-4o-mini` compression request merged five proposals (including two similar Kappa ideas) into three candidates while preserving the selected proposers. The 390px dashboard check showed no horizontal overflow, and Pause held the timer unchanged for more than two seconds before Resume.
- The final game-screen parity gap was closed on 2026-10-29: the canvas now shows the planned `SURVIVED / BEST` HUD, freezes outside PLAY, suppresses the run-ended layer and restart controls during PITCH/VOTE, and ignores keyboard restart while frozen. A live browser check held `00:09` unchanged through PITCH.
- A second real-channel pass on 2026-10-29 reconnected `whalebus__97`, loaded its Twitch profile and current emote catalog, received three Helix-sent proposals and a vote through EventSub, compressed them with OpenAI, and rendered the compiled Kappa patch in both the dashboard and `/overlay`.
- That pass exposed a completed-round race where a late duplicate compile could apply BUILD v2 and v3. A public HTTP regression test now verifies sequential duplicate requests return the same build, the server caches one result per round, and live verification confirmed two requests both returned BUILD v2 with one history entry.
- The latest ignored `screenshot/current-screen.png` is a browser-chrome-free OBS overlay capture showing BUILD v2, real Kappa emote obstacles, the Twitch profile player, and the intentionally paused evidence frame. No token or email is visible.
- A Tailnet-only game showcase is available at `https://home.tail5cbec7.ts.net/chaos-patch/screenshot/game-showcase.html`, with the live dashboard and overlay on HTTPS port `9445`. Vite allows only the exact Tailnet hostname in addition to its normal local hosts; the full project gate passes with 52 tests, strict type checking, and the production build.
- The 2026-10-29 M3 visual-parity pass replaced the full-bleed grid overlay with the artifact layout: a framed pixel arena, platform/coin/city scenery, in-frame run HUD, active patch chips, a fixed `Patch Credits → Live Patch Notes → Chat` side rail, and the bottom `NEXT` prompt. The real BUILD v2 Kappa patch was resumed long enough to verify moving Twitch emotes, then returned to PAUSED. `pnpm check` passed 53 tests, type checking, and the production build. The cropped, browser-chrome-free proof is stored at `screenshot/current-screen.png` with no token or email visible.
