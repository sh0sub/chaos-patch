import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const design = readFileSync(fileURLToPath(new URL("../../../docs/design.md", import.meta.url)), "utf8");

describe("responsive contract", () => {
  it("matches the implemented 900 px workspace and 720 px mobile breakpoints", () => {
    expect(design).toContain("`>900`");
    expect(design).toContain("`721–900`");
    expect(design).not.toContain("216 px navigation");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 720px)");
  });

  it("keeps expanded history content single-column on mobile", () => {
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.history-detail \{ grid-template-columns:1fr;/);
  });
});
