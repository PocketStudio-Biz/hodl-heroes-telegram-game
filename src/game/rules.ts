/** Shop base prices, in button order: damage, fire rate, max HP, speed, spread. */
export const SHOP_BASE_COSTS = [60, 80, 70, 50, 120] as const;

export const HIT_DAMAGE = 20;
export const HEART_HEAL = 20;
export const BLOCK_HEAL = 30;

/** SAT gained from one coin pickup. Combo 10 is a 2× bull run. */
export function satPickupValue(combo: number, block: number): number {
  const mult = 1 + combo * 0.1;
  return Math.floor(5 * mult * (1 + block * 0.1));
}

export function shopCost(index: number, block: number): number {
  const base = SHOP_BASE_COSTS[index];
  if (base === undefined) throw new Error(`shop index ${index}`);
  return base + block * 10;
}

export function hpAfterHit(hp: number): number {
  return Math.max(0, hp - HIT_DAMAGE);
}

export function hpAfterHeart(hp: number, maxHp: number, modeId: string): number {
  if (modeId === "hardcore") return hp;
  return Math.min(maxHp, hp + HEART_HEAL);
}

export function hpAfterBlockClear(hp: number, maxHp: number, healBetween: boolean): number {
  if (!healBetween) return hp;
  return Math.min(maxHp, hp + BLOCK_HEAL);
}

/**
 * Result of clearing the block the player is currently on.
 * A finite mode wins on that block. Incrementing first made the win screen
 * and the submitted round report one block past the victory line.
 */
export function blockAfterClear(
  block: number,
  winBlocks: number | null,
): { outcome: "win" | "advance"; block: number } {
  if (winBlocks != null && block >= winBlocks) return { outcome: "win", block };
  return { outcome: "advance", block: block + 1 };
}
