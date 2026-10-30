import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("dashboard typography floor", () => {
  it("has no font declaration below 12 px", () => {
    expect(css).not.toMatch(/(?:font-size|font:)[^;}]*?(?<!\d)(?:9|10|11)px/);
  });
});
