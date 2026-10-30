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

export function renderEffectProfile(cameraShake: number, fog: number, elapsedSeconds: number) {
  const shake = Math.min(1, Math.max(0, cameraShake));
  return {
    shakeX: shake === 0 ? 0 : Math.sin(elapsedSeconds * 47) * shake * 8,
    shakeY: shake === 0 ? 0 : Math.cos(elapsedSeconds * 53) * shake * 6,
    fogOpacity: Math.min(0.85, Math.max(0, fog))
  };
}

export function arenaHudCopy(labelTitle: string, elapsedSeconds: number, bestSeconds: number) {
  return {
    title: labelTitle,
    survived: formatRunTime(elapsedSeconds),
    best: formatRunTime(bestSeconds)
  };
}
