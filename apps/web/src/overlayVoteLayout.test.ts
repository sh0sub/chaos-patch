import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

function pixelToken(name: string): number {
  const match = css.match(new RegExp(`--${name}:(\\d+)px`));
  return Number(match?.[1] ?? 0);
}

describe("broadcast vote layout", () => {
  it("matches the M4 three-card stage dimensions", () => {
    expect(pixelToken("vote-grid-width")).toBe(1160);
    expect(pixelToken("vote-card-width")).toBe(360);
    expect(pixelToken("vote-card-height")).toBe(420);
    expect(pixelToken("vote-gap")).toBe(40);
    expect(pixelToken("vote-number")).toBe(72);
    expect(pixelToken("vote-title")).toBe(32);
    expect(pixelToken("vote-description")).toBe(24);
    expect(pixelToken("vote-bar")).toBe(16);
    expect(pixelToken("vote-countdown")).toBe(64);
  });

  it("uses Twitch vote bars, spring motion, and an urgent countdown pulse", () => {
    expect(css).toContain("background:#9146ff");
    expect(css).toContain("transition:width 250ms cubic-bezier");
    expect(css).toContain("@keyframes vote-countdown-pulse");
  });
});
