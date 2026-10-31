import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const live = readFileSync(fileURLToPath(new URL("./components/LiveControl.tsx", import.meta.url)), "utf8");

describe("artifact M2 live control", () => {
  it("routes the live dashboard to its dedicated operating surface", () => {
    expect(app).toContain('window.location.pathname === "/dashboard/live"');
    expect(app).toContain("<LiveControl");
  });

  it("uses the artifact 56px header and 360 / 600 / 480 columns", () => {
    expect(css).toContain(".live-control-topbar { height:56px");
    expect(css).toContain(".live-control-grid { display:grid; grid-template-columns:360px minmax(480px, 600px) minmax(360px, 480px)");
  });

  it("keeps emergency controls and the three operational regions visible", () => {
    expect(live).toContain("Live chat");
    expect(live).toContain("Proposals &amp; Vote");
    expect(live).toContain("Patch queue");
    expect(live).toContain("Force rollback");
    expect(live).toContain("Safety guard");
  });
});
