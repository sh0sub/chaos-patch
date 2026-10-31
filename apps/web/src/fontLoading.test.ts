import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("font loading", () => {
  it("loads the Korean font named by the root stack", () => {
    expect(css).toContain("family=Noto+Sans+KR:wght@400;600;700;800");
    expect(css).toContain('font-family: Inter, "Noto Sans KR"');
    expect(css).toContain('font:700 20px "Space Grotesk"');
  });
});
