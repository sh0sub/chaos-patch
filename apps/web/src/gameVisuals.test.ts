import { describe, expect, it } from "vitest";
import { arenaHudCopy, buildEmoteCatalog, gameVisualSources, obstacleSpawnScale, renderEffectProfile, resolveEmoteUrl, scorePulseScale } from "./gameVisuals";

describe("game visuals", () => {
  it("resolves an emote patch to the Twitch CDN image by name", () => {
    const catalog = buildEmoteCatalog([
      { id: "25", name: "Kappa", url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0" }
    ]);

    expect(resolveEmoteUrl("emote:kappa", catalog)).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0"
    );
    expect(resolveEmoteUrl("circle", catalog)).toBeNull();
    expect(resolveEmoteUrl("emote:missing", catalog)).toBeNull();
  });

  it("keeps the official Kappa asset available during offline rehearsal", () => {
    const catalog = buildEmoteCatalog([]);

    expect(resolveEmoteUrl("emote:Kappa", catalog)).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0"
    );
  });

  it("selects Twitch emote and broadcaster profile images for the live arena", () => {
    const catalog = buildEmoteCatalog([
      { id: "25", name: "Kappa", url: "https://cdn.test/kappa.png" }
    ]);

    expect(gameVisualSources("emote:Kappa", catalog, "https://cdn.test/profile.png")).toEqual({
      obstacleImageUrl: "https://cdn.test/kappa.png",
      playerImageUrl: "https://cdn.test/profile.png"
    });
    expect(gameVisualSources("square", catalog, "")).toEqual({
      obstacleImageUrl: null,
      playerImageUrl: null
    });
  });

  it("turns camera-shake and fog knobs into bounded render effects", () => {
    expect(renderEffectProfile(1, 0.85, 1.25)).toMatchObject({ fogOpacity: 0.85 });
    expect(Math.abs(renderEffectProfile(1, 0.85, 1.25).shakeX)).toBeLessThanOrEqual(8);
    expect(renderEffectProfile(0, 0, 1.25)).toEqual({ shakeX: 0, shakeY: 0, fogOpacity: 0 });
  });

  it("pops a newly spawned obstacle to full scale over 120 ms", () => {
    expect(obstacleSpawnScale(-18, 18, 200, 1)).toBeCloseTo(0.55);
    expect(obstacleSpawnScale(6, 18, 200, 1)).toBe(1);
  });

  it("adds a brief hit shake even when the camera-shake knob is off", () => {
    const duringHit = renderEffectProfile(0, 0, 2, 40);

    expect(Math.abs(duringHit.shakeX) + Math.abs(duringHit.shakeY)).toBeGreaterThan(0);
    expect(renderEffectProfile(0, 0, 2, 250)).toEqual({ shakeX: 0, shakeY: 0, fogOpacity: 0 });
  });

  it("pulses the survived score after each ten-second milestone", () => {
    expect(scorePulseScale(9.99)).toBe(1);
    expect(scorePulseScale(10.05)).toBeGreaterThan(1);
    expect(scorePulseScale(10.5)).toBe(1);
    expect(scorePulseScale(20.05)).toBeGreaterThan(1);
  });

  it("includes the patched arena title in the visible HUD copy", () => {
    expect(arenaHudCopy("KAPPA RAIN", 12.4, 31.8)).toEqual({
      title: "KAPPA RAIN",
      survived: "00:12",
      best: "00:31"
    });
  });
});
