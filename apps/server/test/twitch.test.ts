import { afterEach, describe, expect, it, vi } from "vitest";
import { TwitchClient } from "../src/twitch";

describe("TwitchClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests only the chat and clip scopes used by Chaos Patch", () => {
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });

    const url = new URL(client.authorizationUrl("oauth-state"));
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/callback");
    expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "channel:manage:broadcast",
      "clips:edit",
      "user:read:chat",
      "user:write:chat"
    ]);
  });

  it("creates a 30-second clip for the authenticated broadcaster", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: ["clips:edit"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "clip-1", edit_url: "https://clips.twitch.tv/clip-1/edit" }]
      }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    const clip = await client.createClip("Chaos Patch · Round 4");

    expect(clip).toEqual({ id: "clip-1", editUrl: "https://clips.twitch.tv/clip-1/edit" });
    const [url, init] = fetchMock.mock.calls[2]!;
    expect(String(url)).toBe("https://api.twitch.tv/helix/clips?broadcaster_id=broadcaster-1&title=Chaos+Patch+%C2%B7+Round+4&duration=30");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer access-token", "Client-Id": "client-id" }
    });
  });

  it("lists current Twitch emotes as browser-ready CDN images", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: ["user:read:chat"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "channel-1", name: "MyEmote" }],
        template: "https://static-cdn.jtvnw.net/emoticons/v2/{{id}}/{{format}}/{{theme_mode}}/{{scale}}"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "25", name: "Kappa" }],
        template: "https://static-cdn.jtvnw.net/emoticons/v2/{{id}}/{{format}}/{{theme_mode}}/{{scale}}"
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    await expect(client.listEmotes()).resolves.toEqual([
      {
        id: "channel-1",
        name: "MyEmote",
        url: "https://static-cdn.jtvnw.net/emoticons/v2/channel-1/default/dark/3.0"
      },
      {
        id: "25",
        name: "Kappa",
        url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0"
      }
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      "https://api.twitch.tv/helix/chat/emotes?broadcaster_id=broadcaster-1",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token", "Client-Id": "client-id" } })
    ]);
    expect(fetchMock.mock.calls[3]).toEqual([
      "https://api.twitch.tv/helix/chat/emotes/global",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token", "Client-Id": "client-id" } })
    ]);
  });

  it("surfaces Twitch's reason when clip creation is forbidden", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: ["clips:edit"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "Forbidden",
        status: 403,
        message: "Clips are disabled for this channel"
      }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    await expect(client.createClip("Chaos Patch · Round 4")).rejects.toThrow(
      "Twitch clip creation failed (403): Clips are disabled for this channel"
    );
  });

  it("retries Twitch's minimal clip request when optional metadata is not authorized", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: ["clips:edit"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: "Forbidden",
        status: 403,
        message: "User not authorized to create clips."
      }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "clip-1", edit_url: "https://clips.twitch.tv/clip-1/edit" }]
      }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    await expect(client.createClip("Chaos Patch · Round 4")).resolves.toEqual({
      id: "clip-1",
      editUrl: "https://clips.twitch.tv/clip-1/edit"
    });
    expect(String(fetchMock.mock.calls[2]![0])).toContain("title=Chaos+Patch");
    expect(String(fetchMock.mock.calls[3]![0])).toBe(
      "https://api.twitch.tv/helix/clips?broadcaster_id=broadcaster-1"
    );
  });

  it("creates a labeled marker on the authenticated broadcaster's live stream", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: ["channel:manage:broadcast"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: "marker-1",
          created_at: "2026-10-28T00:00:00Z",
          position_seconds: 42,
          description: "Chaos Patch · Round 4"
        }]
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    await expect(client.createMarker("Chaos Patch · Round 4")).resolves.toEqual({
      id: "marker-1",
      createdAt: "2026-10-28T00:00:00Z",
      positionSeconds: 42,
      description: "Chaos Patch · Round 4"
    });
    expect(fetchMock.mock.calls[2]).toEqual([
      "https://api.twitch.tv/helix/streams/markers",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "Client-Id": "client-id",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_id: "broadcaster-1", description: "Chaos Patch · Round 4" })
      })
    ]);
  });

  it("shares one token refresh across concurrent Twitch API calls", async () => {
    let releaseRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => { releaseRefresh = resolve; });
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://id.twitch.tv/oauth2/token" && fetchMock.mock.calls.length === 1) {
        return Promise.resolve(new Response(JSON.stringify({
          access_token: "expired-access",
          refresh_token: "refresh-token",
          expires_in: 0,
          scope: ["user:write:chat", "channel:manage:broadcast"],
          token_type: "bearer"
        }), { status: 200 }));
      }
      if (url === "https://api.twitch.tv/helix/users") {
        return Promise.resolve(new Response(JSON.stringify({
          data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
        }), { status: 200 }));
      }
      if (url === "https://id.twitch.tv/oauth2/token") return refreshResponse;
      if (url === "https://api.twitch.tv/helix/chat/messages") {
        expect(init?.headers).toMatchObject({ Authorization: "Bearer fresh-access" });
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === "https://api.twitch.tv/helix/streams/markers") {
        expect(init?.headers).toMatchObject({ Authorization: "Bearer fresh-access" });
        return Promise.resolve(new Response(JSON.stringify({
          data: [{
            id: "marker-1",
            created_at: "2026-10-28T00:00:00Z",
            position_seconds: 42,
            description: "Chaos Patch"
          }]
        }), { status: 200 }));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    await client.exchangeCode("oauth-code");

    const chat = client.sendChatMessage("hello");
    const marker = client.createMarker("Chaos Patch");
    await vi.waitFor(() => {
      const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url) === "https://id.twitch.tv/oauth2/token");
      expect(refreshCalls).toHaveLength(2);
    });
    releaseRefresh(new Response(JSON.stringify({
      access_token: "fresh-access",
      refresh_token: "rotated-refresh-token",
      expires_in: 3600,
      scope: ["user:write:chat", "channel:manage:broadcast"],
      token_type: "bearer"
    }), { status: 200 }));

    await expect(Promise.all([chat, marker])).resolves.toEqual([
      undefined,
      {
        id: "marker-1",
        createdAt: "2026-10-28T00:00:00Z",
        positionSeconds: 42,
        description: "Chaos Patch"
      }
    ]);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url) === "https://id.twitch.tv/oauth2/token");
    expect(refreshCalls).toHaveLength(2);
  });

  it("marks Twitch as expired when token refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "expired-access",
        refresh_token: "refresh-token",
        expires_in: 0,
        scope: ["user:write:chat"],
        token_type: "bearer"
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "broadcaster-1", login: "tester", display_name: "Tester", profile_image_url: "" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new TwitchClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/auth/callback"
    });
    const statuses: string[] = [];
    client.on("status", (status) => statuses.push(status.eventSub));
    await client.exchangeCode("oauth-code");

    await expect(client.sendChatMessage("hello")).rejects.toThrow("Twitch token refresh failed (401)");
    expect(client.status()).toMatchObject({
      authenticated: true,
      eventSub: "expired",
      error: "Twitch token refresh failed (401)"
    });
    expect(statuses).toContain("expired");
  });
});
