export interface RectZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleZone {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface MapFeature {
  id: string;
  kind: "wall" | "bush" | "crate" | "barrel" | "water" | "ruin";
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const WORLD_CENTER_X = WORLD_WIDTH / 2;
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2;

export const OBSTACLES: RectZone[] = [
  { id: "west_ruin_1", x: 260, y: 420, width: 150, height: 48 },
  { id: "west_ruin_2", x: 300, y: 470, width: 48, height: 140 },
  { id: "south_wall", x: 485, y: 630, width: 250, height: 44 },
  { id: "center_wall", x: 690, y: 370, width: 170, height: 44 },
  { id: "east_wall", x: 1290, y: 420, width: 44, height: 178 },
  { id: "east_ruin", x: 1480, y: 690, width: 150, height: 50 },
  { id: "north_ruin", x: 1110, y: 70, width: 160, height: 56 },
  { id: "northeast_ruin", x: 1470, y: 150, width: 125, height: 58 },
  { id: "south_ruin", x: 1105, y: 835, width: 140, height: 50 },
  { id: "crate_stack", x: 1515, y: 930, width: 88, height: 70 }
];

export const WATER_ZONES: RectZone[] = [
  { id: "southwest_pond", x: 295, y: 660, width: 260, height: 235 },
  { id: "north_pond", x: 1110, y: 145, width: 230, height: 165 }
];

export const MAP_FEATURES: MapFeature[] = [
  ...OBSTACLES.map((zone) => ({
    ...zone,
    kind: zone.id.includes("crate") ? ("crate" as const) : ("wall" as const)
  })),
  ...WATER_ZONES.map((zone) => ({ ...zone, kind: "water" as const })),
  { id: "bush_west", kind: "bush", x: 105, y: 470, width: 130, height: 150 },
  { id: "bush_center", kind: "bush", x: 880, y: 210, width: 100, height: 135 },
  { id: "bush_northeast", kind: "bush", x: 1385, y: 250, width: 115, height: 170 },
  { id: "bush_east", kind: "bush", x: 1580, y: 435, width: 130, height: 110 },
  { id: "bush_south", kind: "bush", x: 1175, y: 765, width: 100, height: 135 },
  { id: "barrel_west", kind: "barrel", x: 365, y: 505, width: 42, height: 42 },
  { id: "crate_loot", kind: "crate", x: 630, y: 760, width: 52, height: 52 },
  { id: "north_chest", kind: "crate", x: 690, y: 72, width: 54, height: 54 }
];

export const clampToWorld = (x: number, y: number, radius: number) => ({
  x: Math.min(WORLD_WIDTH - radius, Math.max(radius, x)),
  y: Math.min(WORLD_HEIGHT - radius, Math.max(radius, y))
});

export const intersectsRect = (
  x: number,
  y: number,
  radius: number,
  rect: RectZone
): boolean => {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy <= radius * radius;
};

export const collidesWithObstacle = (x: number, y: number, radius: number): boolean =>
  OBSTACLES.some((obstacle) => intersectsRect(x, y, radius, obstacle));
