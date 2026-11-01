import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const html = readFileSync(fileURLToPath(new URL("../public/intro.html", import.meta.url)), "utf8");

describe("service introduction page", () => {
  it("explains the audience-driven patch loop and offers the live product", () => {
    expect(html).toContain("Chat ships the next update");
    expect(html).toContain("PLAY → PITCH → VOTE → COMPILE → APPLY");
    expect(html).toContain('href="/dashboard/setup"');
    expect(html).toContain('href="/dashboard/live"');
  });

  it("uses the artifact palette, product typography, and reduced-motion fallback", () => {
    expect(html).toContain("--lime:#c8ff3d");
    expect(html).toContain("Space Grotesk");
    expect(html).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("contains no credential or private overlay fields", () => {
    expect(html).not.toMatch(/client[_ -]?secret|openai_api_key|#k=/i);
  });
});
