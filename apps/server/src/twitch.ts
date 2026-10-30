import { EventEmitter } from "node:events";
import WebSocket from "ws";

type TwitchClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type TwitchTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

type StoredAuth = TwitchTokenResponse & {
  expiresAt: number;
  user: TwitchUser;
};

export type TwitchStatus = {
  authenticated: boolean;
  eventSub: "disconnected" | "connecting" | "connected" | "error";
  lastKeepaliveAt: string | null;
  user: TwitchUser | null;
  error: string | null;
};

export type TwitchChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  sentAt: string;
};

export type TwitchEmote = {
  id: string;
  name: string;
  url: string;
};

const AUTHORIZATION_URL = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.twitch.tv/helix";
const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";

export class TwitchClient extends EventEmitter {
  private auth: StoredAuth | null = null;
  private socket: WebSocket | null = null;
  private eventSubStatus: TwitchStatus["eventSub"] = "disconnected";
  private lastKeepaliveAt: string | null = null;
  private error: string | null = null;
  private refreshInFlight: Promise<StoredAuth> | null = null;

  constructor(private readonly config: TwitchClientConfig) {
    super();
  }

  authorizationUrl(state: string): string {
    const url = new URL(AUTHORIZATION_URL);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user:read:chat user:write:chat clips:edit channel:manage:broadcast");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<TwitchUser> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri
    });

    const tokenResponse = await fetch(TOKEN_URL, { method: "POST", body });
    if (!tokenResponse.ok) {
      throw new Error(`Twitch token exchange failed (${tokenResponse.status})`);
    }

    const token = (await tokenResponse.json()) as TwitchTokenResponse;
    const user = await this.fetchUser(token.access_token);
    this.auth = {
      ...token,
      expiresAt: Date.now() + token.expires_in * 1000,
      user
    };
    this.emitStatus();
    return user;
  }

  async connectEventSub(): Promise<void> {
    if (!this.auth) throw new Error("Connect Twitch before EventSub");
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this.eventSubStatus = "connecting";
    this.error = null;
    this.emitStatus();

    const socket = new WebSocket(EVENTSUB_URL);
    this.socket = socket;

    socket.on("message", (raw) => void this.handleMessage(socket, raw.toString()));

    socket.on("error", (error) => {
      this.eventSubStatus = "error";
      this.error = error.message;
      this.emitStatus();
    });

    socket.on("close", () => {
      if (this.socket === socket) {
        this.eventSubStatus = "disconnected";
        this.emitStatus();
      }
    });
  }

  private async handleMessage(socket: WebSocket, raw: string): Promise<void> {
    try {
      const message = JSON.parse(raw) as {
        metadata: { message_type: string; subscription_type?: string };
        payload: Record<string, unknown> & {
          session?: { id: string; reconnect_url?: string | null };
          event?: Record<string, unknown>;
        };
      };

      if (message.metadata.message_type === "session_welcome" && message.payload.session) {
        if (this.eventSubStatus === "connecting") await this.subscribeToChat(message.payload.session.id);
        this.eventSubStatus = "connected";
        this.lastKeepaliveAt = new Date().toISOString();
        this.emitStatus();
        return;
      }

      if (message.metadata.message_type === "session_keepalive") {
        this.lastKeepaliveAt = new Date().toISOString();
        this.emitStatus();
        return;
      }

      if (message.metadata.message_type === "session_reconnect" && message.payload.session?.reconnect_url) {
        this.connectReconnectUrl(socket, message.payload.session.reconnect_url);
        return;
      }

      if (
        message.metadata.message_type === "notification" &&
        message.metadata.subscription_type === "channel.chat.message" &&
        message.payload.event
      ) {
        const event = message.payload.event;
        const chatMessage: TwitchChatMessage = {
          id: String(event.message_id),
          userId: String(event.chatter_user_id),
          userName: String(event.chatter_user_name),
          text: String((event.message as { text?: string } | undefined)?.text ?? ""),
          sentAt: new Date().toISOString()
        };
        this.emit("chat", chatMessage);
      }
    } catch (error) {
      this.eventSubStatus = "error";
      this.error = error instanceof Error ? error.message : "EventSub message failed";
      this.emitStatus();
    }
  }

  async sendChatMessage(message: string): Promise<void> {
    const auth = await this.requireFreshAuth();
    const response = await fetch(`${API_URL}/chat/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Client-Id": this.config.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        broadcaster_id: auth.user.id,
        sender_id: auth.user.id,
        message: message.slice(0, 500)
      })
    });

    if (!response.ok) throw new Error(`Twitch chat send failed (${response.status})`);
  }

  async listEmotes(): Promise<TwitchEmote[]> {
    const auth = await this.requireFreshAuth();
    const headers = {
      Authorization: `Bearer ${auth.access_token}`,
      "Client-Id": this.config.clientId
    };
    const readEmotes = async (url: string): Promise<TwitchEmote[]> => {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`Twitch emote lookup failed (${response.status})`);
      const payload = (await response.json()) as {
      data?: Array<{ id?: string; name?: string }>;
      template?: string;
      };
      const template = payload.template;
      if (!template) return [];
      return (payload.data ?? []).flatMap((emote) => {
        if (!emote.id || !emote.name) return [];
        return [{
          id: emote.id,
          name: emote.name,
          url: template
            .replace("{{id}}", emote.id)
            .replace("{{format}}", "default")
            .replace("{{theme_mode}}", "dark")
            .replace("{{scale}}", "3.0")
        }];
      });
    };
    const [channelEmotes, globalEmotes] = await Promise.all([
      readEmotes(`${API_URL}/chat/emotes?broadcaster_id=${encodeURIComponent(auth.user.id)}`),
      readEmotes(`${API_URL}/chat/emotes/global`)
    ]);
    return [...channelEmotes, ...globalEmotes];
  }

  async createClip(title: string): Promise<{ id: string; editUrl: string }> {
    const auth = await this.requireFreshAuth();
    const query = new URLSearchParams({
      broadcaster_id: auth.user.id,
      title: title.slice(0, 100),
      duration: "30"
    });
    const requestClip = (parameters: URLSearchParams) => fetch(`${API_URL}/clips?${parameters}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Client-Id": this.config.clientId
      }
    });
    let response = await requestClip(query);
    let detail: string | null = null;
    if (response.status === 403) {
      detail = await response.text();
      if (this.twitchErrorMessage(detail) === "User not authorized to create clips.") {
        response = await requestClip(new URLSearchParams({ broadcaster_id: auth.user.id }));
        detail = null;
      }
    }
    if (response.status === 404) throw new Error("Twitch channel must be live before creating a clip");
    if (!response.ok) {
      detail ??= await response.text();
      const message = this.twitchErrorMessage(detail);
      const suffix = message.trim() ? `: ${message.trim().slice(0, 180)}` : "";
      throw new Error(`Twitch clip creation failed (${response.status})${suffix}`);
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string; edit_url?: string }> };
    const clip = payload.data?.[0];
    if (!clip?.id || !clip.edit_url) throw new Error("Twitch clip creation returned no clip");
    return { id: clip.id, editUrl: clip.edit_url };
  }

  async createMarker(description: string): Promise<{
    id: string;
    createdAt: string;
    positionSeconds: number;
    description: string;
  }> {
    const auth = await this.requireFreshAuth();
    const response = await fetch(`${API_URL}/streams/markers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Client-Id": this.config.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: auth.user.id,
        description: description.slice(0, 140)
      })
    });
    if (!response.ok) {
      const detail = this.twitchErrorMessage(await response.text());
      const suffix = detail.trim() ? `: ${detail.trim().slice(0, 180)}` : "";
      throw new Error(`Twitch marker creation failed (${response.status})${suffix}`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: string; created_at?: string; position_seconds?: number; description?: string }>;
    };
    const marker = payload.data?.[0];
    if (!marker?.id || !marker.created_at || typeof marker.position_seconds !== "number") {
      throw new Error("Twitch marker creation returned no marker");
    }
    return {
      id: marker.id,
      createdAt: marker.created_at,
      positionSeconds: marker.position_seconds,
      description: marker.description ?? ""
    };
  }

  private twitchErrorMessage(detail: string): string {
    try {
      return String((JSON.parse(detail) as { message?: unknown }).message ?? detail);
    } catch {
      return detail;
    }
  }

  status(): TwitchStatus {
    return {
      authenticated: Boolean(this.auth),
      eventSub: this.eventSubStatus,
      lastKeepaliveAt: this.lastKeepaliveAt,
      user: this.auth?.user ?? null,
      error: this.error
    };
  }

  private async fetchUser(accessToken: string): Promise<TwitchUser> {
    const response = await fetch(`${API_URL}/users`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": this.config.clientId
      }
    });
    if (!response.ok) throw new Error(`Twitch user lookup failed (${response.status})`);
    const payload = (await response.json()) as { data: TwitchUser[] };
    const user = payload.data[0];
    if (!user) throw new Error("Twitch user lookup returned no account");
    return user;
  }

  private async subscribeToChat(sessionId: string): Promise<void> {
    const auth = await this.requireFreshAuth();
    const response = await fetch(`${API_URL}/eventsub/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Client-Id": this.config.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: auth.user.id,
          user_id: auth.user.id
        },
        transport: { method: "websocket", session_id: sessionId }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`EventSub subscription failed (${response.status}): ${detail.slice(0, 180)}`);
    }
  }

  private connectReconnectUrl(previous: WebSocket, url: string): void {
    const next = new WebSocket(url);
    this.socket = next;
    next.on("message", (raw) => void this.handleMessage(next, raw.toString()));
    next.once("message", () => previous.close());
    next.on("error", (error) => {
      this.eventSubStatus = "error";
      this.error = error.message;
      this.emitStatus();
    });
    next.on("close", () => {
      if (this.socket === next) {
        this.eventSubStatus = "disconnected";
        this.emitStatus();
      }
    });
  }

  private async requireFreshAuth(): Promise<StoredAuth> {
    if (!this.auth) throw new Error("Twitch is not authenticated");
    if (this.auth.expiresAt - Date.now() > 60_000) return this.auth;

    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAuth().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async refreshAuth(): Promise<StoredAuth> {
    if (!this.auth) throw new Error("Twitch is not authenticated");
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: this.auth.refresh_token
    });
    const response = await fetch(TOKEN_URL, { method: "POST", body });
    if (!response.ok) throw new Error(`Twitch token refresh failed (${response.status})`);
    const token = (await response.json()) as TwitchTokenResponse;
    this.auth = {
      ...token,
      expiresAt: Date.now() + token.expires_in * 1000,
      user: this.auth.user
    };
    return this.auth;
  }

  private emitStatus(): void {
    this.emit("status", this.status());
  }
}
