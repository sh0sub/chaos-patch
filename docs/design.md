# Chaos Patch design contract

## Sources and precedence

1. The Twitch — Chaos Patch artifact is the product and brand source of truth.
2. Peerly common design system proposal `0.1.0`, checked `2026-10-09`, supplies spacing, accessibility, focus, sizing, and responsive defaults.
3. `frontend-skill` supplies composition and motion constraints.

The copied Peerly colors are not the Chaos Patch brand. Chaos Patch keeps its artifact palette and maps it through semantic tokens.

## Visual thesis

A calm broadcast control room cut by one electric patch-lime signal: dense enough for a streamer, theatrical enough for an audience, and never dressed as a generic dashboard.

## Content plan

- M1 Setup: 280 px setup rail, 72 px status header, Twitch/OBS/session pre-flight, overlay preview, and one lime Start action.
- M2 Live Control: 56 px runtime bar over the Artifact's 360 / 600 / 480 chat, round, and patch columns.
- M3–M6 Overlay: the playable Emote Dodge canvas is dominant, with patch credits, notes, and chat in a fixed side rail.
- M7 Recap: a 390 px recap share document with hero metrics, Top 3, full timeline, credits, and one share action.

## Interaction thesis

- Phase changes use a restrained 220 ms layout transition rather than ornamental motion.
- Vote bars spring toward new totals; reduced-motion users receive an immediate update.
- A successful patch uses one 150 ms RGB split followed by a 400 ms patch-note reveal. Rollback uses a plain danger border and message.

## Semantic tokens

| Role | Value | Use |
|---|---|---|
| canvas | `#0e0e10` | game and broadcast background |
| panel | `#18181b` | operational surfaces |
| panel raised | `#202024` | active workspace |
| line | `#2a2a2e` | necessary boundaries |
| text primary | `#efeff1` | headings and values |
| text secondary | `#b8b8c2` | labels and context |
| action primary | `#c8ff3d` | apply, start, current version |
| action foreground | `#10120b` | text on patch lime |
| chaos/danger | `#ff3da6` | rollback and destructive state |
| info | `#3de0ff` | compile and transport state |
| Twitch | `#9146ff` | Twitch-originated identity only |
| warning | `#ffc46b` | degraded or waiting state |

Spacing follows 4/8/12/16/20/24/32/40/48. Controls have a 48 px target, square operational edges by default, visible 3 px focus with 3 px offset, and no permanent decorative shadow.

## Typography

- Headings: Space Grotesk 700, Noto Sans KR fallback.
- UI: Inter 500/600/700, Noto Sans KR, system fallbacks.
- Logs and versions: JetBrains Mono, SFMono-Regular, monospace.
- Minimum operational text: 12 px; body 14 px; main title 30 px.
- Numeric timers and versions use tabular numerals.

## Responsive contract

- `>1200`: M1 keeps its 280 px setup rail; M2 uses the full 360 / 600 / 480 three-column second-monitor layout.
- `901–1200`: M2 keeps chat and round side by side and moves patch history, compile log, and safety below them.
- `721–900`: Setup steps become a horizontal rail; M2 stacks into one column; overlay remains a fixed 16:9 broadcast surface.
- `<=720`: Setup and M2 use one column with 48 px controls and no page-level horizontal overflow; the 390 px recap fills the available mobile width.
- Required checks: 360, 390, 720, 1024, and 1440 px plus 200% browser zoom.

## States

Every remote surface must show disconnected, connecting, connected, expired, and error states using text plus color. Empty proposal and history areas describe the next action. Loading never removes the current operational context.
