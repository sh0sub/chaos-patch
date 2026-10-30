import { describe, expect, it } from "vitest";
import { PatchHealthGuard } from "./patchHealth";

describe("patch health guard", () => {
  it("flags a patch after FPS stays below 20 for three seconds", () => {
    const guard = new PatchHealthGuard();

    for (let frame = 0; frame < 58; frame += 1) expect(guard.observeFrame(0.051)).toBe(false);
    expect(guard.observeFrame(0.051)).toBe(true);
  });

  it("resets the low-FPS window after a healthy frame", () => {
    const guard = new PatchHealthGuard();
    for (let frame = 0; frame < 40; frame += 1) guard.observeFrame(0.06);

    guard.observeFrame(0.016);

    for (let frame = 0; frame < 40; frame += 1) expect(guard.observeFrame(0.06)).toBe(false);
  });
});
