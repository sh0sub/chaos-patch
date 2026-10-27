# chaos-patch

**Chaos Patch**: Twitch chat writes the patch notes and AI live-patches the game, round after round, on stream.

Built for the Codex x TwitchCon Hackathon (deadline 2026-11-02 PST). Developed in a single Codex thread; session ID submitted with the entry.

- Play 60s, propose 30s, vote 20s, apply 5s. Chat is the game designer.
- Twitch EventSub WebSocket chat in, Helix chat out, OBS browser-source overlay
- Proposals compiled to schema-validated parameter patches with automatic rollback

## Local run

Requirements: Node.js 22+, pnpm 10+, a confidential Twitch application with callback `http://localhost:3000/auth/callback`, and an OpenAI API key.

```bash
bash scripts/setup-secrets.sh
pnpm install
pnpm dev
```

Open <http://localhost:5173>, connect the current Twitch account, and grant `user:read:chat`, `user:write:chat`, `clips:edit`, and `channel:manage:broadcast`. Tokens stay in server memory and are not written to the repository.

## Verification

```bash
pnpm check
```

This runs strict TypeScript checks, unit tests, and the production build across the schema, game engine, server, and web app.

## Status

D1 vertical slice verified on 2026-10-27: Twitch OAuth, EventSub chat receive, Helix chat send, OpenAI structured patch compilation, and live game patch application all work locally.

D6 resilience verified on 2026-10-28: concurrent Twitch operations share one token refresh, and the dashboard reconnects its state WebSocket after an actual local server restart without a browser reload.

## License

MIT
