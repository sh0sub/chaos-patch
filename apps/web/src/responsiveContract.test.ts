import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const design = readFileSync(fileURLToPath(new URL("../../../docs/design.md", import.meta.url)), "utf8");

describe("responsive contract", () => {
  it("matches the artifact setup, live-control, and mobile recap shells", () => {
    expect(design).toContain("280 px setup rail");
    expect(design).toContain("360 / 600 / 480");
    expect(design).toContain("390 px recap");
    expect(css).toContain("@media (max-width: 1200px)");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 720px)");
  });

  it("keeps expanded history content single-column on mobile", () => {
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.history-detail \{ grid-template-columns:1fr;/);
  });
});
