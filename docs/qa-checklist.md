# Chaos Patch · QA pass against the artifact plan (2026-10-31)

Source of truth: the Twitch — Chaos Patch artifact plan (blocks 05 feature list, 06 user flow, 07 screen mockups M1–M7) and `docs/design.md`.
Work top-down. Add or update a focused test before each fix, keep `pnpm check` green, and commit per item.

## P0 · Gate

- [x] `pnpm check` fails: `server.integration.test.ts > runs candidate compression when the timed pitch closes` expects `phase: "vote"` but gets `{ round: 2, phase: "play", candidates: [] }`. With `tickMilliseconds: 2`, PITCH (30 ticks) + VOTE (20 ticks) both expire inside the 120 ms wait and the round rolls to PLAY with no votes. Make the test deterministic (assert right after compression resolves, or cast a vote so VOTE does not expire into PLAY) instead of sleeping.
- [x] Commit the pending working-tree changes (session settings, candidate compression, blocked terms, pause) once green.

## P1 · Feature gaps vs MVP list

- [x] F10 chat announcements are missing. `/api/twitch/send` exists but nothing calls `sendChatMessage` on phase transitions. Add three automatic bot messages per round (≤500 chars, ≤2 emoji, max 3 per round):
  - PITCH start: `PATCH PITCH (30s) — !patch <your idea> to change the game. Current v{version}`
  - VOTE start: `1) {title} 2) {title} 3) {title} — type 1, 2 or 3`
  - APPLY: `v{version} applied: {title} — proposed by @{proposer} ({votes} votes)`
  - Swallow Helix errors (429/403) and never block the round on a failed send.
- [x] COMPILE has no timeout or cached-patch fallback. If `compileCandidate` throws (network/timeout), the round sticks in `compile` forever (`tick()` returns null there). Spec: 6 s timeout → one retry → on failure apply a cached/seed patch and show `compile failed → applying cached patch '{title}'` on the overlay. The web client also ignores the `compile:error` WS message today.
- [x] Apply card shows only `notes[0]`. Render all notes (max 3) as a NEW/BALANCE list and add `{votes} votes · Round {n}` to the footer.
- [x] `labelTitle` is in `patchParamsSchema` and `defaultPatchParams` but is never drawn. Render it as the arena title (or drop it from the schema and the prompt).
- [x] Mock mode for judges: add a scripted proposal set (≥10 seeded `!patch` ideas + votes) runnable without a Twitch account, and document the no-Twitch path in README (today "Local run" requires a Twitch app + OpenAI key).
- [ ] Blocked proposals are dropped silently. Show them in the dashboard chat wire as `[filtered]` in muted grey, and count `filtered` next to the proposal count.

## P2 · Overlay (M3–M5) design spec

- [ ] Minimum text sizes on the 1920×1080 overlay: body ≥28 px, captions ≥20 px, right-rail mono ≥22 px, version ≥36 px. Current sidecar (Patch Credits, Live Patch Notes, Chat, NEXT bar, mode label) is 9–12 px and unreadable on the mobile Twitch player.
- [ ] VOTE cards (M4): three cards 360×420, gap 40, centered 1160 px; number 72 px, title 32 px, description 24 px, proposer line, vote bar 16 px, countdown 64 px. Current: number 28 px, description 14 px, bar 12 px, countdown 34 px.
- [ ] VOTE: leading card gets a `LEADING` chip plus the lime border; vote bars use Twitch purple `#9146FF` (not lime); bar animates with a ~250 ms spring; countdown pulses 1.0→1.15 during the last 5 s; tie = both cards white border until the timer ends.
- [ ] PITCH (M4 top): dim the paused game to 60 %, top banner 900×96 `PATCH PITCH — !patch <idea> · 00:30`, bottom ticker streaming incoming proposals with nick in `#9146FF`, right rail `{n} ideas` count-up.
- [ ] COMPILE (M5): 760×240 terminal, mono 26 px, cyan cursor, lines typed in the order the LLM fields arrive (title → params diff → notes → `safety ok`). Current card is static text.
- [ ] APPLY (M5): 150 ms RGB-split glitch → patch-note card slides in 400 ms ease-out-back → hold 3.5 s → fade. Current: 360 ms blur fade only.
- [ ] Rollback: 1 s magenta border on the game frame plus `ROLLBACK → v{restored}` text; current card text says `ROLLBACK COMPLETE` without the arrow/version.
- [ ] Game feel: 120 ms scale pop on spawn, shake on hit (independent of the `cameraShake` knob), score pulse every 10 s survived.

## P3 · Dashboard (M1–M2) and states

- [ ] Operational states required by `docs/design.md`: disconnected / connecting / connected / **expired** / error, each shown with text + color. `expired` does not exist in `TwitchStatus["eventSub"]` and `.signal.expired` is not styled; add a magenta `Re-connect needed` banner when token refresh fails.
- [ ] Overlay connection status: count WS clients on `/overlay` and show `Overlay: waiting… / live (n clients)` next to the Copy button.
- [ ] M2 status bar (56 px): round · phase timer · version · chat msgs/min · LLM latency (last compile ms). Chat rate and LLM latency are not tracked today.
- [ ] Patch history rows: hover/expand shows the knob diff (`- obstacle.scale 1.0` / `+ obstacle.scale 2.6`) and a `Safety guard 4/4` strip (schema strict · allowed knobs · blocked terms · rollback watch).
- [ ] Force rollback should require a 1 s press-and-hold; it is a plain click now.
- [ ] Intensity segment buttons are 42 px tall; design minimum control height is 48 px.
- [ ] `docs/design.md` typography floor is 12 px; `styles.css` has ~30 declarations at 9–11 px (eyebrows, panel heads, mono labels, patch-note codes). Raise to 12 px or update the contract.
- [ ] Line color is split between `#2a2a2e` (overlay) and `#34343a` (dashboard `--line`); pick one token.
- [ ] `Noto Sans KR` is named in the font stack but not loaded; add it to the Google Fonts import or remove it from the stack.
- [ ] Responsive contract in `docs/design.md` (>1150 nav 216 px · 721–1150 two-column · ≤720 single column; check 360/390/720/1024/1440 + 200 % zoom) vs current breakpoints at 900/720 with no nav. Align the doc or the CSS, then record the five width checks in `docs/submission-evidence.md`.

## Should-tier (only after P0–P2)

- [ ] S1 auto-clip on APPLY (`/api/twitch/clip` exists; wire it to the apply step, post the clip URL in the result announcement, skip quietly on 403/404).
- [ ] S3 `/recap` page: hero (avatar · date · patch count · contributor count) → top 3 by votes → full mono timeline → Patch Credits cloud → share button (chat announce + copy link).
- [ ] Overlay key: issue `/overlay#k=…` and exchange the fragment for a session token on the WS upgrade instead of serving `/overlay` and `/ws` unauthenticated.
