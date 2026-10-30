import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("broadcast pitch layout", () => {
  it("dims play and reserves the M4 banner and ticker treatment", () => {
    expect(css).toContain("--pitch-banner-width:900px");
    expect(css).toContain("--pitch-banner-height:96px");
    expect(css).toContain("opacity:.6");
    expect(css).toContain(".broadcast-pitch-ticker b { color:#9146ff");
  });
});
