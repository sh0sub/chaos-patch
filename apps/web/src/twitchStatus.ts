export type TwitchEventSubStatus = "disconnected" | "connecting" | "connected" | "expired" | "error";

export function twitchStatusPresentation(status: TwitchEventSubStatus, displayName: string | null) {
  const owner = displayName?.trim() || "Twitch";
  if (status === "disconnected") {
    return { label: displayName ? `${owner} · disconnected` : "Twitch disconnected", reconnect: false };
  }
  if (status === "expired") return { label: `${owner} · Re-connect needed`, reconnect: true };
  if (status === "error") return { label: `${owner} · connection error`, reconnect: false };
  return { label: `${owner} · ${status}`, reconnect: false };
}
