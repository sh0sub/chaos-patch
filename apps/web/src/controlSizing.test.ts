import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("dashboard control sizing", () => {
  it("keeps intensity segment buttons at the 48 px touch minimum", () => {
    expect(css).toMatch(/\.intensity-control button \{[^}]*min-height:48px/);
  });
});
