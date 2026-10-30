import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("broadcast compile terminal", () => {
  it("uses the M5 terminal dimensions and staged typing treatment", () => {
    expect(css).toContain("--compile-width:760px");
    expect(css).toContain("--compile-height:240px");
    expect(css).toContain("--compile-font:26px");
    expect(css).toContain(".compile-cursor { background:var(--cyan)");
    expect(css).toContain("@keyframes compile-type");
  });
});
