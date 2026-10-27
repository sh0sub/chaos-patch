import { createHmac, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import WebSocket, { WebSocketServer } from "ws";
import type { Candidate, PatchV1 } from "@chaos-patch/schema";
import { RoundStore } from "./round";
import type { TwitchChatMessage, TwitchStatus } from "./twitch";

export type TwitchPort = {
  on(event: "chat", listener: (message: TwitchChatMessage) => void): unknown;
  on(event: "status", listener: () => void): unknown;
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<unknown>;
  connectEventSub(): Promise<void>;
  sendChatMessage(message: string): Promise<void>;
  createClip(title: string): Promise<{ id: string; editUrl: string }>;
  createMarker(description: string): Promise<{
    id: string;
    createdAt: string;
    positionSeconds: number;
    description: string;
  }>;
  status(): TwitchStatus;
};

type Compiler = (candidate: Candidate, nextVersion: number) => Promise<PatchV1>;

type ServerOptions = {
  twitch: TwitchPort;
  compileCandidate: Compiler;
  sessionSecret: string;
  webOrigin: string;
  tickMilliseconds?: number;
};

export function createChaosPatchServer(options: ServerOptions) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const rounds = new RoundStore();
  const browserClients = new Set<WebSocket>();
  const oauthStates = new Map<string, number>();
  let compilePromise: Promise<{ patch: PatchV1; round: ReturnType<RoundStore["snapshot"]> }> | null = null;

  function broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload });
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  function broadcastSnapshot(): void {
    broadcast("state:snapshot", { twitch: options.twitch.status(), round: rounds.snapshot() });
  }

  function createOauthState(): string {
    const nonce = randomBytes(20).toString("hex");
    const signature = createHmac("sha256", options.sessionSecret).update(nonce).digest("hex");
    const state = `${nonce}.${signature}`;
    oauthStates.set(state, Date.now() + 10 * 60_000);
    return state;
  }

  function consumeOauthState(state: string): boolean {
    const expiresAt = oauthStates.get(state);
    oauthStates.delete(state);
    return Boolean(expiresAt && expiresAt > Date.now());
  }

  function handleChat(message: TwitchChatMessage): void {
    const proposal = rounds.addProposal(message.userId, message.userName, message.text);
    if (/^[123]$/.test(message.text.trim())) rounds.vote(message.userId, Number(message.text.trim()));
    broadcast("chat:message", message);
    if (proposal) broadcast("proposal:added", proposal);
    broadcastSnapshot();
  }

  options.twitch.on("chat", handleChat);
  options.twitch.on("status", broadcastSnapshot);

  app.get("/api/health", async () => ({ ok: true, service: "chaos-patch" }));
  app.get("/api/status", async () => ({ twitch: options.twitch.status(), round: rounds.snapshot() }));
  app.get("/api/session/recap", async () => {
    const state = rounds.snapshot();
    return {
      round: state.round,
      build: state.version,
      applied: state.patchHistory.filter((entry) => entry.status === "applied").length,
      rolledBack: state.patchHistory.filter((entry) => entry.status === "rolled_back").length,
      activePatch: state.activePatch?.title ?? null,
      recent: state.patchHistory.slice(0, 5).map(({ version, title, proposer, status }) => ({ version, title, proposer, status }))
    };
  });
  app.get("/auth/twitch", async (_request, reply) => reply.redirect(options.twitch.authorizationUrl(createOauthState())));

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/auth/callback", async (request, reply) => {
    const { code, state, error } = request.query;
    if (error) return reply.redirect(`${options.webOrigin}/?auth=denied`);
    if (!code || !state || !consumeOauthState(state)) return reply.code(400).send({ error: "Invalid or expired OAuth callback" });
    try {
      await options.twitch.exchangeCode(code);
      await options.twitch.connectEventSub();
      return reply.redirect(`${options.webOrigin}/?auth=connected`);
    } catch (callbackError) {
      request.log.error(callbackError);
      return reply.redirect(`${options.webOrigin}/?auth=failed`);
    }
  });

  app.post("/api/twitch/connect-eventsub", async (_request, reply) => {
    try {
      await options.twitch.connectEventSub();
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "EventSub failed" });
    }
  });

  app.post<{ Body: { message?: string } }>("/api/twitch/send", async (request, reply) => {
    const message = request.body?.message?.trim();
    if (!message) return reply.code(400).send({ error: "Message is required" });
    try {
      await options.twitch.sendChatMessage(message);
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Chat send failed" });
    }
  });

  app.post("/api/twitch/clip", async (_request, reply) => {
    const state = rounds.snapshot();
    try {
      const clip = await options.twitch.createClip(`Chaos Patch · Round ${state.round} · BUILD v${state.version}`);
      return { clip };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Twitch clip creation failed" });
    }
  });

  app.post("/api/twitch/marker", async (_request, reply) => {
    const state = rounds.snapshot();
    try {
      const marker = await options.twitch.createMarker(`Chaos Patch · Round ${state.round} · BUILD v${state.version}`);
      return { marker };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Twitch marker creation failed" });
    }
  });

  app.post<{ Body: { userName?: string; message?: string } }>("/api/mock/chat", async (request, reply) => {
    const message = request.body?.message?.trim();
    if (!message) return reply.code(400).send({ error: "Message is required" });
    const userName = request.body?.userName?.trim() || "mock_viewer";
    handleChat({ id: randomUUID(), userId: `mock:${userName}`, userName, text: message, sentAt: new Date().toISOString() });
    return { ok: true };
  });

  app.post("/api/session/start", async () => {
    const round = rounds.start();
    broadcastSnapshot();
    return { round };
  });

  app.post("/api/session/advance", async () => {
    const round = rounds.advance();
    broadcastSnapshot();
    return { round };
  });

  app.post("/api/session/compile", async (request, reply) => {
    try {
      return await compileWinner();
    } catch (error) {
      return requestError(reply, error, "Patch compilation failed");
    }
  });

  app.post<{ Body: { version?: number; reason?: string } }>("/api/session/rollback", async (request, reply) => {
    const result = rounds.rollback(request.body?.version);
    if (!result) return reply.code(409).send({ error: "Patch is no longer active" });
    request.log.warn({ version: result.patch.version, reason: request.body?.reason ?? "manual" }, "Patch rolled back");
    broadcast("patch:rolled_back", { patch: result.patch, reason: request.body?.reason ?? "manual" });
    broadcastSnapshot();
    return { ok: true, round: result.round };
  });

  async function compileWinner() {
    if (compilePromise) return compilePromise;
    compilePromise = (async () => {
      const winner = rounds.winner();
      if (!winner) throw new Error("At least one chat vote is required before compiling");
      const patch = await options.compileCandidate(winner, rounds.snapshot().version + 1);
      const round = rounds.apply(patch);
      broadcast("patch:applied", patch);
      broadcastSnapshot();
      return { patch, round };
    })();
    try {
      return await compilePromise;
    } finally {
      compilePromise = null;
    }
  }

  const timer = setInterval(() => {
    const expiredPhase = rounds.tick();
    broadcastSnapshot();
    if (expiredPhase === "vote") {
      void compileWinner().catch((error) => {
        app.log.error(error);
        broadcast("compile:error", { message: error instanceof Error ? error.message : "Patch compilation failed" });
      });
    }
  }, options.tickMilliseconds ?? 1_000);
  timer.unref();

  const wsServer = new WebSocketServer({ noServer: true });
  wsServer.on("connection", (socket) => {
    browserClients.add(socket);
    socket.send(JSON.stringify({ type: "state:snapshot", payload: { twitch: options.twitch.status(), round: rounds.snapshot() } }));
    socket.on("close", () => browserClients.delete(socket));
  });
  app.server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") return socket.destroy();
    wsServer.handleUpgrade(request, socket, head, (client) => wsServer.emit("connection", client, request));
  });
  app.addHook("onClose", async () => {
    clearInterval(timer);
    for (const client of browserClients) client.terminate();
  });

  return app;
}

function requestError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown, fallback: string): unknown {
  return reply.code(500).send({ error: error instanceof Error ? error.message : fallback });
}
