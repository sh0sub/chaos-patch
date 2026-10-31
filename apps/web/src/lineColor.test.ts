import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("shared line color", () => {
  it("uses the global line token on dashboard and overlay", () => {
    expect(css).toContain("--line:#2a2a2e");
    expect(css).not.toContain("#34343a");
    expect(css).toContain(".broadcast-game-viewport { position:relative; min-height:0; overflow:hidden; border:1px solid var(--line)");
  });
});
