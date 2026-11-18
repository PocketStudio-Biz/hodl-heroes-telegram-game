export interface GameLoopHandlers {
  update: (dt: number) => void;
  render: () => void;
}

/** Fixed-step-capped animation loop. dt is seconds, capped so a stalled tab cannot skip the run. */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(private handlers: GameLoopHandlers) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.handlers.update(dt);
      this.handlers.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
