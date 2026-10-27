import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { PatchV1 } from "@chaos-patch/schema";
import { createChaosPatchServer, type TwitchPort } from "../src/app";

class FakeTwitch extends EventEmitter implements TwitchPort {
  exchangeCodes: string[] = [];
  connectCalls = 0;
  clipTitles: string[] = [];
  markerDescriptions: string[] = [];
  authorizationUrl(_state: string) { return "https://example.test/oauth"; }
  async exchangeCode(code: string) {
    this.exchangeCodes.push(code);
    return { id: "1", login: "tester", display_name: "Tester", profile_image_url: "" };
  }
  async connectEventSub() { this.connectCalls += 1; }
  async sendChatMessage() {}
  async createClip(title: string) {
    this.clipTitles.push(title);
    return { id: "clip-1", editUrl: "https://clips.twitch.tv/clip-1/edit" };
  }
  async createMarker(description: string) {
    this.markerDescriptions.push(description);
    return {
      id: "marker-1",
      createdAt: "2026-10-28T00:00:00Z",
      positionSeconds: 42,
      description
    };
  }
  status() {
    return { authenticated: false, eventSub: "disconnected" as const, lastKeepaliveAt: null, user: null, error: null };
  }
}

const patch: PatchV1 = {
  version: 2,
  title: "Test Patch",
  notes: ["Integration test patch"],
  proposer: "viewer",
  params: { playerSpeed: 1.2 }
};

describe("Chaos Patch HTTP server", () => {
  it("skips compilation when the vote closes without a chat vote", async () => {
    let compileCalls = 0;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => {
        compileCalls += 1;
        return patch;
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 1
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await new Promise((resolve) => setTimeout(resolve, 80));

    const status = await server.inject({ method: "GET", url: "/api/status" });
    expect(status.json().round).toMatchObject({ version: 1, phase: "play", patchHistory: [] });
    expect(compileCalls).toBe(0);
    await server.close();
  });

  it("compiles a voted proposal once when duplicate requests overlap", async () => {
    let compileCalls = 0;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => {
        compileCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return patch;
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "!patch faster feet" } });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "1" } });

    const responses = await Promise.all([
      server.inject({ method: "POST", url: "/api/session/compile" }),
      server.inject({ method: "POST", url: "/api/session/compile" })
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(compileCalls).toBe(1);
    const status = await server.inject({ method: "GET", url: "/api/status" });
    expect(status.json().round).toMatchObject({
      version: 2,
      phase: "apply",
      activePatch: { title: "Test Patch" },
      patchHistory: [{ version: 2, status: "applied" }]
    });
    await server.close();
  });

  it("exchanges a valid OAuth callback and starts EventSub", async () => {
    const twitch = new FakeTwitch();
    twitch.authorizationUrl = (state: string) => `https://example.test/oauth?state=${encodeURIComponent(state)}`;
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    const start = await server.inject({ method: "GET", url: "/auth/twitch" });
    const location = new URL(start.headers.location!);
    const state = location.searchParams.get("state");
    expect(state).toBeTruthy();

    const callback = await server.inject({ method: "GET", url: `/auth/callback?code=real-code&state=${encodeURIComponent(state!)}` });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("http://localhost:5173/?auth=connected");
    expect(twitch.exchangeCodes).toEqual(["real-code"]);
    expect(twitch.connectCalls).toBe(1);
    await server.close();
  });

  it("summarizes applied and rolled-back builds through the recap endpoint", async () => {
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "!patch faster feet" } });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "1" } });
    await server.inject({ method: "POST", url: "/api/session/compile" });
    await server.inject({ method: "POST", url: "/api/session/rollback", payload: { version: 2, reason: "early_crash" } });

    const response = await server.inject({ method: "GET", url: "/api/session/recap" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      round: 1,
      build: 2,
      applied: 0,
      rolledBack: 1,
      activePatch: null,
      recent: [{ version: 2, title: "Test Patch", proposer: "viewer", status: "rolled_back" }]
    });
    await server.close();
  });

  it("creates a Twitch clip labeled with the current round", async () => {
    const twitch = new FakeTwitch();
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });
    await server.inject({ method: "POST", url: "/api/session/start" });

    const response = await server.inject({ method: "POST", url: "/api/twitch/clip" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ clip: { id: "clip-1", editUrl: "https://clips.twitch.tv/clip-1/edit" } });
    expect(twitch.clipTitles).toEqual(["Chaos Patch · Round 1 · BUILD v1"]);
    await server.close();
  });

  it("creates a Twitch marker labeled with the current round", async () => {
    const twitch = new FakeTwitch();
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });
    await server.inject({ method: "POST", url: "/api/session/start" });

    const response = await server.inject({ method: "POST", url: "/api/twitch/marker" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      marker: {
        id: "marker-1",
        createdAt: "2026-10-28T00:00:00Z",
        positionSeconds: 42,
        description: "Chaos Patch · Round 1 · BUILD v1"
      }
    });
    expect(twitch.markerDescriptions).toEqual(["Chaos Patch · Round 1 · BUILD v1"]);
    await server.close();
  });
});
