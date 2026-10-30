import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

function pixelToken(name: string): number {
  const match = css.match(new RegExp(`--${name}:(\\d+)px`));
  return Number(match?.[1] ?? 0);
}

describe("broadcast overlay typography", () => {
  it("keeps OBS text readable on the mobile Twitch player", () => {
    expect(pixelToken("overlay-body")).toBeGreaterThanOrEqual(28);
    expect(pixelToken("overlay-caption")).toBeGreaterThanOrEqual(20);
    expect(pixelToken("overlay-mono")).toBeGreaterThanOrEqual(22);
    expect(pixelToken("overlay-version")).toBeGreaterThanOrEqual(36);
    expect(css).toContain("font-size:var(--overlay-body)");
    expect(css).toContain("font-size:var(--overlay-caption)");
    expect(css).toContain("font-size:var(--overlay-mono)");
    expect(css).toContain("font-size:var(--overlay-version)");
  });
});
