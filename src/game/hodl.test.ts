import { afterEach, describe, expect, it, vi } from "vitest";
import { HodlGame, LOGICAL_H, LOGICAL_W, MODES } from "./hodl";

vi.mock("../lib/supabase", () => ({
  isSupabaseActive: true,
  submitScore: vi.fn(async () => true),
  fetchGlobalLeaderboard: vi.fn(async () => []),
}));

import { submitScore } from "../lib/supabase";

interface Exposed {
  startRun(mode: (typeof MODES)[number]): void;
  update(dt: number): void;
  block: number;
  quota: number;
  killsThisBlock: number;
  foes: Array<{ on: boolean; kind: string }>;
  player: { hp: number; maxHp: number };
  overReason: string;
  damagePlayer(): void;
}

const games: HodlGame[] = [];

function expose(game: HodlGame): Exposed {
  return game as unknown as Exposed;
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    style: {},
    width: LOGICAL_W,
    height: LOGICAL_H,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: LOGICAL_W,
        bottom: LOGICAL_H,
        width: LOGICAL_W,
        height: LOGICAL_H,
        toJSON() {
          return {};
        },
      };
    },
  } as unknown as HTMLCanvasElement;
}

function makeGame(): HodlGame {
  const game = new HodlGame(fakeCanvas(), {} as CanvasRenderingContext2D);
  games.push(game);
  return game;
}

function clearCurrentBlock(game: HodlGame): void {
  const open = expose(game);
  game.screen = "play";
  open.killsThisBlock = open.quota;
  open.foes = [];
  open.update(1 / 60);
}

afterEach(() => {
  for (const game of games) game.dispose();
  games.length = 0;
  vi.clearAllMocks();
});

describe("HodlGame run flow", () => {
  it("submits the cleared block when boss rush is won", () => {
    const mode = MODES.find((m) => m.id === "bossrush");
    if (!mode || mode.winBlocks == null) throw new Error("boss rush mode missing");
    const game = makeGame();
    expose(game).startRun(mode);

    let clears = 0;
    while (game.screen !== "win") {
      clearCurrentBlock(game);
      clears += 1;
      if (clears > mode.winBlocks) break;
    }

    expect(clears).toBe(mode.winBlocks);
    expect(game.screen).toBe("win");
    expect(expose(game).block).toBe(mode.winBlocks);
    expect(submitScore).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "bossrush", round: mode.winBlocks, player: "Player" }),
    );
  });

  it("opens the shop and heals after a roguelike block, and does neither in survival", () => {
    const rogue = MODES.find((m) => m.id === "roguelike");
    const survival = MODES.find((m) => m.id === "survival");
    if (!rogue || !survival) throw new Error("modes missing");

    const shopRun = makeGame();
    expose(shopRun).startRun(rogue);
    expose(shopRun).player.hp = 100;
    clearCurrentBlock(shopRun);
    expect(shopRun.screen).toBe("shop");
    expect(expose(shopRun).block).toBe(2);
    expect(expose(shopRun).player.hp).toBe(130);

    const endless = makeGame();
    expose(endless).startRun(survival);
    expose(endless).player.hp = 50;
    clearCurrentBlock(endless);
    expect(endless.screen).toBe("play");
    expect(expose(endless).block).toBe(2);
    expect(expose(endless).player.hp).toBe(50);
    expect(submitScore).not.toHaveBeenCalled();
  });

  it("liquidates hardcore on one hit and only chips a roguelike run", () => {
    const hardcore = MODES.find((m) => m.id === "hardcore");
    const rogue = MODES.find((m) => m.id === "roguelike");
    if (!hardcore || !rogue) throw new Error("modes missing");

    const hard = makeGame();
    expose(hard).startRun(hardcore);
    expose(hard).damagePlayer();
    expect(hard.screen).toBe("over");
    expect(expose(hard).player.hp).toBe(0);
    expect(expose(hard).overReason).toBe("ONE HIT. THAT'S THE RULE.");
    expect(submitScore).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "hardcore", round: 1 }),
    );

    const normal = makeGame();
    expose(normal).startRun(rogue);
    expose(normal).damagePlayer();
    expect(normal.screen).toBe("play");
    expect(expose(normal).player.hp).toBe(rogue.hp - 20);
  });
});
