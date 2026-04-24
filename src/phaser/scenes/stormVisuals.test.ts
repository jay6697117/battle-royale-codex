import { describe, expect, it } from "vitest";
import {
  STORM_EDGE_PROFILE,
  buildStormEdgePoints,
  buildStormLightningBranches,
  distanceFromCenter
} from "./stormVisuals";

describe("storm visuals", () => {
  it("builds a closed jittered ring for the electric wall", () => {
    const points = buildStormEdgePoints({
      centerX: 960,
      centerY: 540,
      radius: 900,
      count: 72,
      seedOffset: 0,
      timeMs: 1_234
    });

    expect(points).toHaveLength(73);
    expect(points[0]).toEqual(points.at(-1));

    const distances = points.slice(0, -1).map((point) => distanceFromCenter(point, 960, 540));
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(878);
    expect(Math.max(...distances)).toBeLessThanOrEqual(922);
  });

  it("keeps the electric wall substantially thicker than a simple stroke", () => {
    expect(STORM_EDGE_PROFILE.outerAuraWidth).toBeGreaterThanOrEqual(52);
    expect(STORM_EDGE_PROFILE.midAuraWidth).toBeGreaterThanOrEqual(24);
    expect(STORM_EDGE_PROFILE.coreWidth).toBeGreaterThanOrEqual(8);
    expect(STORM_EDGE_PROFILE.spriteCount).toBeGreaterThanOrEqual(20);
  });

  it("places lightning branches on the dangerous outside of the circle", () => {
    const branches = buildStormLightningBranches({
      centerX: 960,
      centerY: 540,
      radius: 900,
      count: 24,
      timeMs: 1_600
    });

    expect(branches).toHaveLength(24);
    for (const branch of branches) {
      expect(branch).toHaveLength(4);
      const start = distanceFromCenter(branch[0]!, 960, 540);
      const end = distanceFromCenter(branch.at(-1)!, 960, 540);
      expect(start).toBeGreaterThanOrEqual(892);
      expect(end).toBeGreaterThan(start + 18);
    }
  });
});
