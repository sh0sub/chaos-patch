import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("broadcast apply motion", () => {
  it("sequences RGB split, back-ease slide, hold, and fade", () => {
    expect(css).toContain("--apply-glitch:150ms");
    expect(css).toContain("--apply-slide:400ms");
    expect(css).toContain("--apply-hold:3500ms");
    expect(css).toContain("@keyframes apply-rgb-split");
    expect(css).toContain("@keyframes apply-slide-in");
    expect(css).toContain("@keyframes apply-hold-fade");
  });
});
