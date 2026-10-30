import { formatRunTime } from "./gameRuntime";

export type TwitchEmoteAsset = {
  id: string;
  name: string;
  url: string;
};

export type EmoteCatalog = ReadonlyMap<string, string>;

const rehearsalEmotes: TwitchEmoteAsset[] = [{
  id: "25",
  name: "Kappa",
  url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0"
}];

export function buildEmoteCatalog(emotes: TwitchEmoteAsset[]): EmoteCatalog {
  return new Map([...rehearsalEmotes, ...emotes].map((emote) => [emote.name.toLocaleLowerCase(), emote.url]));
}

export function resolveEmoteUrl(sprite: string, catalog: EmoteCatalog): string | null {
  const match = /^emote:([A-Za-z0-9_]{1,32})$/.exec(sprite);
  if (!match) return null;
  return catalog.get(match[1]!.toLocaleLowerCase()) ?? null;
}

export function gameVisualSources(sprite: string, catalog: EmoteCatalog, profileImageUrl?: string | null) {
  return {
    obstacleImageUrl: resolveEmoteUrl(sprite, catalog),
    playerImageUrl: profileImageUrl?.trim() || null
  };
}

export function renderEffectProfile(cameraShake: number, fog: number, elapsedSeconds: number, hitAgeMs = Number.POSITIVE_INFINITY) {
  const shake = Math.min(1, Math.max(0, cameraShake));
  const hitStrength = hitAgeMs >= 0 && hitAgeMs < 200 ? 1 - hitAgeMs / 200 : 0;
  const hitShakeX = hitStrength === 0 ? 0 : Math.sin((hitAgeMs + 1) * .33) * hitStrength * 12;
  const hitShakeY = hitStrength === 0 ? 0 : Math.cos((hitAgeMs + 1) * .29) * hitStrength * 9;
  return {
    shakeX: (shake === 0 ? 0 : Math.sin(elapsedSeconds * 47) * shake * 8) + hitShakeX,
    shakeY: (shake === 0 ? 0 : Math.cos(elapsedSeconds * 53) * shake * 6) + hitShakeY,
    fogOpacity: Math.min(0.85, Math.max(0, fog))
  };
}

export function obstacleSpawnScale(y: number, radius: number, velocityY: number, gravity: number) {
  const speed = velocityY * gravity;
  if (speed <= 0) return 1;
  const ageSeconds = Math.max(0, (y + radius) / speed);
  const progress = Math.min(1, ageSeconds / .12);
  const eased = 1 - (1 - progress) ** 3;
  return .55 + .45 * eased;
}

export function scorePulseScale(elapsedSeconds: number) {
  if (elapsedSeconds < 10) return 1;
  const milestoneAge = elapsedSeconds % 10;
  return milestoneAge < .32 ? 1 + Math.sin((milestoneAge / .32) * Math.PI) * .22 : 1;
}

export function arenaHudCopy(labelTitle: string, elapsedSeconds: number, bestSeconds: number) {
  return {
    title: labelTitle,
    survived: formatRunTime(elapsedSeconds),
    best: formatRunTime(bestSeconds)
  };
}
