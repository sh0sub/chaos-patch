import { useEffect, useRef, useState } from "react";
import { applyPatch, createGameState, resizeGame, restartGame, type GameState } from "@chaos-patch/game";
import { defaultPatchParams, type PatchV1 } from "@chaos-patch/schema";
import { advanceGameFrame, bestSurvivalSeconds, canRestartRun } from "../gameRuntime";
import { arenaHudCopy, arenaPlayerAppearance, arenaPlayerLabel, emoteObstacleAppearance, gameVisualSources, obstacleSpawnScale, renderEffectProfile, scorePulseScale, type EmoteCatalog } from "../gameVisuals";
import { PatchHealthGuard } from "../patchHealth";

type Props = {
  patch: PatchV1 | null;
  paused?: boolean;
  emoteCatalog?: EmoteCatalog;
  playerImageUrl?: string | null;
  playerLabel?: string | null;
  onPatchFailure?: (version: number, reason: "early_crash" | "low_fps") => void;
};

const emptyCatalog: EmoteCatalog = new Map();

export function GameCanvas({ patch, paused = false, emoteCatalog = emptyCatalog, playerImageUrl = null, playerLabel = null, onPatchFailure }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const inputRef = useRef({ left: false, right: false });
  const patchRef = useRef<PatchV1 | null>(patch);
  const pausedRef = useRef(paused);
  const failureHandlerRef = useRef(onPatchFailure);
  const healthGuardRef = useRef(new PatchHealthGuard());
  const visualsRef = useRef({ emoteCatalog, playerImageUrl, playerLabel });
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const reportedVersionRef = useRef<number | null>(null);
  const bestSecondsRef = useRef(0);
  const hitAtRef = useRef<number | null>(null);
  const [alive, setAlive] = useState(true);
  const patchVersion = patch?.version ?? null;
  const arenaTitle = patch?.params.labelTitle ?? defaultPatchParams.labelTitle;

  const restart = () => {
    stateRef.current = restartGame(stateRef.current);
    hitAtRef.current = null;
    setAlive(true);
  };

  useEffect(() => {
    failureHandlerRef.current = onPatchFailure;
  }, [onPatchFailure]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    visualsRef.current = { emoteCatalog, playerImageUrl, playerLabel };
    const sources = gameVisualSources(
      patchRef.current?.params.obstacleSprite ?? "circle",
      emoteCatalog,
      playerImageUrl
    );
    for (const url of [sources.obstacleImageUrl, sources.playerImageUrl]) {
      if (url) loadImage(imageCacheRef.current, url);
    }
  }, [emoteCatalog, playerImageUrl, playerLabel]);

  useEffect(() => {
    patchRef.current = patch;
    reportedVersionRef.current = null;
    healthGuardRef.current.reset();
    hitAtRef.current = null;
    const fresh = createGameState(stateRef.current.width, stateRef.current.height);
    stateRef.current = patch ? applyPatch(fresh, patch) : fresh;
    const obstacleImageUrl = gameVisualSources(
      stateRef.current.params.obstacleSprite,
      visualsRef.current.emoteCatalog,
      visualsRef.current.playerImageUrl
    ).obstacleImageUrl;
    if (obstacleImageUrl) loadImage(imageCacheRef.current, obstacleImageUrl);
    setAlive(true);
  }, [patchVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stateRef.current = resizeGame(stateRef.current, rect.width, rect.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const updateKey = (event: KeyboardEvent, active: boolean) => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) inputRef.current.left = active;
      if (["ArrowRight", "d", "D"].includes(event.key)) inputRef.current.right = active;
      if (event.key === " " && active && canRestartRun(stateRef.current.alive, pausedRef.current)) restart();
    };
    const down = (event: KeyboardEvent) => updateKey(event, true);
    const up = (event: KeyboardEvent) => updateKey(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let frame = 0;
    let previous = performance.now();
    const render = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      const wasAlive = stateRef.current.alive;
      stateRef.current = advanceGameFrame(stateRef.current, delta, inputRef.current, pausedRef.current);
      if (!pausedRef.current && wasAlive && !stateRef.current.alive) {
        hitAtRef.current = now;
        bestSecondsRef.current = bestSurvivalSeconds(bestSecondsRef.current, stateRef.current.elapsed);
        setAlive(false);
        const activePatch = patchRef.current;
        if (activePatch && stateRef.current.elapsed <= 6 && reportedVersionRef.current !== activePatch.version) {
          reportedVersionRef.current = activePatch.version;
          failureHandlerRef.current?.(activePatch.version, "early_crash");
        }
      }
      const activePatch = patchRef.current;
      if (
        activePatch &&
        !pausedRef.current &&
        !document.hidden &&
        reportedVersionRef.current !== activePatch.version &&
        healthGuardRef.current.observeFrame(delta)
      ) {
        reportedVersionRef.current = activePatch.version;
        failureHandlerRef.current?.(activePatch.version, "low_fps");
      }
      drawGame(context, stateRef.current, visualsRef.current, imageCacheRef.current, bestSecondsRef.current, pausedRef.current, hitAtRef.current === null ? Number.POSITIVE_INFINITY : now - hitAtRef.current);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div className="game-frame">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Playable Emote Dodge arena" />
      <div className="game-arena-title">{arenaTitle}</div>
      {canRestartRun(alive, paused) && <button className="game-restart" onClick={restart}>Restart run <span>SPACE</span></button>}
    </div>
  );
}

