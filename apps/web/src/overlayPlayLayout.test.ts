import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const component = readFileSync(fileURLToPath(new URL("./components/BroadcastOverlay.tsx", import.meta.url)), "utf8");
const gameCanvas = readFileSync(fileURLToPath(new URL("./components/GameCanvas.tsx", import.meta.url)), "utf8");

function pixelToken(name: string): number {
  const match = css.match(new RegExp(`--${name}:(\\d+)px`));
  return Number(match?.[1] ?? 0);
}

describe("M3 play overlay layout", () => {
  it("uses the artifact's exact 1920 by 1080 stage geometry", () => {
    expect(pixelToken("overlay-stage-width")).toBe(1600);
    expect(pixelToken("overlay-game-width")).toBe(1200);
    expect(pixelToken("overlay-rail-width")).toBe(360);
    expect(pixelToken("overlay-stage-gap")).toBe(40);
    expect(pixelToken("overlay-status-height")).toBe(56);
    expect(pixelToken("overlay-game-height")).toBe(840);
    expect(pixelToken("overlay-ticker-height")).toBe(48);
  });

  it("places active patch chips inside the game viewport", () => {
    expect(component).toMatch(/broadcast-game-viewport[\s\S]*broadcast-game-toolbar/);
  });

  it("keeps the twitch-s3 brand, version chip, boxed HUD, and patch command ticker", () => {
    expect(component).toContain('className="broadcast-brand-mark">⚡');
    expect(component).toContain('className="broadcast-version"');
    expect(component).toContain("!patch &lt;idea&gt;");
    expect(css).toMatch(/\.broadcast-version \{[^}]*background:var\(--lime\)/);
    expect(gameCanvas).toContain("drawHudPanel(ctx");
  });

  it("uses the compact twitch-s3 credits, patch-note, and chat rail", () => {
    expect(css).toMatch(/\.broadcast-credits > div \{[^}]*grid-template-columns:24px/);
    expect(css).toMatch(/\.broadcast-patches > div \{[^}]*font-size:var\(--overlay-caption\)/);
    expect(css).toMatch(/\.broadcast-chat > div \{[^}]*font-size:var\(--overlay-caption\)/);
  });
});
