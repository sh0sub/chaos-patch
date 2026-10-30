import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { PatchV1 } from "@chaos-patch/schema";
import { createChaosPatchServer, type TwitchPort } from "../src/app";

class FakeTwitch extends EventEmitter implements TwitchPort {
  exchangeCodes: string[] = [];
  connectCalls = 0;
  chatMessages: string[] = [];
  clipTitles: string[] = [];
  markerDescriptions: string[] = [];
  emotes = [{ id: "25", name: "Kappa", url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0" }];
  authorizationUrl(_state: string) { return "https://example.test/oauth"; }
  async exchangeCode(code: string) {
    this.exchangeCodes.push(code);
    return { id: "1", login: "tester", display_name: "Tester", profile_image_url: "" };
  }
  async connectEventSub() { this.connectCalls += 1; }
  async sendChatMessage(message: string) { this.chatMessages.push(message); }
  async listEmotes() { return this.emotes; }
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

class FailingChatTwitch extends FakeTwitch {
  override async sendChatMessage(message: string) {
    this.chatMessages.push(message);
    throw new Error("Twitch rate limited the bot");
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
  it("applies validated session settings through the HTTP interface", async () => {
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    const configured = await server.inject({
      method: "POST",
      url: "/api/session/settings",
      payload: { intensity: "mild", playSeconds: 75, blockedTerms: ["private info"] }
    });
    const started = await server.inject({ method: "POST", url: "/api/session/start" });

    expect(configured.statusCode).toBe(200);
    expect(configured.json()).toEqual({ settings: { intensity: "mild", playSeconds: 75, blockedTerms: ["private info"] } });
    expect(started.json().round).toMatchObject({ phase: "play", remainingSeconds: 75 });
    await server.close();
  });

  it("pauses the round timer without losing the current phase", async () => {
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 2
    });
    await server.inject({ method: "POST", url: "/api/session/start" });
    const paused = await server.inject({ method: "POST", url: "/api/session/pause", payload: { paused: true } });
    const beforeWait = await server.inject({ method: "GET", url: "/api/status" });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const status = await server.inject({ method: "GET", url: "/api/status" });
    expect(paused.statusCode).toBe(200);
    expect(paused.json()).toMatchObject({ paused: true });
    expect(status.json()).toMatchObject({ session: { paused: true }, round: { phase: "play" } });
    expect(status.json().round.remainingSeconds).toBe(beforeWait.json().round.remainingSeconds);
    await server.close();
  });

  it("compresses the full pitch into audience-ready candidates before vote", async () => {
    const seen: string[][] = [];
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => patch,
      compressProposals: async (proposals) => {
        seen.push(proposals.map(({ text }) => text));
        return [{
          id: "compressed-1",
          title: "Emote Storm",
          description: "Giant Kappas fall together",
          proposer: "viewer",
          difficulty: "chaos",
          votes: 0
        }];
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });
    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "!patch giant emotes" } });

    const response = await server.inject({ method: "POST", url: "/api/session/advance" });

