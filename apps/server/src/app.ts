import { createHmac, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import WebSocket, { WebSocketServer } from "ws";
import { sessionSettingsSchema, type Candidate, type PatchV1, type Proposal, type SessionSettings } from "@chaos-patch/schema";
import { compressProposalsFallback } from "./candidateCompressor";
import { RoundStore } from "./round";
import type { TwitchChatMessage, TwitchEmote, TwitchStatus } from "./twitch";
import { BrowserClientRegistry } from "./browserClients";
import { RuntimeTelemetry } from "./runtimeTelemetry";

export type TwitchPort = {
  on(event: "chat", listener: (message: TwitchChatMessage) => void): unknown;
  on(event: "status", listener: () => void): unknown;
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<unknown>;
  connectEventSub(): Promise<void>;
  sendChatMessage(message: string): Promise<void>;
  listEmotes(): Promise<TwitchEmote[]>;
  createClip(title: string): Promise<{ id: string; editUrl: string }>;
  createMarker(description: string): Promise<{
    id: string;
    createdAt: string;
    positionSeconds: number;
    description: string;
  }>;
  status(): TwitchStatus;
};

type Compiler = (
  candidate: Candidate,
  nextVersion: number,
  intensity: SessionSettings["intensity"]
) => Promise<PatchV1>;
type CandidateCompressor = (proposals: Proposal[]) => Promise<Candidate[]>;
type CompileResult = { patch: PatchV1; round: ReturnType<RoundStore["snapshot"]> };
type AnnouncementKind = "pitch" | "vote" | "apply";

const scriptedIdeas = [
  "giant Kappa rain",
  "mirror the controls",
  "make the floor lava",
  "low gravity jumps",
  "slippery ice physics",
  "homing emotes",
  "bouncy wall chaos",
  "neon blackout",
  "tiny streamer mode",
  "super speed survival"
] as const;

const scriptedCandidates: Candidate[] = [
  { id: "script-1", title: "Giant Kappa Rain", description: "Huge Kappas flood the arena", proposer: "demo_chat", difficulty: "chaos", votes: 0 },
  { id: "script-2", title: "Mirror Controls", description: "Left and right trade places", proposer: "demo_chat", difficulty: "spicy", votes: 0 },
  { id: "script-3", title: "Lava Floor", description: "Keep moving to survive", proposer: "demo_chat", difficulty: "mild", votes: 0 }
];

const scriptedVotes = [1, 1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 2] as const;

type ServerOptions = {
  twitch: TwitchPort;
  compileCandidate: Compiler;
  compressProposals?: CandidateCompressor;
  compileTimeoutMilliseconds?: number;
  sessionSecret: string;
  webOrigin: string;
  tickMilliseconds?: number;
};

export function createChaosPatchServer(options: ServerOptions) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const rounds = new RoundStore();
  const browserClients = new BrowserClientRegistry<WebSocket>();
  const telemetry = new RuntimeTelemetry();
  const oauthStates = new Map<string, number>();
  const compressProposals = options.compressProposals ?? (async (proposals: Proposal[]) => compressProposalsFallback(proposals));
  let compilePromise: Promise<CompileResult> | null = null;
  let completedCompile: { roundNumber: number; result: CompileResult } | null = null;
  let candidateCompressionPromise: Promise<ReturnType<RoundStore["snapshot"]>> | null = null;
  const announcementsByRound = new Map<number, Set<AnnouncementKind>>();
  let paused = false;
  let filteredCount = 0;

  function announce(kind: AnnouncementKind, roundNumber: number, message: string): void {
    const sent = announcementsByRound.get(roundNumber) ?? new Set<AnnouncementKind>();
    if (sent.has(kind)) return;
    sent.add(kind);
    announcementsByRound.set(roundNumber, sent);
    void options.twitch.sendChatMessage(message.slice(0, 500)).catch((error) => {
      app.log.warn(error, `Twitch ${kind} announcement failed`);
    });
  }

  function announcePitch(round: ReturnType<RoundStore["snapshot"]>): void {
    announce(
      "pitch",
      round.round,
      `PATCH PITCH (30s) — !patch <your idea> to change the game. Current v${round.version}`
    );
  }

  function announceVote(round: ReturnType<RoundStore["snapshot"]>): void {
    const choices = round.candidates.map((candidate, index) => `${index + 1}) ${candidate.title}`).join(" ");
    announce("vote", round.round, `${choices} — type 1, 2 or 3`);
  }

  async function createApplyClipAndAnnounce(
    round: ReturnType<RoundStore["snapshot"]>,
    patch: PatchV1,
    votes: number
  ): Promise<void> {
    const result = `v${patch.version} applied: ${patch.title} — proposed by @${patch.proposer} (${votes} votes)`;
    try {
      const clip = await options.twitch.createClip(`Chaos Patch · Round ${round.round} · BUILD v${patch.version}`);
      announce("apply", round.round, `${result} — ${clip.editUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const unavailable = /\b(?:403|404)\b|not authorized|must be live/i.test(message);
      if (!unavailable) app.log.warn(error, "Automatic Twitch clip creation failed");
      announce("apply", round.round, result);
    }
  }

  function broadcast(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload });
    for (const client of browserClients.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  function snapshotPayload() {
    return {
      twitch: options.twitch.status(),
      round: rounds.snapshot(),
      session: { paused, settings: rounds.settingsSnapshot(), filteredCount, overlayClients: browserClients.overlayCount },
      telemetry: telemetry.snapshot()
    };
  }

  function broadcastSnapshot(): void {
    broadcast("state:snapshot", snapshotPayload());
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

  function handleChat(message: TwitchChatMessage) {
    telemetry.recordChat();
    const filtered = rounds.proposalIsBlocked(message.text);
    const proposal = rounds.addProposal(message.userId, message.userName, message.text);
    if (filtered) filteredCount += 1;
    if (/^[123]$/.test(message.text.trim())) rounds.vote(message.userId, Number(message.text.trim()));
    const visibleMessage = filtered ? { ...message, text: "[filtered]", filtered: true } : { ...message, filtered: false };
    broadcast("chat:message", visibleMessage);
    if (proposal) broadcast("proposal:added", proposal);
    broadcastSnapshot();
    return { proposal, filtered, message: visibleMessage.text };
  }

  async function enterVote(): Promise<ReturnType<RoundStore["snapshot"]>> {
    if (candidateCompressionPromise) return candidateCompressionPromise;
    const current = rounds.snapshot();
    if (current.phase !== "pitch") return current;
    candidateCompressionPromise = (async () => {
      let candidates: Candidate[];
      try {
        candidates = await compressProposals(current.proposals);
      } catch (error) {
        app.log.error(error, "Candidate compression failed; using local fallback");
        candidates = compressProposalsFallback(current.proposals);
      }
      const round = rounds.snapshot().phase === "pitch" ? rounds.advance(candidates) : rounds.snapshot();
      if (round.phase === "vote") announceVote(round);
      broadcastSnapshot();
      return round;
    })();
    try {
      return await candidateCompressionPromise;
    } finally {
      candidateCompressionPromise = null;
    }
  }

  options.twitch.on("chat", handleChat);
  options.twitch.on("status", broadcastSnapshot);

  app.get("/api/health", async () => ({ ok: true, service: "chaos-patch" }));
  app.get("/api/status", async () => snapshotPayload());
  app.post<{ Body: SessionSettings }>("/api/session/settings", async (request, reply) => {
    const parsed = sessionSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid session settings" });
    const settings = rounds.configure(parsed.data);
    broadcastSnapshot();
    return { settings };
  });
  app.get("/api/twitch/emotes", async (_request, reply) => {
    try {
      return { emotes: await options.twitch.listEmotes() };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Twitch emote lookup failed" });
    }
  });
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
    const result = handleChat({ id: randomUUID(), userId: `mock:${userName}`, userName, text: message, sentAt: new Date().toISOString() });
    return { ok: true, filtered: result.filtered, message: result.message };
  });

  app.post("/api/mock/script", async () => {
    paused = true;
    filteredCount = 0;
    rounds.startPitch();
    scriptedIdeas.forEach((idea, index) => {
      handleChat({
        id: `script-message-${index + 1}`,
        userId: `script:viewer-${index + 1}`,
        userName: `viewer_${index + 1}`,
        text: `!patch ${idea}`,
        sentAt: new Date().toISOString()
      });
    });
    rounds.advance(scriptedCandidates);
    scriptedVotes.forEach((choice, index) => rounds.vote(`script:voter-${index + 1}`, choice));
    const round = rounds.snapshot();
    broadcastSnapshot();
    return { round, seededProposals: scriptedIdeas.length, seededVotes: scriptedVotes.length };
  });

  app.post("/api/session/start", async () => {
    paused = false;
    filteredCount = 0;
    const round = rounds.start();
    broadcastSnapshot();
    return { round };
  });

  app.post<{ Body: { paused?: boolean } }>("/api/session/pause", async (request, reply) => {
    if (typeof request.body?.paused !== "boolean") return reply.code(400).send({ error: "Paused state is required" });
    paused = request.body.paused;
    broadcastSnapshot();
    return { paused };
  });

  app.post("/api/session/advance", async () => {
    const current = rounds.snapshot();
    const round = current.phase === "pitch" ? await enterVote() : rounds.advance();
    if (round.phase === "play") filteredCount = 0;
    if (round.phase === "pitch") announcePitch(round);
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
    const roundNumber = rounds.snapshot().round;
    if (completedCompile?.roundNumber === roundNumber) return completedCompile.result;
    compilePromise = (async () => {
      const compileStartedAt = performance.now();
      const winner = rounds.winner();
      if (!winner) throw new Error("At least one chat vote is required before compiling");
      const nextVersion = rounds.snapshot().version + 1;
      const compile = () => withTimeout(
        options.compileCandidate(winner, nextVersion, rounds.settingsSnapshot().intensity),
        options.compileTimeoutMilliseconds ?? 6_000,
        "Patch compilation timed out"
      );
      let patch: PatchV1;
      try {
        patch = await compile();
      } catch (firstError) {
        app.log.warn(firstError, "Patch compilation failed; retrying once");
        try {
          patch = await compile();
        } catch (retryError) {
          patch = safeFallbackPatch(nextVersion);
          const message = `compile failed → applying cached patch '${patch.title}'`;
          app.log.error(retryError, message);
          broadcast("compile:error", { message });
        }
      }
      telemetry.recordCompile(performance.now() - compileStartedAt);
      const round = rounds.apply(patch);
      void createApplyClipAndAnnounce(round, patch, winner.votes);
      broadcast("patch:applied", patch);
      broadcastSnapshot();
      const result = { patch, round };
      completedCompile = { roundNumber, result };
      return result;
    })();
    try {
      return await compilePromise;
    } finally {
      compilePromise = null;
    }
  }

  const timer = setInterval(() => {
    if (paused) return;
    const phaseBeforeTick = rounds.snapshot().phase;
    const expiredPhase = rounds.tick();
    if (phaseBeforeTick !== "play" && rounds.snapshot().phase === "play") filteredCount = 0;
    broadcastSnapshot();
    if (expiredPhase === "pitch") {
      void enterVote();
    } else if (expiredPhase === "play") {
      announcePitch(rounds.snapshot());
    } else if (expiredPhase === "vote") {
      void compileWinner().catch((error) => {
        app.log.error(error);
        broadcast("compile:error", { message: error instanceof Error ? error.message : "Patch compilation failed" });
      });
    }
  }, options.tickMilliseconds ?? 1_000);
  timer.unref();

  const wsServer = new WebSocketServer({ noServer: true });
  wsServer.on("connection", (socket, request) => {
    browserClients.add(socket, request.url);
    socket.send(JSON.stringify({ type: "state:snapshot", payload: snapshotPayload() }));
    broadcastSnapshot();
    socket.on("close", () => {
      browserClients.delete(socket);
      broadcastSnapshot();
    });
  });
  app.server.on("upgrade", (request, socket, head) => {
    if (new URL(request.url ?? "", "http://localhost").pathname !== "/ws") return socket.destroy();
    wsServer.handleUpgrade(request, socket, head, (client) => wsServer.emit("connection", client, request));
  });
  app.addHook("onClose", async () => {
    clearInterval(timer);
    for (const client of browserClients.clients) client.terminate();
  });

  return app;
}

function requestError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown, fallback: string): unknown {
  return reply.code(500).send({ error: error instanceof Error ? error.message : fallback });
}

function withTimeout<T>(promise: Promise<T>, timeoutMilliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMilliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function safeFallbackPatch(version: number): PatchV1 {
  return {
    version,
    title: "Safe Mode",
    proposer: "system",
    notes: ["Compile failed; applying a cached safe patch"],
    params: { obstacleScale: 0.8, spawnRate: 0.65, playerSpeed: 1.15 }
  };
}