function loadImage(cache: Map<string, HTMLImageElement>, url: string): HTMLImageElement {
  const cached = cache.get(url);
  if (cached) return cached;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  cache.set(url, image);
  return image;
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  visuals: { emoteCatalog: EmoteCatalog; playerImageUrl: string | null; playerLabel: string | null },
  imageCache: Map<string, HTMLImageElement>,
  bestSeconds: number,
  paused: boolean,
  hitAgeMs: number
) {
  const palettes = {
    default: ["#111219", "#c8ff3d", "#9146ff"], neon: ["#090713", "#3de0ff", "#ff3da6"],
    lava: ["#190b08", "#ffc46b", "#ff3d53"], ice: ["#07141a", "#efffff", "#3de0ff"], mono: ["#101010", "#ffffff", "#777777"]
  } as const;
  const [background, player, obstacle] = palettes[state.params.palette];
  const effects = renderEffectProfile(state.params.cameraShake, state.params.fog, state.elapsed, hitAgeMs);
  const hud = arenaHudCopy(state.params.labelTitle, state.elapsed, bestSeconds);
  ctx.save();
  ctx.translate(effects.shakeX, effects.shakeY);
  ctx.fillStyle = state.params.invertColors ? player : background;
  ctx.fillRect(-12, -12, state.width + 24, state.height + 24);
  drawPixelWorld(ctx, state.width, state.height, player);

  if (state.params.floorMode === "lava") {
    ctx.fillStyle = "#ff3d53"; ctx.fillRect(0, state.height - 12, state.width, 12);
  }
  const sources = gameVisualSources(state.params.obstacleSprite, visuals.emoteCatalog, visuals.playerImageUrl);
  const obstacleImage = sources.obstacleImageUrl ? loadImage(imageCache, sources.obstacleImageUrl) : null;
  for (const item of state.obstacles) {
    const visualRadius = item.radius * obstacleSpawnScale(item.y, item.radius, item.velocityY, state.params.gravity);
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.fillStyle = "#ff3da6";
    ctx.beginPath();
    ctx.ellipse(item.x, state.height - 18, visualRadius * .8, Math.max(4, visualRadius * .18), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (obstacleImage?.complete && obstacleImage.naturalWidth > 0) {
      const appearance = emoteObstacleAppearance();
      drawPixelEmoteBadge(ctx, item.x, item.y, visualRadius, appearance.outline, appearance.badge);
      ctx.save();
      ctx.imageSmoothingEnabled = appearance.imageSmoothingEnabled;
      ctx.filter = appearance.filter;
      ctx.globalAlpha = appearance.sourceOpacity;
      ctx.drawImage(obstacleImage, item.x - visualRadius * .84, item.y - visualRadius * .84, visualRadius * 1.68, visualRadius * 1.68);
      ctx.restore();
      drawPixelEmoteFace(ctx, item.x, item.y, visualRadius);
    } else if (state.params.obstacleSprite === "square") {
      ctx.fillStyle = obstacle;
      ctx.fillRect(item.x - visualRadius, item.y - visualRadius, visualRadius * 2, visualRadius * 2);
    } else {
      ctx.fillStyle = obstacle;
      ctx.beginPath(); ctx.arc(item.x, item.y, visualRadius, 0, Math.PI * 2); ctx.fill();
    }
  }
  const playerAppearance = arenaPlayerAppearance();
  drawPixelPlayer(ctx, state.player.x, state.player.y, state.player.radius, playerAppearance.fill);
  const playerLabel = arenaPlayerLabel(visuals.playerLabel, state.params.labelPlayer);
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.textAlign = "center";
  const labelWidth = Math.ceil(ctx.measureText(playerLabel).width) + 12;
  const labelY = state.player.y - state.player.radius - 26;
  ctx.fillStyle = "rgba(14,14,16,.9)";
  ctx.fillRect(state.player.x - labelWidth / 2, labelY, labelWidth, 20);
  ctx.fillStyle = "#c8ff3d";
  ctx.fillText(playerLabel, state.player.x, labelY + 14);
  const scorePulse = scorePulseScale(state.elapsed);
  drawHudPanel(ctx, 18, 16, 124, "SURVIVED", hud.survived, scorePulse > 1 ? player : "#efeff1", scorePulse);
  drawHudPanel(ctx, 148, 16, 100, "BEST", hud.best, "#efeff1", 1);
  ctx.restore();
  if (effects.fogOpacity > 0) {
    const fog = ctx.createRadialGradient(state.width / 2, state.height / 2, 40, state.width / 2, state.height / 2, state.width * .7);
    fog.addColorStop(0, `rgba(205,220,225,${effects.fogOpacity * .08})`);
    fog.addColorStop(1, `rgba(160,175,185,${effects.fogOpacity * .48})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, state.width, state.height);
  }
  if (!state.alive && !paused) {
    ctx.fillStyle = "rgba(14,14,16,.78)"; ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#efeff1"; ctx.textAlign = "center"; ctx.font = "800 30px system-ui";
    ctx.fillText("RUN ENDED", state.width / 2, state.height / 2 - 8);
    ctx.font = "500 14px system-ui"; ctx.fillText("Press space or restart below", state.width / 2, state.height / 2 + 24);
  }
}

function drawPixelEmoteBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, outline: string, fill: string) {
  const polygon = (scale: number) => {
    const r = radius * scale;
    const cut = r * .42;
    ctx.beginPath();
    ctx.moveTo(x - cut, y - r);
    ctx.lineTo(x + cut, y - r);
    ctx.lineTo(x + r, y - cut);
    ctx.lineTo(x + r, y + cut);
    ctx.lineTo(x + cut, y + r);
    ctx.lineTo(x - cut, y + r);
    ctx.lineTo(x - r, y + cut);
    ctx.lineTo(x - r, y - cut);
    ctx.closePath();
  };
  ctx.fillStyle = outline;
  polygon(1);
  ctx.fill();
  ctx.fillStyle = fill;
  polygon(.84);
  ctx.fill();
}

function drawPixelEmoteFace(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const unit = Math.max(2, Math.round(radius / 7));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = "#fff0a0";
  ctx.fillRect(-unit * 4, -unit * 4, unit * 3, unit * 3);
  ctx.fillRect(unit, -unit * 4, unit * 3, unit * 3);
  ctx.fillStyle = "#5a261c";
  ctx.fillRect(-unit * 3, -unit * 3, unit * 2, unit * 2);
  ctx.fillRect(unit, -unit * 3, unit * 2, unit * 2);
  ctx.fillRect(-unit * 3, unit, unit * 6, unit * 4);
  ctx.fillStyle = "#241014";
  ctx.fillRect(-unit * 2, unit * 2, unit * 4, unit * 3);
  ctx.fillStyle = "#ff6b42";
  ctx.fillRect(-unit, unit * 4, unit * 2, unit);
  ctx.fillStyle = "#ffd34f";
  ctx.fillRect(-unit * 5, -unit, unit, unit * 2);
  ctx.fillRect(unit * 4, -unit, unit, unit * 2);
  ctx.restore();
}

function drawPixelPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
  const unit = Math.max(2, Math.round(radius / 6));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = "rgba(61,224,255,.24)";
  ctx.fillRect(-unit * 4, radius + unit, unit * 8, unit * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(-unit * 3, -radius, unit * 6, unit * 6);
  ctx.fillRect(-unit * 2, -radius + unit * 6, unit * 4, unit * 4);
  ctx.fillRect(-unit * 3, -radius + unit * 7, unit, unit * 3);
  ctx.fillRect(unit * 2, -radius + unit * 7, unit, unit * 3);
  ctx.fillRect(-unit * 2, -radius + unit * 10, unit, unit * 2);
  ctx.fillRect(unit, -radius + unit * 10, unit, unit * 2);
  ctx.fillStyle = "#d9fbff";
  ctx.fillRect(-unit * 2, -radius + unit * 2, unit, unit * 2);
  ctx.fillRect(unit, -radius + unit * 2, unit, unit * 2);
  ctx.fillStyle = "#10222b";
  ctx.fillRect(-unit, -radius + unit * 4, unit * 2, unit);
  ctx.restore();
}

function drawHudPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, label: string, value: string, valueColor: string, scale: number) {
  ctx.save();
  ctx.fillStyle = "rgba(14,14,16,.82)";
  ctx.fillRect(x, y, width, 56);
  ctx.strokeStyle = "rgba(145,70,255,.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, width - 1, 55);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(239,239,241,.68)";
  ctx.font = "700 10px ui-monospace, monospace";
  ctx.fillText(label, x + 12, y + 18);
  ctx.fillStyle = valueColor;
  ctx.font = `800 ${17 * scale}px ui-monospace, monospace`;
  ctx.fillText(value, x + 12, y + 42);
  ctx.restore();
}

function drawPixelWorld(ctx: CanvasRenderingContext2D, width: number, height: number, lime: string) {
  const unit = Math.max(4, Math.round(width / 220));
  ctx.fillStyle = "#17102d";
  ctx.fillRect(0, height * .28, width, height * .72);

  const stars = [
    [.08, .13, "#efeff1"], [.16, .22, "#3de0ff"], [.29, .1, "#ff3da6"], [.38, .3, "#efeff1"],
    [.53, .17, "#9146ff"], [.64, .27, "#3de0ff"], [.76, .12, "#efeff1"], [.89, .24, "#ff3da6"]
  ] as const;
  for (const [x, y, color] of stars) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(width * x), Math.round(height * y), unit, unit);
  }

  ctx.fillStyle = "#20143d";
  const skyline = [0, .08, .14, .2, .28, .34, .43, .49, .58, .66, .74, .82, .9, 1];
  skyline.forEach((x, index) => {
    const buildingWidth = width * .09;
    const buildingHeight = height * (.11 + (index % 4) * .035);
    ctx.fillRect(width * x, height * .82 - buildingHeight, buildingWidth, buildingHeight);
  });
  ctx.fillStyle = "#2a1950";
  for (let x = unit * 6; x < width; x += unit * 14) {
    ctx.fillRect(x, height * .68, unit * 5, unit * 2);
  }

  drawPlatform(ctx, width * .04, height * .62, width * .25, unit, lime);
  drawPlatform(ctx, width * .72, height * .53, width * .22, unit, lime);
  drawCoins(ctx, width * .08, height * .53, unit, 5);
  drawCoins(ctx, width * .76, height * .44, unit, 4);

  const floorY = height - unit * 7;
  ctx.fillStyle = lime;
  ctx.fillRect(0, floorY, width, unit * 2);
  ctx.fillStyle = "#50317e";
  ctx.fillRect(0, floorY + unit * 2, width, unit * 5);
  ctx.strokeStyle = "#2d1c4e";
  ctx.lineWidth = Math.max(1, unit * .35);
  for (let y = floorY + unit * 2; y < height; y += unit * 3) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  for (let x = 0; x < width; x += unit * 9) {
    ctx.beginPath(); ctx.moveTo(x, floorY + unit * 2); ctx.lineTo(x, height); ctx.stroke();
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, unit: number, lime: string) {
  ctx.fillStyle = lime;
  ctx.fillRect(x, y, width, unit * 2);
  ctx.fillStyle = "#7240a8";
  ctx.fillRect(x + unit, y + unit * 2, width - unit * 2, unit * 2);
  ctx.fillStyle = "#39205d";
  for (let px = x + unit * 2; px < x + width - unit; px += unit * 5) ctx.fillRect(px, y + unit * 2, unit * 2, unit * 3);
}

function drawCoins(ctx: CanvasRenderingContext2D, startX: number, y: number, unit: number, count: number) {
  for (let index = 0; index < count; index += 1) {
    const x = startX + index * unit * 7;
    ctx.fillStyle = "#ffcf32";
    ctx.fillRect(x, y, unit * 4, unit * 5);
    ctx.fillStyle = "#fff19a";
    ctx.fillRect(x + unit, y + unit, unit, unit * 3);
    ctx.fillStyle = "#b96b15";
    ctx.fillRect(x + unit * 3, y + unit, unit, unit * 3);
  }
}