    expect(response.statusCode).toBe(200);
    expect(seen).toEqual([["giant emotes"]]);
    expect(response.json().round).toMatchObject({
      phase: "vote",
      candidates: [{ id: "compressed-1", title: "Emote Storm" }]
    });
    await server.close();
  });

  it("runs candidate compression when the timed pitch closes", async () => {
    let compressCalls = 0;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => patch,
      compressProposals: async () => {
        compressCalls += 1;
        return [{
          id: "timed-1",
          title: "Timed Candidate",
          description: "Created after the pitch timer",
          proposer: "viewer",
          difficulty: "spicy",
          votes: 0
        }];
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 2
    });
    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "!patch giant emotes" } });

    const response = await waitForRoundPhase(server, "vote");
    expect(compressCalls).toBe(1);
    expect(response.json().round).toMatchObject({
      phase: "vote",
      candidates: [{ id: "timed-1", title: "Timed Candidate" }]
    });
    await server.close();
  });

  it("announces pitch, vote, and applied patch transitions in Twitch chat", async () => {
    const twitch = new FakeTwitch();
    const candidates = [
      { id: "1", title: "Giant Emotes", description: "Huge Kappas", proposer: "viewer", difficulty: "chaos" as const, votes: 0 },
      { id: "2", title: "Mirror Controls", description: "Swap directions", proposer: "chat", difficulty: "spicy" as const, votes: 0 },
      { id: "3", title: "Lava Floor", description: "Floor burns", proposer: "chat", difficulty: "mild" as const, votes: 0 }
    ];
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      compressProposals: async () => candidates,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "voter", message: "1" } });
    await server.inject({ method: "POST", url: "/api/session/compile" });
    await waitFor(() => twitch.chatMessages.length === 3);

    expect(twitch.chatMessages).toEqual([
      "PATCH PITCH (30s) — !patch <your idea> to change the game. Current v1",
      "1) Giant Emotes 2) Mirror Controls 3) Lava Floor — type 1, 2 or 3",
      "v2 applied: Test Patch — proposed by @viewer (1 votes)"
    ]);
    await server.close();
  });

  it("keeps round transitions non-blocking when Twitch announcements fail", async () => {
    const twitch = new FailingChatTwitch();
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    const pitch = await server.inject({ method: "POST", url: "/api/session/advance" });
    const vote = await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "voter", message: "1" } });
    const applied = await server.inject({ method: "POST", url: "/api/session/compile" });
    const duplicate = await server.inject({ method: "POST", url: "/api/session/compile" });
    await waitFor(() => twitch.chatMessages.length === 3);

    expect(pitch.json().round.phase).toBe("pitch");
    expect(vote.json().round.phase).toBe("vote");
    expect(applied.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(200);
    expect(twitch.chatMessages).toHaveLength(3);
    await server.close();
  });

  it("retries a timed-out compile once and applies a safe fallback patch", async () => {
    let compileCalls = 0;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async () => {
        compileCalls += 1;
        return await new Promise<PatchV1>(() => undefined);
      },
      compileTimeoutMilliseconds: 5,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "voter", message: "1" } });
    const response = await server.inject({ method: "POST", url: "/api/session/compile" });

    expect(response.statusCode).toBe(200);
    expect(compileCalls).toBe(2);
    expect(response.json()).toMatchObject({
      patch: {
        version: 2,
        title: "Safe Mode",
        proposer: "system",
        notes: ["Compile failed; applying a cached safe patch"]
      },
      round: { phase: "apply", version: 2 }
    });
    await server.close();
  });

  it("exposes current Twitch emotes to the game renderer", async () => {
    const twitch = new FakeTwitch();
    const server = createChaosPatchServer({
      twitch,
      compileCandidate: async () => patch,
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    const response = await server.inject({ method: "GET", url: "/api/twitch/emotes" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ emotes: twitch.emotes });
    await server.close();
  });

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
    let compileIntensity: string | undefined;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async (_candidate, _version, intensity) => {
        compileCalls += 1;
        compileIntensity = intensity;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return patch;
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({
      method: "POST",
      url: "/api/session/settings",
      payload: { intensity: "mild", playSeconds: 60, blockedTerms: [] }
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
    expect(compileIntensity).toBe("mild");
    const status = await server.inject({ method: "GET", url: "/api/status" });
    expect(status.json().round).toMatchObject({
      version: 2,
      phase: "apply",
      activePatch: { title: "Test Patch" },
      patchHistory: [{ version: 2, status: "applied" }]
    });
    await server.close();
  });

  it("returns the same build when a completed round is compiled again", async () => {
    let compileCalls = 0;
    const server = createChaosPatchServer({
      twitch: new FakeTwitch(),
      compileCandidate: async (_candidate, nextVersion) => {
        compileCalls += 1;
        return { ...patch, version: nextVersion };
      },
      sessionSecret: "test-session-secret-that-is-at-least-32-characters",
      webOrigin: "http://localhost:5173",
      tickMilliseconds: 10_000
    });

    await server.inject({ method: "POST", url: "/api/session/start" });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "!patch giant emotes" } });
    await server.inject({ method: "POST", url: "/api/session/advance" });
    await server.inject({ method: "POST", url: "/api/mock/chat", payload: { userName: "viewer", message: "1" } });

    const first = await server.inject({ method: "POST", url: "/api/session/compile" });
    const duplicate = await server.inject({ method: "POST", url: "/api/session/compile" });
    const status = await server.inject({ method: "GET", url: "/api/status" });

    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().patch.version).toBe(2);
    expect(compileCalls).toBe(1);
    expect(status.json().round).toMatchObject({
      version: 2,
      phase: "apply",
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

async function waitForRoundPhase(
  server: ReturnType<typeof createChaosPatchServer>,
  phase: string,
  timeoutMilliseconds = 500
) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const response = await server.inject({ method: "GET", url: "/api/status" });
    if (response.json().round.phase === phase) return response;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`Timed out waiting for round phase ${phase}`);
}

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 500) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for condition");
}
