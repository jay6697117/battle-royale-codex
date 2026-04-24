export interface StormVisualPoint {
  x: number;
  y: number;
}

export interface StormEdgePointOptions {
  centerX: number;
  centerY: number;
  radius: number;
  count: number;
  seedOffset: number;
  timeMs: number;
}

export interface StormLightningBranchOptions {
  centerX: number;
  centerY: number;
  radius: number;
  count: number;
  timeMs: number;
}

export const STORM_EDGE_PROFILE = {
  edgePointCount: 84,
  branchCount: 10,
  spriteCount: 10,
  outsideFillColor: 0x3b1171,
  outsideFillAlpha: 0.28,
  outsideTextureAlpha: 0.16,
  outerAuraWidth: 46,
  midAuraWidth: 24,
  brightAuraWidth: 10,
  coreWidth: 4,
  traceWidth: 1.5
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stormJitter = (sampleIndex: number, timeMs: number, seedOffset: number) => {
  const step = Math.floor(timeMs / 165);
  const raw =
    Math.sin(sampleIndex * 10.9898 + step * 0.62 + seedOffset) * 8 +
    Math.sin(sampleIndex * 3.71 + step * 0.94 + seedOffset * 0.7) * 5 +
    Math.sin(sampleIndex * 1.47 + step * 0.28 + seedOffset * 1.9) * 2;

  return clamp(raw, -14.5, 14.5);
};

export const distanceFromCenter = (point: StormVisualPoint, centerX: number, centerY: number) =>
  Math.hypot(point.x - centerX, point.y - centerY);

export const buildStormEdgePoints = ({
  centerX,
  centerY,
  radius,
  count,
  seedOffset,
  timeMs
}: StormEdgePointOptions): StormVisualPoint[] => {
  const points: StormVisualPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const jitteredRadius = radius + stormJitter(index, timeMs, seedOffset);
    points.push({
      x: centerX + Math.cos(angle) * jitteredRadius,
      y: centerY + Math.sin(angle) * jitteredRadius
    });
  }

  if (points[0]) {
    points.push({ ...points[0] });
  }

  return points;
};

export const buildStormLightningBranches = ({
  centerX,
  centerY,
  radius,
  count,
  timeMs
}: StormLightningBranchOptions): StormVisualPoint[][] => {
  const branches: StormVisualPoint[][] = [];

  for (let index = 0; index < count; index += 1) {
    const baseAngle =
      (index / count) * Math.PI * 2 +
      Math.sin(timeMs / 1_240 + index * 1.17) * 0.024 +
      Math.sin(timeMs / 760 + index * 0.41) * 0.016;
    const startRadius = radius - 4 + clamp(Math.sin(index * 9.13 + timeMs / 260) * 4, -4, 4);
    const branchLength = 12 + (Math.sin(index * 5.47 + timeMs / 360) + 1) * 8;
    const bend = Math.sin(index * 3.91 + timeMs / 310) * 0.06;

    branches.push([
      pointOnCircle(centerX, centerY, baseAngle, startRadius),
      pointOnCircle(centerX, centerY, baseAngle + bend, startRadius + branchLength * 0.34),
      pointOnCircle(centerX, centerY, baseAngle - bend * 0.65, startRadius + branchLength * 0.68),
      pointOnCircle(centerX, centerY, baseAngle + bend * 0.45, startRadius + branchLength)
    ]);
  }

  return branches;
};

const pointOnCircle = (centerX: number, centerY: number, angle: number, radius: number): StormVisualPoint => ({
  x: centerX + Math.cos(angle) * radius,
  y: centerY + Math.sin(angle) * radius
});
