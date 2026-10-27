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
- The connected D4 rollback screenshot is saved locally at `screenshot/current-screen.png`; it replaces the earlier D1 desktop capture so the ignored screenshot folder retains one evidence image.
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
- The D5 marker implementation is therefore code- and integration-tested but not yet valid submission proof. Do not describe it as a successful live marker until Twitch returns a marker ID and position.
- D6 token-refresh resilience is covered by a concurrency test: simultaneous chat and marker operations share one in-flight refresh and both use the rotated access token.
- D6 browser recovery was verified both by an isolated lifecycle test and an actual server restart on 2026-10-28. Without reloading the page, the open dashboard reconnected after one second and received the new server's `Twitch disconnected / BUILD v1 / IDLE` snapshot. OAuth returning to disconnected is expected because tokens intentionally remain in server memory only.
- Responsive browser checks passed at 360, 390, 720, 1024, and 1440 px with no horizontal overflow. No browser console errors or warnings were observed during the verified loop.
