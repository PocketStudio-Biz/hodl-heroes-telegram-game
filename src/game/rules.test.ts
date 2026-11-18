import { describe, expect, it } from "vitest";
import {
  blockAfterClear,
  hpAfterBlockClear,
  hpAfterHeart,
  hpAfterHit,
  satPickupValue,
  shopCost,
} from "./rules";

describe("run rules", () => {
  it("scales a SAT pickup with combo and block", () => {
    expect(satPickupValue(0, 1)).toBe(5);
    expect(satPickupValue(10, 1)).toBe(11);
    expect(satPickupValue(0, 10)).toBe(10);
    expect(satPickupValue(9, 4)).toBe(Math.floor(5 * 1.9 * 1.4));
  });

  it("raises shop prices as the block number climbs", () => {
    expect(shopCost(0, 1)).toBe(70);
    expect(shopCost(1, 1)).toBe(90);
    expect(shopCost(4, 3)).toBe(150);
  });

  it("chips 20 HP and never goes below zero", () => {
    expect(hpAfterHit(180)).toBe(160);
    expect(hpAfterHit(1)).toBe(0);
  });

  it("refuses heart heals in hardcore and caps them at max HP otherwise", () => {
    expect(hpAfterHeart(40, 180, "hardcore")).toBe(40);
    expect(hpAfterHeart(40, 180, "roguelike")).toBe(60);
    expect(hpAfterHeart(170, 180, "survival")).toBe(180);
  });

  it("heals 30 between blocks only when the mode allows it", () => {
    expect(hpAfterBlockClear(100, 180, true)).toBe(130);
    expect(hpAfterBlockClear(170, 180, true)).toBe(180);
    expect(hpAfterBlockClear(100, 180, false)).toBe(100);
  });

  it("wins on the block that was just cleared, not the next one", () => {
    expect(blockAfterClear(12, 12)).toEqual({ outcome: "win", block: 12 });
    expect(blockAfterClear(5, 5)).toEqual({ outcome: "win", block: 5 });
    expect(blockAfterClear(11, 12)).toEqual({ outcome: "advance", block: 12 });
    expect(blockAfterClear(4, null)).toEqual({ outcome: "advance", block: 5 });
  });
});
