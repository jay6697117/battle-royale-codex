import { describe, expect, it } from "vitest";
import { MAP_FEATURES, collidesForMovement, collidesForProjectile } from "./map";

describe("map collision semantics", () => {
  it("blocks grounded entities on ponds while allowing flying PvE to cross", () => {
    expect(collidesForMovement({ kind: "player" }, 340, 720, 17)).toBe(true);
    expect(collidesForMovement({ kind: "bot" }, 340, 720, 17)).toBe(true);
    expect(collidesForMovement({ kind: "pve", pveType: "slime" }, 340, 720, 20)).toBe(true);
    expect(collidesForMovement({ kind: "pve", pveType: "bat" }, 340, 720, 18)).toBe(false);
  });

  it("keeps pond collision aligned to the visible L-shaped water", () => {
    expect(collidesForMovement({ kind: "player" }, 340, 720, 17)).toBe(true);
    expect(collidesForMovement({ kind: "player" }, 520, 760, 17)).toBe(false);
    expect(collidesForMovement({ kind: "player" }, 500, 880, 17)).toBe(true);
    expect(collidesForMovement({ kind: "player" }, 1320, 280, 17)).toBe(false);
  });

  it("lets bullets cross ponds and foliage but blocks them on solid cover", () => {
    expect(collidesForProjectile(340, 720, 5)).toBe(false);
    expect(collidesForProjectile(125, 520, 5)).toBe(false);
    expect(collidesForProjectile(710, 390, 5)).toBe(true);
  });

  it("lets fighters move through foliage but not solid cover", () => {
    expect(collidesForMovement({ kind: "player" }, 125, 520, 17)).toBe(false);
    expect(collidesForMovement({ kind: "player" }, 710, 390, 17)).toBe(true);
  });

  it("blocks fighters and bullets on every visible crate and chest", () => {
    const solidProps = MAP_FEATURES.filter((feature) => feature.kind === "crate" || feature.kind === "chest");

    expect(solidProps.length).toBeGreaterThan(0);
    for (const prop of solidProps) {
      const centerX = prop.x + prop.width / 2;
      const centerY = prop.y + prop.height / 2;
      expect(collidesForMovement({ kind: "player" }, centerX, centerY, 17)).toBe(true);
      expect(collidesForProjectile(centerX, centerY, 5)).toBe(true);
    }
  });
});
