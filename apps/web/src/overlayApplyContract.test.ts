import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  fileURLToPath(new URL("./components/BroadcastOverlay.tsx", import.meta.url)),
  "utf8"
);
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("M5 compile to apply composition", () => {
  it("keeps the patching terminal visible behind the applied patch card", () => {
    expect(component).toContain('round.phase === "apply" && visiblePatch');
    expect(component).toContain('className="broadcast-compile broadcast-apply-terminal"');
    expect(component).toContain("PATCHING…");
    expect(css).toContain("--apply-card-width:900px");
    expect(css).toMatch(/\.broadcast-apply-terminal \{[^}]*top:28%/);
    expect(css).toMatch(/\.phase-apply \.broadcast-apply \{[^}]*top:66%/);
  });
});
