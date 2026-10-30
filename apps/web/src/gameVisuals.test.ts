import { describe, expect, it } from "vitest";
import { buildEmoteCatalog, gameVisualSources, renderEffectProfile, resolveEmoteUrl } from "./gameVisuals";

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
});
