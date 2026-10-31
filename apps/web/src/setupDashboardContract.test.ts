import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const setup = readFileSync(fileURLToPath(new URL("./components/SetupDashboard.tsx", import.meta.url)), "utf8");

describe("artifact M1 setup dashboard", () => {
  it("routes idle operators to the dedicated setup surface", () => {
    expect(app).toContain('window.location.pathname === "/dashboard/setup"');
    expect(app).toContain("<SetupDashboard");
  });

  it("matches the 1440 px artifact shell and setup hierarchy", () => {
    expect(css).toContain(".setup-dashboard { min-height:100vh; display:grid; grid-template-columns:280px minmax(0, 1fr)");
    expect(css).toContain(".setup-topbar { height:72px");
    expect(css).toContain(".setup-content-grid { display:grid; grid-template-columns:minmax(0, 720px) minmax(320px, 1fr)");
    expect(css).toContain(".setup-start");
  });

  it("uses the artifact typography and line token", () => {
    expect(css).toContain("family=Inter:wght@500;600;700");
    expect(css).toContain("family=Space+Grotesk:wght@700");
    expect(css).toContain("--line:#2a2a2e");
  });

  it("highlights only the first incomplete setup step", () => {
    expect(setup).toContain("const activeStep = !twitchReady ? 1 : !overlayReady ? 2 : 3");
    expect(setup).toContain('activeStep === 1 ? "current"');
    expect(setup).toContain('activeStep === 2 ? "current"');
  });
});
