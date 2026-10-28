# D7 live demo runbook

## Goal

Record one clean, camera-optional 25-minute Twitch session that proves a real audience can propose, vote on, compile, apply, and roll back a Chaos Patch. Preserve the raw OBS recording locally, then edit a public submission video to three minutes or less.

## People and privacy

- Broadcaster: the current `whalebus__97` account.
- Viewers: target 3–5 consenting participants; one participant is enough for the technical fallback rehearsal.
- Camera: not required. Keep it absent unless the broadcaster explicitly wants it.
- Microphone: enable only for intentional narration. Confirm the meter before going live.
- Hide notifications, email, API dashboards, OAuth query parameters, secrets, and unrelated tabs.
- Use only the Chaos Patch OBS Browser Source in the final composition.

## Preflight gate

Complete these checks before pressing **Start Streaming**:

1. Run `pnpm check` and require typecheck, all tests, and production build to pass.
2. Start `pnpm dev`; verify `/api/health` and the web app return HTTP 200.
3. Connect Twitch and require the dashboard to show the broadcaster plus `EventSub connected`.
4. Confirm OBS has no camera source, the intended audio state, and zero active stream/record timers.
5. Confirm `screenshot/` and `videos/` are ignored and `.env.local` is not visible.
6. Tell viewers to use `!patch <idea>` during PITCH and `1`, `2`, or `3` during VOTE.

If the automated gate fails, do not start the broadcast. If Twitch chat fails, reconnect once; use Mock Chat only after showing the degraded state and explaining that it is the artifact-approved fallback.

## 25-minute session

| Time | Action | Proof to preserve |
|---|---|---|
| 00:00–02:00 | Introduce “chat ships the next update” and show EventSub connected. | Clean dashboard opening. |
| 02:00–07:00 | Start the session. Collect three real `!patch` ideas and three or more votes. | Chat wire, candidate list, moving vote counts. |
| 07:00–10:00 | Compile the winner and play the changed build. | Compile state, PATCH APPLIED, visible parameter change. |
| 10:00–15:00 | Run a deliberately chaotic second patch and trigger the six-second health check. | Automatic rollback and restored prior build. |
| 15:00–18:00 | Let one VOTE close with zero votes. | No compile request and no unnecessary OpenAI call. |
| 18:00–21:00 | Show recap and patch history. | Shipped/rolled-back counts and active build. |
| 21:00–23:00 | Mention reconnect/token-refresh coverage and the tested Mock Chat fallback. | Keep the live product on screen; do not expose terminals or secrets. |
| 23:00–25:00 | Summarize the Twitch, Codex, and OpenAI roles; end the stream cleanly. | Final dashboard frame and OBS zero-loss status. |

Do not spend live-demo time retrying Twitch Clip or Marker. Three controlled broadcasts already isolated Marker failure to Twitch `VOD_NOT_READY`; the limitation is documented in `docs/submission-evidence.md`.

## Capture names

- Raw main session: `videos/2026-10-XX-d7-main-session.mov`
- Final edit: `videos/chaos-patch-devpost-final.mp4`
- Latest focused proof: `screenshot/current-screen.png`

Raw captures remain ignored. Inspect a frame near the beginning, the patch application, rollback, and ending before treating the recording as valid.

## Final video edit — maximum three minutes

| Cut | Target | Content |
|---|---:|---|
| Hook | 00:00–00:12 | “Twitch chat writes the patch notes. AI ships them live.” Show the game and chat together. |
| Real Twitch input | 00:12–00:42 | EventSub connected, three proposals, and voting. |
| AI compilation | 00:42–01:12 | Winner → schema-constrained PatchV1 → BUILD increment. |
| Visible game change | 01:12–01:42 | Patch applied and gameplay visibly changes. |
| Safety | 01:42–02:06 | Six-second health check and automatic rollback. |
| Recap and resilience | 02:06–02:30 | Patch history, no-vote guard, reconnect and token-refresh test proof. |
| Codex evidence | 02:30–02:48 | Brief redacted `/status`, Session ID, and test result. |
| Close | 02:48–03:00 | Architecture summary and project URL. |

Use English narration or English subtitles. Do not claim Clip or Marker succeeded; if mentioned, label the live Marker path as externally blocked by Twitch VOD readiness.

## Stop conditions

- Stop immediately if a secret, email address, private notification, or unrelated account appears.
- Stop if the camera appears unexpectedly or an unintended microphone becomes active.
- Stop after repeated network loss or nonzero sustained dropped frames; preserve the failed rehearsal only as private diagnostic evidence.
- Never regenerate OAuth credentials or expose a stream key during recording.
