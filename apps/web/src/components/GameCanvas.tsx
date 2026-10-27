import { useEffect, useRef, useState } from "react";
import { applyPatch, createGameState, resizeGame, restartGame, stepGame, type GameState } from "@chaos-patch/game";
import type { PatchV1 } from "@chaos-patch/schema";

type Props = {
  patch: PatchV1 | null;
  onEarlyCrash?: (version: number) => void;
};

export function GameCanvas({ patch, onEarlyCrash }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const inputRef = useRef({ left: false, right: false });
  const patchRef = useRef<PatchV1 | null>(patch);
  const crashHandlerRef = useRef(onEarlyCrash);
  const reportedVersionRef = useRef<number | null>(null);
  const [alive, setAlive] = useState(true);
  const patchVersion = patch?.version ?? null;

  const restart = () => {
    stateRef.current = restartGame(stateRef.current);
    setAlive(true);
  };

  useEffect(() => {
    crashHandlerRef.current = onEarlyCrash;
  }, [onEarlyCrash]);

  useEffect(() => {
    patchRef.current = patch;
    reportedVersionRef.current = null;
    const fresh = createGameState(stateRef.current.width, stateRef.current.height);
    stateRef.current = patch ? applyPatch(fresh, patch) : fresh;
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
      if (event.key === " " && active && !stateRef.current.alive) restart();
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
      stateRef.current = stepGame(stateRef.current, delta, inputRef.current);
      if (wasAlive && !stateRef.current.alive) {
        setAlive(false);
        const activePatch = patchRef.current;
        if (activePatch && stateRef.current.elapsed <= 6 && reportedVersionRef.current !== activePatch.version) {
          reportedVersionRef.current = activePatch.version;
          crashHandlerRef.current?.(activePatch.version);
        }
      }
      drawGame(context, stateRef.current);
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
      {!alive && <button className="game-restart" onClick={restart}>Restart run <span>SPACE</span></button>}
    </div>
  );
}

function drawGame(ctx: CanvasRenderingContext2D, state: GameState) {
  const palettes = {
    default: ["#111219", "#c8ff3d", "#9146ff"], neon: ["#090713", "#3de0ff", "#ff3da6"],
    lava: ["#190b08", "#ffc46b", "#ff3d53"], ice: ["#07141a", "#efffff", "#3de0ff"], mono: ["#101010", "#ffffff", "#777777"]
  } as const;
  const [background, player, obstacle] = palettes[state.params.palette];
  ctx.fillStyle = state.params.invertColors ? player : background;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x < state.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.height); ctx.stroke(); }
  for (let y = 0; y < state.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke(); }

  if (state.params.floorMode === "lava") {
    ctx.fillStyle = "#ff3d53"; ctx.fillRect(0, state.height - 12, state.width, 12);
  }
  ctx.fillStyle = obstacle;
  for (const item of state.obstacles) { ctx.beginPath(); ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = state.params.invertColors ? background : player;
  ctx.beginPath(); ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(state.params.labelPlayer, state.player.x, state.player.y + 4);
  ctx.textAlign = "left";
  ctx.fillStyle = "#efeff1";
  ctx.font = "700 13px ui-monospace, monospace";
  ctx.fillText(`SCORE ${Math.floor(state.score).toString().padStart(5, "0")}`, 20, 28);
  if (!state.alive) {
    ctx.fillStyle = "rgba(14,14,16,.78)"; ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#efeff1"; ctx.textAlign = "center"; ctx.font = "800 30px system-ui";
    ctx.fillText("RUN ENDED", state.width / 2, state.height / 2 - 8);
    ctx.font = "500 14px system-ui"; ctx.fillText("Press space or restart below", state.width / 2, state.height / 2 + 24);
  }
}
