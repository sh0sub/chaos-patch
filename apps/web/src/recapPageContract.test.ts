import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("/recap page contract", () => {
  it("routes to the complete judge-facing recap and shares it to chat plus clipboard", () => {
    expect(app).toContain('window.location.pathname.startsWith("/recap")');
    expect(app).toContain("Patch Notes v{recap.build}");
    expect(app).toContain('className="recap-status"');
    expect(app).toContain("Top 3 by votes");
    expect(app).toContain("Patch Credits");
    expect(app).toContain("Full patch timeline");
    expect(app).toContain('fetch("/api/twitch/send"');
    expect(app).toContain("navigator.clipboard.writeText");
    expect(app).toContain('setRecapShareStatus(response.ok ? "Link copied + announced" : "Link copied")');
  });

  it("matches the artifact mobile share-card width", () => {
    expect(css).toContain(".recap-page { width:min(390px, 100%)");
    expect(css).toContain(".recap-top-three article:first-child");
  });
});
