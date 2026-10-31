# Chaos Patch design contract

## Sources and precedence

1. The Twitch — Chaos Patch artifact is the product and brand source of truth.
2. Peerly common design system proposal `0.1.0`, checked `2026-10-09`, supplies spacing, accessibility, focus, sizing, and responsive defaults.
3. `frontend-skill` supplies composition and motion constraints.

The copied Peerly colors are not the Chaos Patch brand. Chaos Patch keeps its artifact palette and maps it through semantic tokens.

## Visual thesis

A calm broadcast control room cut by one electric patch-lime signal: dense enough for a streamer, theatrical enough for an audience, and never dressed as a generic dashboard.

## Content plan

- Setup: Twitch connection, OBS readiness, and one clear Start action.
- Arena: the playable Emote Dodge canvas is the dominant visual.
- Control: phase, timer, proposal stream, and emergency actions.
- Patch history: compact version trail with explicit applied and rolled-back states.

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

Spacing follows 4/8/12/16/20/24/32/40/48. Controls have a 48 px target, 9 px button radius, 8 px input radius, visible 3 px focus with 3 px offset, and no permanent decorative shadow.

## Typography

- UI: Manrope, Noto Sans KR, system fallbacks.
- Logs and versions: JetBrains Mono, SFMono-Regular, monospace.
- Minimum operational text: 12 px; body 14 px; main title 30 px.
- Numeric timers and versions use tabular numerals.

## Responsive contract

- `>900`: wide arena with a 326 px operational control rail; the 56 px runtime bar remains visible.
- `721–900`: single-column workspace with controls below the arena and a single-column audience feed.
- `<=720`: single column, horizontally scrollable runtime metrics, 48 px controls, and no page-level horizontal overflow; expanded patch diffs also stack.
- Required checks: 360, 390, 720, 1024, and 1440 px plus 200% browser zoom.

## States

Every remote surface must show disconnected, connecting, connected, expired, and error states using text plus color. Empty proposal and history areas describe the next action. Loading never removes the current operational context.
