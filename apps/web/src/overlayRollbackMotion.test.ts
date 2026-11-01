import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("broadcast rollback motion", () => {
  it("flashes the game frame magenta for one second", () => {
    expect(css).toContain("--rollback-flash:1000ms");
    expect(css).toContain(".rollback-active .broadcast-game-viewport");
    expect(css).toContain("@keyframes rollback-frame-flash");
  });

  it("restarts a visible rollback card after the apply card has faded", () => {
    expect(css).toMatch(/\.broadcast-apply\.rolled_back\s*\{[^}]*rollback-card-in/s);
    expect(css).toContain("@keyframes rollback-card-in");
    expect(css).toContain("@keyframes rollback-card-hold");
  });
});
