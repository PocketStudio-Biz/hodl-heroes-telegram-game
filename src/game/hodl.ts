/* ------------------------------------------------------------------ */
/*  HODL HEROES: Moon or Rekt — 2D canvas bullet-hell roguelike        */
/*  All gameplay + UI in one module; React only hosts the <canvas>.    */
/* ------------------------------------------------------------------ */

import { GameLoop } from "./engine";
import { storage } from "./storage";
import { haptic, getTelegramUser, shareScore } from "../lib/telegram";
import { submitScore, fetchGlobalLeaderboard, isSupabaseActive, type LeaderboardEntry } from "../lib/supabase";

/* ----------------------------- config ---------------------------- */

export const LOGICAL_W = 420;
export const LOGICAL_H = 760;

const PAL = {
  bg: "#0D0B1E",
  bgGrid: "#171430",
  ton: "#0098EA",
  tonDark: "#0163A6",
  gold: "#F5C542",
  red: "#E5484D",
  purple: "#9B6DFF",
  green: "#3DDC84",
  white: "#EDEDF4",
  dim: "#8A87A6",
  panel: "#14112B",
};

type ModeId = "roguelike" | "survival" | "bossrush" | "endless" | "hardcore";

interface ModeCfg {
  id: ModeId; name: string; hp: number; upgrades: boolean;
  winBlocks: number | null; bossEvery: number; killQuota: (b: number) => number;
  healBetween: boolean; blurb: string;
}
export const MODES: ModeCfg[] = [
  { id: "roguelike", name: "ROGUELIKE", hp: 180, upgrades: true, winBlocks: 12, bossEvery: 5, healBetween: true, blurb: "12 blocks. Boss every 5. Full shop.", killQuota: (b) => 8 + b * 2 },
  { id: "survival", name: "SURVIVAL", hp: 200, upgrades: false, winBlocks: null, bossEvery: 7, healBetween: false, blurb: "Infinite. No shop. How long?", killQuota: (b) => 10 + b * 2 },
  { id: "bossrush", name: "BOSS RUSH", hp: 180, upgrades: true, winBlocks: 5, bossEvery: 1, healBetween: true, blurb: "Whale boss every block.", killQuota: () => 1 },
  { id: "endless", name: "ENDLESS", hp: 180, upgrades: true, winBlocks: null, bossEvery: 4, healBetween: true, blurb: "Infinite scaling. Shop open.", killQuota: (b) => 8 + b * 2 },
  { id: "hardcore", name: "HARDCORE", hp: 1, upgrades: false, winBlocks: 15, bossEvery: 5, healBetween: false, blurb: "1 HP. 15 blocks. No heals.", killQuota: (b) => 8 + b * 2 },
];

/* ----------------------------- types ----------------------------- */

type ScreenId = "title" | "modes" | "play" | "shop" | "pause" | "over" | "win" | "ranks";

interface Bullet { on: boolean; x: number; y: number; vx: number; vy: number; r: number; dmg: number; foe: boolean }
interface Enemy { on: boolean; kind: "bear" | "fud" | "whale"; x: number; y: number; vx: number; hp: number; maxHp: number; r: number; t: number; fireT: number; sat: number }
interface Pickup { on: boolean; kind: "sat" | "heart"; x: number; y: number; vy: number; t: number }
interface Particle { on: boolean; x: number; y: number; vx: number; vy: number; t: number; max: number; c: string; s: number }
interface FloatText { on: boolean; x: number; y: number; t: number; txt: string; c: string }
interface Btn { id: string; x: number; y: number; w: number; h: number; label: string; sub?: string; disabled?: boolean }

interface RunStats { sat: number; kills: number; maxCombo: number; time: number }

/* ----------------------------- sfx ------------------------------- */

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = storage.get<boolean>("muted", false);
  private musicTimer = 0;
  private musicStep = 0;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    } catch { /* no audio */ }
    return this.ctx;
  }
  unlock() { const c = this.ensure(); if (c && c.state === "suspended") void c.resume(); }
  toggleMute() { this.muted = !this.muted; storage.set("muted", this.muted); if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; }

  private beep(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    const c = this.ensure(); if (!c || !this.master || this.muted) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(c.currentTime + dur);
  }
  private noise(dur: number, vol: number) {
    const c = this.ensure(); if (!c || !this.master || this.muted) return;
    const n = c.sampleRate * dur; const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start();
  }
  shoot() { this.beep(880, 0.05, "square", 0.06, -200); }
  hit() { this.noise(0.08, 0.12); this.beep(200, 0.08, "sawtooth", 0.1, -80); }
  kill() { this.noise(0.15, 0.18); this.beep(320, 0.12, "square", 0.1, -180); }
  pickup() { this.beep(660, 0.07, "sine", 0.1, 220); }
  bullrun() { this.beep(523, 0.1, "square", 0.12); setTimeout(() => this.beep(784, 0.14, "square", 0.12), 90); }
  hurt() { this.beep(160, 0.2, "sawtooth", 0.16, -100); }
  boss() { this.beep(98, 0.5, "sawtooth", 0.2, -30); }
  ui() { this.beep(660, 0.05, "sine", 0.08); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, "square", 0.12), i * 110)); }
  lose() { [392, 311, 233, 155].forEach((f, i) => setTimeout(() => this.beep(f, 0.22, "sawtooth", 0.12), i * 140)); }
  /** simple bass pulse while playing — call every frame */
  tickMusic(dt: number, active: boolean) {
    if (!active || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      const bass = [55, 55, 65.4, 49][this.musicStep % 4];
      this.beep(bass, 0.22, "triangle", 0.09);
      if (this.musicStep % 8 === 4) this.beep(bass * 4, 0.1, "sine", 0.05);
      this.musicStep++;
      this.musicTimer = 0.24;
    }
  }
}

