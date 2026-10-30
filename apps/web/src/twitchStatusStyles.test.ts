import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("Twitch status styles", () => {
  it("styles expired state and its reconnect banner in magenta", () => {
    expect(css).toContain(".signal.expired");
    expect(css).toContain(".reconnect-banner");
    expect(css).toContain("color:var(--pink)");
  });
});
