/**
 * boot.ts — HODL HEROES bootstrap: mounts the 2D canvas game onto the shell's <canvas>.
 * Contract with the React shell (src/pages/Home.tsx):
 *   startGame(canvas)  mounts renderer + loop onto an existing <canvas>
 *   stopGame()         tears everything down (loop, listeners, probe)
 * Calling startGame twice is safe: the previous session is stopped first.
 */

import { HodlGame, LOGICAL_W, LOGICAL_H } from "./hodl";
import { initTelegram } from "../lib/telegram";

declare global {
  interface Window {
    __gameProbe?: () => { x: number; y: number; z: number };
    __GAME_READY__?: boolean;
  }
}

let session: { dispose: () => void } | null = null;

export function startGame(canvas: HTMLCanvasElement): void {
  stopGame();
  initTelegram();

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const resize = () => {
    // fit the fixed logical portrait field into the available window
    const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
    const cssW = Math.floor(LOGICAL_W * scale);
    const cssH = Math.floor(LOGICAL_H * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform((cssW * dpr) / LOGICAL_W, 0, 0, (cssH * dpr) / LOGICAL_H, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };
  resize();
  window.addEventListener("resize", resize);

  const game = new HodlGame(canvas, ctx);
  game.start();

  window.__gameProbe = () => game.probe();
  window.__GAME_READY__ = true;

  session = {
    dispose: () => {
      window.removeEventListener("resize", resize);
      game.dispose();
      window.__GAME_READY__ = false;
      delete window.__gameProbe;
    },
  };
}

export function stopGame(): void {
  session?.dispose();
  session = null;
}
