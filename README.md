# chaos-patch

**Chaos Patch**: Twitch chat writes the patch notes and AI live-patches the game, round after round, on stream.

Built for the Codex x TwitchCon Hackathon (deadline November 2, 2026 at 2:00 PM Pacific Time). Developed in a single Codex thread; session ID submitted with the entry.

- Play 45–90s, propose 30s, vote 20s, compile in ≤6s, and apply in 5s. Chat is the game designer.
- Twitch EventSub WebSocket chat in, Helix chat out, and a dedicated 1920×1080 OBS browser-source overlay at `/overlay`
- OpenAI compresses chat ideas into three vote choices and compiles the winner to a schema-validated parameter patch
- Current Twitch emotes and the broadcaster profile image render in Emote Dodge; crashes or FPS below 20 for three seconds trigger rollback
- Streamers can copy the OBS URL, select Mild/Spicy/Chaos, set PLAY duration and blocked terms, pause the timer, and skip phases

## Local run

Requirements: Node.js 22.12+, pnpm 10+, a confidential Twitch application with callback `http://localhost:3000/auth/callback`, and an OpenAI API key.

```bash
bash scripts/setup-secrets.sh
pnpm install
pnpm dev
```

Open <http://localhost:5173>, connect the current Twitch account, and grant `user:read:chat`, `user:write:chat`, `clips:edit`, and `channel:manage:broadcast`. Add <http://localhost:5173/overlay> to OBS as a 1920×1080 Browser Source. Tokens stay in server memory and are not written to the repository.

## Verification

```bash
pnpm check
```

This runs strict TypeScript checks, unit tests, and the production build across the schema, game engine, server, and web app.

## Status

D1 vertical slice verified on 2026-10-27: Twitch OAuth, EventSub chat receive, Helix chat send, OpenAI structured patch compilation, and live game patch application all work locally.

D6 resilience verified on 2026-10-28: concurrent Twitch operations share one token refresh, and the dashboard reconnects its state WebSocket after an actual local server restart without a browser reload.

D7 preparation verified on 2026-10-28: the full project gate passes with 24 tests; a real Twitch proposal and vote returned through EventSub and shipped BUILD v3 through `gpt-4o-mini`. A final controlled Marker retry remained externally blocked by Twitch `VOD_NOT_READY`, so further Marker retries are out of scope for the main recording. See `docs/demo-runbook.md` for the 25-minute session and three-minute edit plan.

Artifact-parity pass verified on 2026-10-29: the dedicated OBS overlay, real Kappa rendering, profile-image player path, `SURVIVED / BEST` game HUD, phase-aware game freeze, AI proposal compression, low-FPS rollback guard, session settings, Pause/Resume, and mobile control-room layout are implemented. The full gate passes with 53 tests, strict type checking, and a production build.

## License

MIT
