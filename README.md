# chaos-patch

**Chaos Patch**: Twitch chat writes the patch notes and AI live-patches the game, round after round, on stream.

Built for the Codex x TwitchCon Hackathon (deadline 2026-11-02 PST). Developed in a single Codex thread; session ID submitted with the entry.

- Play 60s, propose 30s, vote 20s, apply 5s. Chat is the game designer.
- Twitch EventSub WebSocket chat in, Helix chat out, OBS browser-source overlay
- Proposals compiled to schema-validated parameter patches with automatic rollback

## Status

Planning done, implementation starting 2026-10-26. See the plan report for scope, user flows and mockups.

## License

MIT