/* ----------------------------- game ------------------------------ */

export class HodlGame {
  screen: ScreenId = "title";
  private mode: ModeCfg = MODES[0];
  private loop: GameLoop;
  private sfx = new Sfx();
  private btns: Btn[] = [];
  private player = { x: LOGICAL_W / 2, y: LOGICAL_H - 110, r: 10, hp: 180, maxHp: 180, dmg: 12, fireRate: 5.5, fireT: 0, speed: 260, spread: 1, inv: 0 };
  private bullets: Bullet[] = [];
  private foes: Enemy[] = [];
  private drops: Pickup[] = [];
  private parts: Particle[] = [];
  private floats: FloatText[] = [];
  private keys = new Set<string>();
  private pointer = { down: false, x: 0, y: 0, moved: false };
  private block = 1;
  private killsThisBlock = 0;
  private quota = 10;
  private spawnT = 0;
  private combo = 0;
  private comboT = 0;
  private stats: RunStats = { sat: 0, kills: 0, maxCombo: 0, time: 0 };
  private shake = 0;
  private banner = { txt: "", t: 0, c: PAL.gold };
  private ranks: LeaderboardEntry[] | null = null;
  private submitted = false;
  private best = storage.get<Record<string, number>>("best", {});
  private unsub: Array<() => void> = [];
  private overReason = "";

  constructor(private canvas: HTMLCanvasElement, private ctx: CanvasRenderingContext2D) {
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.bindInput();
  }

  start() { this.loop.start(); }
  dispose() {
    this.loop.stop();
    this.unsub.forEach((u) => u());
    this.unsub = [];
  }

  /* ------------------------- input ------------------------- */

