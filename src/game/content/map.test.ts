import { describe, expect, it } from "vitest";
import { collidesForMovement, collidesForProjectile } from "./map";

describe("map collision semantics", () => {
  it("blocks grounded entities on ponds while allowing flying PvE to cross", () => {
    expect(collidesForMovement({ kind: "player" }, 340, 720, 17)).toBe(true);
    expect(collidesForMovement({ kind: "bot" }, 340, 720, 17)).toBe(true);
    expect(collidesForMovement({ kind: "pve", pveType: "slime" }, 340, 720, 20)).toBe(true);
    expect(collidesForMovement({ kind: "pve", pveType: "bat" }, 340, 720, 18)).toBe(false);
  });

  it("lets bullets cross ponds but blocks them on foliage and solid cover", () => {
    expect(collidesForProjectile(340, 720, 5)).toBe(false);
    expect(collidesForProjectile(125, 520, 5)).toBe(true);
    expect(collidesForProjectile(710, 390, 5)).toBe(true);
  });

  it("lets fighters move through foliage but not solid cover", () => {
    expect(collidesForMovement({ kind: "player" }, 125, 520, 17)).toBe(false);
    expect(collidesForMovement({ kind: "player" }, 710, 390, 17)).toBe(true);
  });
});