  private on<K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) {
    window.addEventListener(type, fn, opts);
    this.unsub.push(() => window.removeEventListener(type, fn, opts));
  }

  private toLogical(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * LOGICAL_W, y: ((cy - r.top) / r.height) * LOGICAL_H };
  }

  private bindInput() {
    this.on("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space") this.pressPrimary();
      if (e.code === "KeyP" || e.code === "Escape") this.togglePause();
      if (e.code === "KeyM") { this.sfx.toggleMute(); this.sfx.ui(); }
    });
    this.on("keyup", (e) => this.keys.delete(e.code));
    const down = (e: PointerEvent) => {
      this.sfx.unlock();
      const p = this.toLogical(e.clientX, e.clientY);
      this.pointer = { down: true, x: p.x, y: p.y, moved: false };
      this.hitButtons(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (!this.pointer.down) return;
      const p = this.toLogical(e.clientX, e.clientY);
      const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.pointer.moved = true;
      if (this.screen === "play") {
        this.player.x += dx; this.player.y += dy;
        this.clampPlayer();
      }
      this.pointer.x = p.x; this.pointer.y = p.y;
    };
    const up = () => { this.pointer.down = false; };
    this.canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.unsub.push(() => {
      this.canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    });
    const onVis = () => { if (document.hidden && this.screen === "play") this.screen = "pause"; };
    document.addEventListener("visibilitychange", onVis);
    this.unsub.push(() => document.removeEventListener("visibilitychange", onVis));
  }

  private pressPrimary() {
    this.sfx.unlock();
    if (this.screen === "title") { this.screen = "modes"; this.sfx.ui(); }
    else if (this.screen === "modes") this.startRun(MODES[0]);
    else if (this.screen === "over" || this.screen === "win") { this.screen = "title"; this.sfx.ui(); }
  }

  togglePause() {
    if (this.screen === "play") { this.screen = "pause"; this.sfx.ui(); }
    else if (this.screen === "pause") { this.screen = "play"; this.sfx.ui(); }
  }

  /* ------------------------- run setup ------------------------- */

  private startRun(m: ModeCfg) {
    this.mode = m;
    this.screen = "play";
    this.block = 1;
    this.killsThisBlock = 0;
    this.quota = m.killQuota(1);
    this.combo = 0; this.comboT = 0;
    this.stats = { sat: 0, kills: 0, maxCombo: 0, time: 0 };
    this.submitted = false;
    this.overReason = "";
    Object.assign(this.player, { x: LOGICAL_W / 2, y: LOGICAL_H - 110, hp: m.hp, maxHp: m.hp, dmg: 12, fireRate: 5.5, speed: 260, spread: 1, inv: 1.2, fireT: 0 });
    for (const b of this.bullets) b.on = false;
    for (const f of this.foes) f.on = false;
    for (const p of this.drops) p.on = false;
    this.spawnT = 0.5;
    this.setBanner(`BLOCK 1`, PAL.ton);
    this.sfx.ui(); haptic("medium");
  }

  private nextBlock() {
    this.block++;
    this.killsThisBlock = 0;
    this.quota = this.mode.killQuota(this.block);
    if (this.mode.healBetween) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    if (this.mode.winBlocks && this.block > this.mode.winBlocks) { this.winRun(); return; }
    if (this.mode.upgrades) { this.screen = "shop"; }
    else { this.setBanner(`BLOCK ${this.block}`, PAL.ton); }
    haptic("success");
  }

  private winRun() {
    this.screen = "win";
    this.sfx.win(); haptic("success");
    this.saveBest(); this.submit();
  }

  private loseRun() {
    this.screen = "over";
    this.overReason = this.mode.id === "hardcore" ? "ONE HIT. THAT'S THE RULE." : "PORTFOLIO LIQUIDATED.";
    this.setBanner("REKT", PAL.red);
    this.shake = 14;
    this.sfx.lose(); haptic("error");
    this.saveBest(); this.submit();
  }

  private saveBest() {
    const b = this.best[this.mode.id] ?? 0;
    if (this.stats.sat > b) { this.best[this.mode.id] = this.stats.sat; storage.set("best", this.best); }
  }

  private submit() {
    if (this.submitted || !isSupabaseActive) return;
    this.submitted = true;
    const { name } = getTelegramUser();
    void submitScore({
      player: name, gold: Math.floor(this.stats.sat), enemies: this.stats.kills,
      round: this.block, max_combo: this.stats.maxCombo, time: Math.floor(this.stats.time), mode: this.mode.id,
    });
  }

  /* ------------------------- spawning ------------------------- */

  private getBullet(): Bullet {
    let b = this.bullets.find((x) => !x.on);
    if (!b) { b = { on: false, x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 0, foe: false }; this.bullets.push(b); }
    b.on = true; return b;
  }
  private getEnemy(): Enemy {
    let e = this.foes.find((x) => !x.on);
    if (!e) { e = { on: false, kind: "bear", x: 0, y: 0, vx: 0, hp: 10, maxHp: 10, r: 14, t: 0, fireT: 0, sat: 5 }; this.foes.push(e); }
    e.on = true; return e;
  }
  private getDrop(): Pickup {
    let p = this.drops.find((x) => !x.on);
    if (!p) { p = { on: false, kind: "sat", x: 0, y: 0, vy: 60, t: 0 }; this.drops.push(p); }
    p.on = true; return p;
  }
  private burst(x: number, y: number, c: string, n: number, spd = 160) {
    for (let i = 0; i < n; i++) {
      let p = this.parts.find((q) => !q.on);
      if (!p) { if (this.parts.length > 400) break; p = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, max: 1, c, s: 3 }; this.parts.push(p); }
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.7);
      Object.assign(p, { on: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, max: 0.4 + Math.random() * 0.4, c, s: 2 + Math.random() * 3 });
    }
  }
  private float(x: number, y: number, txt: string, c: string) {
    let f = this.floats.find((q) => !q.on);
    if (!f) { f = { on: false, x: 0, y: 0, t: 0, txt: "", c: "" }; this.floats.push(f); }
    Object.assign(f, { on: true, x, y, t: 0, txt, c });
  }
  private setBanner(txt: string, c: string) { this.banner = { txt, t: 2.2, c }; }

  private spawnEnemy() {
    const diff = 1 + this.block * 0.12;
    const isWhale = this.block % this.mode.bossEvery === 0 && this.killsThisBlock === 0 && !this.foes.some((f) => f.on && f.kind === "whale");
    const e = this.getEnemy();
    if (isWhale) {
      const hp = 260 * diff * (this.mode.id === "bossrush" ? 1.2 : 1);
      Object.assign(e, { kind: "whale" as const, x: LOGICAL_W / 2, y: -60, vx: 0, hp, maxHp: hp, r: 42, t: 0, fireT: 1.5, sat: 120 * diff });
      this.setBanner("WHALE INCOMING", PAL.purple);
      this.sfx.boss(); haptic("heavy");
    } else {
      const fud = Math.random() < 0.35;
      const hp = (fud ? 22 : 30) * diff;
      Object.assign(e, {
        kind: fud ? ("fud" as const) : ("bear" as const),
        x: 30 + Math.random() * (LOGICAL_W - 60), y: -30,
        vx: (Math.random() - 0.5) * 60,
        hp, maxHp: hp, r: fud ? 12 : 15, t: Math.random() * 6, fireT: 1 + Math.random() * 2, sat: (fud ? 4 : 6) * diff,
      });
    }
  }

  /* ------------------------- update ------------------------- */

  private clampPlayer() {
    this.player.x = Math.max(14, Math.min(LOGICAL_W - 14, this.player.x));
    this.player.y = Math.max(LOGICAL_H * 0.3, Math.min(LOGICAL_H - 30, this.player.y));
  }

  private update(dt: number) {
    this.sfx.tickMusic(dt, this.screen === "play");
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    for (const p of this.parts) if (p.on) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.max) p.on = false; }
    for (const f of this.floats) if (f.on) { f.t += dt; f.y -= 40 * dt; if (f.t > 0.9) f.on = false; }
    if (this.screen !== "play") return;

    const p = this.player;
    this.stats.time += dt;
    if (p.inv > 0) p.inv -= dt;

    // movement (keys)
    let mx = 0, my = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) my -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) my += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) mx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) mx += 1;
    if (mx || my) {
      const l = Math.hypot(mx, my);
      p.x += (mx / l) * p.speed * dt; p.y += (my / l) * p.speed * dt;
      this.clampPlayer();
    }

    // combo decay
    if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // auto fire
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = 1 / p.fireRate;
      const n = p.spread;
      for (let i = 0; i < n; i++) {
        const b = this.getBullet();
        const off = (i - (n - 1) / 2) * 40;
        Object.assign(b, { x: p.x + (i - (n - 1) / 2) * 8, y: p.y - 14, vx: off, vy: -520, r: 3, dmg: p.dmg, foe: false });
      }
      this.sfx.shoot();
    }

    // spawning
    this.spawnT -= dt;
    const alive = this.foes.reduce((a, f) => a + (f.on ? 1 : 0), 0);
    const needQuota = this.killsThisBlock + alive < this.quota;
    if (this.spawnT <= 0 && (needQuota || this.foes.some((f) => f.on))) {
      if (needQuota) this.spawnEnemy();
      this.spawnT = Math.max(0.35, 1.1 - this.block * 0.05);
    }

    // bullets
    for (const b of this.bullets) if (b.on) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.y > LOGICAL_H + 20 || b.x < -20 || b.x > LOGICAL_W + 20) { b.on = false; continue; }
      if (b.foe) {
        if (p.inv <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
          b.on = false; this.damagePlayer();
        }
      } else {
        for (const e of this.foes) if (e.on && Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          b.on = false;
          e.hp -= b.dmg;
          this.burst(b.x, b.y, PAL.white, 3, 90);
          this.sfx.hit();
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
    }

    // enemies
    for (const e of this.foes) if (e.on) {
      e.t += dt;
      if (e.kind === "whale") {
        if (e.y < 110) e.y += 60 * dt;
        else e.x = LOGICAL_W / 2 + Math.sin(e.t * 0.7) * (LOGICAL_W / 2 - 60);
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > 0) {
          e.fireT = 1.6;
          const n = 10;
          for (let i = 0; i < n; i++) {
            const b = this.getBullet();
            const a = (i / n) * Math.PI * 2 + e.t;
            Object.assign(b, { x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 5, dmg: 0, foe: true });
          }
        }
      } else {
        e.y += (e.kind === "bear" ? 70 : 90) * (1 + this.block * 0.04) * dt;
        e.x += (e.kind === "fud" ? Math.sin(e.t * 3) * 90 : e.vx) * dt;
        if (e.x < 16 || e.x > LOGICAL_W - 16) e.vx *= -1;
        if (e.y > LOGICAL_H + 30) { e.on = false; continue; }
        if (e.kind === "fud") {
          e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT = 2.2;
            const b = this.getBullet();
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            Object.assign(b, { x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 4, dmg: 0, foe: true });
          }
        }
      }
      if (p.inv <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        if (e.kind !== "whale") { e.on = false; this.burst(e.x, e.y, PAL.red, 10); }
        this.damagePlayer();
      }
    }

    // pickups
    for (const d of this.drops) if (d.on) {
      d.t += dt; d.y += d.vy * dt;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist < 70) { d.x += ((p.x - d.x) / Math.max(1, dist)) * 220 * dt; d.y += ((p.y - d.y) / Math.max(1, dist)) * 220 * dt; }
      if (dist < p.r + 8) {
        d.on = false;
        if (d.kind === "sat") {
          const mult = 1 + this.combo * 0.1;
          const v = Math.floor(5 * mult * (1 + this.block * 0.1));
          this.stats.sat += v;
          this.float(p.x, p.y - 18, `+${v} SAT`, PAL.gold);
          this.sfx.pickup(); haptic("light");
        } else if (this.mode.id !== "hardcore") {
          p.hp = Math.min(p.maxHp, p.hp + 20);
          this.float(p.x, p.y - 18, "+20 HP", PAL.green);
          this.sfx.pickup();
        }
      }
      if (d.y > LOGICAL_H + 20) d.on = false;
    }

    // block complete?
    if (this.killsThisBlock >= this.quota && !this.foes.some((f) => f.on && f.kind === "whale")) {
      this.nextBlock();
    }
  }

  private damagePlayer() {
    const p = this.player;
    p.hp -= 20;
    p.inv = 0.8;
    this.combo = 0;
    this.shake = 8;
    this.burst(p.x, p.y, PAL.red, 12);
    this.sfx.hurt(); haptic("medium");
    if (p.hp <= 0) { p.hp = 0; this.loseRun(); }
  }

  private killEnemy(e: Enemy) {
    e.on = false;
    this.killsThisBlock++;
    this.stats.kills++;
    this.combo++;
    this.comboT = 3;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    if (this.combo === 10) { this.setBanner("BULL RUN ×2", PAL.gold); this.sfx.bullrun(); haptic("success"); }
    this.burst(e.x, e.y, e.kind === "whale" ? PAL.purple : PAL.red, e.kind === "whale" ? 40 : 14, e.kind === "whale" ? 260 : 150);
    this.sfx.kill(); haptic("light");
    this.shake = Math.max(this.shake, e.kind === "whale" ? 10 : 3);
    // drops
    const satN = e.kind === "whale" ? 14 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < satN; i++) {
      const d = this.getDrop();
      Object.assign(d, { kind: "sat" as const, x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 20, vy: 60, t: 0 });
    }
    if (Math.random() < (e.kind === "whale" ? 1 : 0.06)) {
      const d = this.getDrop();
      Object.assign(d, { kind: "heart" as const, x: e.x, y: e.y, vy: 55, t: 0 });
    }
    if (e.kind === "whale") {
      const mult = 1 + this.combo * 0.1;
      this.stats.sat += Math.floor(e.sat * mult);
      this.setBanner("WHALE REKT", PAL.gold);
      haptic("heavy");
    }
  }

  /* ------------------------- shop ------------------------- */

  private shopItems(): { id: string; label: string; sub: string; cost: number; apply: () => void }[] {
    const p = this.player;
    return [
      { id: "dmg", label: "+ DAMAGE", sub: `${p.dmg} → ${p.dmg + 6}`, apply: () => { p.dmg += 6; } },
      { id: "rate", label: "+ FIRE RATE", sub: `${p.fireRate.toFixed(1)}/s → ${(p.fireRate + 1.5).toFixed(1)}/s`, cost: 0, apply: () => { p.fireRate += 1.5; } },
      { id: "hp", label: "+ MAX HP", sub: `+40 & heal 40`, cost: 0, apply: () => { p.maxHp += 40; p.hp = Math.min(p.maxHp, p.hp + 40); } },
      { id: "spd", label: "+ SPEED", sub: "+40", cost: 0, apply: () => { p.speed += 40; } },
      { id: "sprd", label: "+ SPREAD", sub: "+1 projectile", cost: 0, apply: () => { p.spread += 1; } },
    ].map((it, i) => ({ ...it, cost: [60, 80, 70, 50, 120][i] + this.block * 10 }));
  }

  /* ------------------------- buttons ------------------------- */

  private btn(id: string, x: number, y: number, w: number, h: number, label: string, sub?: string, disabled = false): Btn {
    const b = { id, x, y, w, h, label, sub, disabled };
    this.btns.push(b);
    return b;
  }

  private hitButtons(x: number, y: number) {
    for (const b of this.btns) {
      if (b.disabled) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.onButton(b.id); return; }
    }
  }

  private onButton(id: string) {
    this.sfx.unlock(); this.sfx.ui(); haptic("light");
    if (id === "play") { this.screen = "modes"; return; }
    if (id === "ranks") { this.ranks = null; this.screen = "ranks"; void fetchGlobalLeaderboard(10).then((r) => { this.ranks = r; }); return; }
    if (id.startsWith("mode:")) { this.startRun(MODES.find((m) => m.id === id.slice(5))!); return; }
    if (id === "pause") { this.togglePause(); return; }
    if (id === "resume") { this.togglePause(); return; }
    if (id === "quit") { this.screen = "title"; return; }
    if (id === "mute") { this.sfx.toggleMute(); return; }
    if (id === "again") { this.startRun(this.mode); return; }
    if (id === "home") { this.screen = "title"; return; }
    if (id === "share") { shareScore(Math.floor(this.stats.sat), this.block); return; }
    if (id === "shopgo") { this.screen = "play"; this.setBanner(`BLOCK ${this.block}`, PAL.ton); return; }
    if (id.startsWith("buy:")) {
      const it = this.shopItems().find((i) => i.id === id.slice(4));
      if (it && this.stats.sat >= it.cost) {
        this.stats.sat -= it.cost; it.apply(); haptic("success");
      }
      return;
    }
  }

  /* ------------------------- render ------------------------- */

  private px(n: number) { return Math.round(n) + 0.5; }

  private drawBtn(c: CanvasRenderingContext2D, b: Btn) {
    const { x, y, w, h } = b;
    c.fillStyle = b.disabled ? "#0A0918" : PAL.panel;
    c.fillRect(x, y, w, h);
    // pixel 3D bevel
    c.fillStyle = b.disabled ? "#222040" : PAL.ton;
    c.fillRect(x, y, w, 3); c.fillRect(x, y, 3, h);
    c.fillStyle = b.disabled ? "#050410" : PAL.tonDark;
    c.fillRect(x, y + h - 3, w, 3); c.fillRect(x + w - 3, y, 3, h);
    c.fillStyle = b.disabled ? PAL.dim : PAL.white;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "bold 15px monospace";
    c.fillText(b.label, x + w / 2, y + h / 2 - (b.sub ? 8 : 0));
    if (b.sub) {
      c.font = "11px monospace";
      c.fillStyle = PAL.dim;
      c.fillText(b.sub, x + w / 2, y + h / 2 + 10);
    }
  }

  private text(c: CanvasRenderingContext2D, txt: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = "center", bold = true) {
    c.font = `${bold ? "bold " : ""}${size}px monospace`;
    c.textAlign = align; c.textBaseline = "middle";
    c.fillStyle = col;
    c.fillText(txt, x, y);
  }

  private render() {
    const c = this.ctx;
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // bg + grid
    c.fillStyle = PAL.bg;
    c.fillRect(-20, -20, LOGICAL_W + 40, LOGICAL_H + 40);
    c.strokeStyle = PAL.bgGrid; c.lineWidth = 1;
    for (let x = 0; x <= LOGICAL_W; x += 42) { c.beginPath(); c.moveTo(this.px(x), 0); c.lineTo(this.px(x), LOGICAL_H); c.stroke(); }
    for (let y = 0; y <= LOGICAL_H; y += 42) { c.beginPath(); c.moveTo(0, this.px(y)); c.lineTo(LOGICAL_W, this.px(y)); c.stroke(); }

    this.btns = [];

    if (this.screen === "play" || this.screen === "pause" || this.screen === "shop") this.renderWorld(c);

    if (this.screen === "title") this.renderTitle(c);
    else if (this.screen === "modes") this.renderModes(c);
    else if (this.screen === "shop") this.renderShop(c);
    else if (this.screen === "pause") this.renderPause(c);
    else if (this.screen === "over") this.renderOver(c, false);
    else if (this.screen === "win") this.renderOver(c, true);
    else if (this.screen === "ranks") this.renderRanks(c);

    // banner
    if (this.banner.t > 0) {
      const a = Math.min(1, this.banner.t / 0.4);
      c.globalAlpha = a;
      this.text(c, this.banner.txt, LOGICAL_W / 2, LOGICAL_H * 0.35, 30, this.banner.c);
      c.globalAlpha = 1;
    }
    // floats
    for (const f of this.floats) if (f.on) {
      c.globalAlpha = 1 - f.t / 0.9;
      this.text(c, f.txt, f.x, f.y, 12, f.c);
      c.globalAlpha = 1;
    }

    for (const b of this.btns) this.drawBtn(c, b);

    // scanlines
    c.globalAlpha = 0.06;
    c.fillStyle = "#000";
    for (let y = 0; y < LOGICAL_H; y += 3) c.fillRect(0, y, LOGICAL_W, 1);
    c.globalAlpha = 1;
    c.restore();
  }

  private renderWorld(c: CanvasRenderingContext2D) {
    const p = this.player;
    // drops
    for (const d of this.drops) if (d.on) {
      if (d.kind === "sat") {
        c.fillStyle = PAL.gold;
        c.fillRect(d.x - 4, d.y - 4, 8, 8);
        c.fillStyle = "#FFF3C4";
        c.fillRect(d.x - 2, d.y - 2, 3, 3);
      } else {
        c.fillStyle = PAL.green;
        c.fillRect(d.x - 5, d.y - 2, 10, 4); c.fillRect(d.x - 2, d.y - 5, 4, 10);
      }
    }
    // foes
    for (const e of this.foes) if (e.on) {
      if (e.kind === "whale") {
        c.fillStyle = PAL.purple;
        c.fillRect(e.x - 42, e.y - 26, 84, 52);
        c.fillStyle = "#C9B6FF";
        c.fillRect(e.x - 42, e.y - 26, 84, 6);
        c.fillStyle = PAL.bg;
        c.fillRect(e.x - 18, e.y - 8, 10, 10); c.fillRect(e.x + 8, e.y - 8, 10, 10);
        // hp bar
        c.fillStyle = "#33245E"; c.fillRect(20, 66, LOGICAL_W - 40, 10);
        c.fillStyle = PAL.purple; c.fillRect(20, 66, (LOGICAL_W - 40) * Math.max(0, e.hp / e.maxHp), 10);
        this.text(c, "WHALE", LOGICAL_W / 2, 58, 11, PAL.purple);
      } else {
        c.fillStyle = e.kind === "bear" ? PAL.red : PAL.purple;
        c.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(e.x - e.r, e.y - e.r, e.r * 2, 3);
        c.fillStyle = PAL.bg;
        c.fillRect(e.x - e.r / 2, e.y - e.r / 3, 4, 4); c.fillRect(e.x + e.r / 2 - 4, e.y - e.r / 3, 4, 4);
      }
    }
    // bullets
    for (const b of this.bullets) if (b.on) {
      c.fillStyle = b.foe ? "#FF9F43" : PAL.ton;
      c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2 + (b.foe ? 0 : 4));
    }
    // particles
    for (const pt of this.parts) if (pt.on) {
      c.globalAlpha = 1 - pt.t / pt.max;
      c.fillStyle = pt.c;
      c.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s);
      c.globalAlpha = 1;
    }
    // player (rocket)
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) c.globalAlpha = 0.4;
    c.fillStyle = PAL.ton;
    c.beginPath();
    c.moveTo(p.x, p.y - 14); c.lineTo(p.x - 10, p.y + 10); c.lineTo(p.x + 10, p.y + 10); c.closePath(); c.fill();
    c.fillStyle = PAL.gold;
    c.fillRect(p.x - 3, p.y + 10, 6, 6 + Math.random() * 5);
    c.globalAlpha = 1;

    // HUD
    c.fillStyle = "rgba(13,11,30,0.85)";
    c.fillRect(0, 0, LOGICAL_W, 46);
    const hpw = 130;
    c.fillStyle = "#3A0E18"; c.fillRect(12, 10, hpw, 10);
    c.fillStyle = this.mode.id === "hardcore" ? PAL.red : PAL.green;
    c.fillRect(12, 10, hpw * Math.max(0, p.hp / p.maxHp), 10);
    this.text(c, `${Math.ceil(p.hp)}/${p.maxHp}`, 12 + hpw / 2, 15, 9, PAL.white);
    this.text(c, `BLOCK ${this.block}`, 12, 36, 11, PAL.ton, "left");
    this.text(c, `${this.killsThisBlock}/${this.quota}`, 110, 36, 11, PAL.dim, "left");
    this.text(c, `${Math.floor(this.stats.sat)} SAT`, LOGICAL_W - 12, 15, 13, PAL.gold, "right");
    if (this.combo >= 2) this.text(c, `COMBO ×${this.combo}`, LOGICAL_W - 12, 36, 11, this.combo >= 10 ? PAL.gold : PAL.white, "right");
    this.btn("pause", LOGICAL_W - 44, 52, 34, 30, "❚❚");
  }

  private renderTitle(c: CanvasRenderingContext2D) {
    this.text(c, "HODL", LOGICAL_W / 2, 180, 56, PAL.ton);
    this.text(c, "HEROES", LOGICAL_W / 2, 236, 56, PAL.gold);
    this.text(c, "· MOON OR REKT ·", LOGICAL_W / 2, 285, 14, PAL.dim);
    const { name } = getTelegramUser();
    this.text(c, `gm, ${name}`, LOGICAL_W / 2, 330, 13, PAL.white);
    this.text(c, isSupabaseActive ? "🟢 GLOBAL LIVE" : "🟡 LOCAL ONLY", LOGICAL_W / 2, 356, 12, isSupabaseActive ? PAL.green : PAL.gold);
    this.btn("play", 70, 420, LOGICAL_W - 140, 54, "▶ PLAY", "Space works too");
    this.btn("ranks", 70, 492, LOGICAL_W - 140, 54, "🏆 LEADERBOARD");
    this.btn("mute", 70, 564, LOGICAL_W - 140, 44, this.sfx.muted ? "🔇 SOUND OFF" : "🔊 SOUND ON");
    this.text(c, "drag or WASD to dodge · auto-fire", LOGICAL_W / 2, 660, 11, PAL.dim);
    this.text(c, "v2.0 · rebuilt edition", LOGICAL_W / 2, 700, 10, PAL.dim, "center", false);
  }

  private renderModes(c: CanvasRenderingContext2D) {
    this.text(c, "CHOOSE YOUR MARKET", LOGICAL_W / 2, 90, 20, PAL.white);
    MODES.forEach((m, i) => {
      const best = this.best[m.id];
      this.btn(`mode:${m.id}`, 50, 140 + i * 92, LOGICAL_W - 100, 78, m.name, `${m.blurb}${best ? ` · best ${best} SAT` : ""}`);
    });
    this.btn("home", 50, 640, LOGICAL_W - 100, 46, "← BACK");
  }

  private renderShop(c: CanvasRenderingContext2D) {
    c.fillStyle = "rgba(13,11,30,0.92)";
    c.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.text(c, "BLOCK CLEARED", LOGICAL_W / 2, 80, 22, PAL.green);
    this.text(c, `${Math.floor(this.stats.sat)} SAT to spend`, LOGICAL_W / 2, 116, 14, PAL.gold);
    this.shopItems().forEach((it, i) => {
      const afford = this.stats.sat >= it.cost;
      this.btn(`buy:${it.id}`, 50, 160 + i * 74, LOGICAL_W - 100, 62, `${it.label} — ${it.cost} SAT`, it.sub, !afford);
    });
    this.btn("shopgo", 50, 560, LOGICAL_W - 100, 52, `START BLOCK ${this.block} →`);
  }

  private renderPause(c: CanvasRenderingContext2D) {
    c.fillStyle = "rgba(13,11,30,0.85)";
    c.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.text(c, "PAUSED", LOGICAL_W / 2, 240, 30, PAL.white);
    this.btn("resume", 70, 320, LOGICAL_W - 140, 52, "▶ RESUME", "P / Esc");
    this.btn("mute", 70, 388, LOGICAL_W - 140, 46, this.sfx.muted ? "🔇 SOUND OFF" : "🔊 SOUND ON");
    this.btn("quit", 70, 450, LOGICAL_W - 140, 46, "✕ QUIT TO TITLE");
  }

  private renderOver(c: CanvasRenderingContext2D, won: boolean) {
    c.fillStyle = PAL.bg;
    c.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.text(c, won ? "MOONED 🚀" : "REKT 💀", LOGICAL_W / 2, 150, 44, won ? PAL.green : PAL.red);
    this.text(c, won ? "YOU OUTLASTED THE MARKET" : this.overReason, LOGICAL_W / 2, 200, 12, PAL.dim);
    const rows: [string, string][] = [
      ["SAT STACKED", `${Math.floor(this.stats.sat)}`],
      ["ENEMIES REKT", `${this.stats.kills}`],
      ["BLOCK REACHED", `${this.block}`],
      ["MAX COMBO", `×${this.stats.maxCombo}`],
      ["TIME", `${Math.floor(this.stats.time / 60)}:${String(Math.floor(this.stats.time % 60)).padStart(2, "0")}`],
      ["MODE", this.mode.name],
    ];
    rows.forEach(([k, v], i) => {
      this.text(c, k, 80, 260 + i * 34, 13, PAL.dim, "left");
      this.text(c, v, LOGICAL_W - 80, 260 + i * 34, 13, PAL.white, "right");
    });
    this.text(c, this.submitted ? "score submitted to global board" : "submitting…", LOGICAL_W / 2, 478, 10, PAL.green, "center", false);
    this.btn("share", 70, 510, LOGICAL_W - 140, 48, "📤 SHARE SCORE");
    this.btn("again", 70, 572, LOGICAL_W - 140, 48, "↻ RUN IT BACK");
    this.btn("home", 70, 634, LOGICAL_W - 140, 48, "TITLE SCREEN");
  }

  private renderRanks(c: CanvasRenderingContext2D) {
    this.text(c, "🏆 GLOBAL LEADERBOARD", LOGICAL_W / 2, 70, 18, PAL.gold);
    if (!this.ranks) {
      this.text(c, "loading…", LOGICAL_W / 2, 300, 14, PAL.dim);
    } else if (this.ranks.length === 0) {
      this.text(c, "no scores yet — be the first", LOGICAL_W / 2, 300, 13, PAL.dim);
    } else {
      this.ranks.slice(0, 10).forEach((r, i) => {
        const y = 120 + i * 44;
        c.fillStyle = i % 2 ? "rgba(255,255,255,0.03)" : "transparent";
        c.fillRect(24, y - 18, LOGICAL_W - 48, 38);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        this.text(c, medal, 40, y, 13, PAL.white, "left");
        this.text(c, r.player, 84, y, 13, PAL.white, "left");
        this.text(c, r.mode, 84, y + 14, 9, PAL.dim, "left", false);
        this.text(c, `${r.gold} SAT`, LOGICAL_W - 40, y, 13, PAL.gold, "right");
      });
    }
    this.btn("home", 50, 640, LOGICAL_W - 100, 46, "← BACK");
  }

  /* probe for scripts/verify-game.mjs (W = forward/up = +z, D = +x) */
  probe() { return { x: this.player.x, y: this.player.y, z: -this.player.y }; }
}
