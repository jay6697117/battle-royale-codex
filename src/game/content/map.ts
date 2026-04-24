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
  { id: "west_ruin_1", x: 265, y: 405, width: 170, height: 54 },
  { id: "west_ruin_2", x: 298, y: 455, width: 54, height: 154 },
  { id: "southwest_water_wall", x: 455, y: 620, width: 280, height: 50 },
  { id: "center_wall", x: 680, y: 365, width: 180, height: 48 },
  { id: "northwest_column", x: 555, y: 78, width: 50, height: 118 },
  { id: "north_ruin", x: 1092, y: 58, width: 170, height: 62 },
  { id: "northeast_ruin", x: 1455, y: 135, width: 136, height: 62 },
  { id: "east_wall", x: 1288, y: 408, width: 48, height: 194 },
  { id: "east_middle_wall", x: 1390, y: 420, width: 72, height: 50 },
  { id: "east_ruin", x: 1482, y: 688, width: 155, height: 54 },
  { id: "south_ruin", x: 1100, y: 835, width: 150, height: 56 },
  { id: "south_column", x: 1165, y: 900, width: 54, height: 110 },
  { id: "crate_stack", x: 1512, y: 925, width: 96, height: 78 }
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
  { id: "bush_west", kind: "bush", x: 100, y: 470, width: 140, height: 155 },
  { id: "bush_northwest", kind: "bush", x: 605, y: 78, width: 84, height: 124 },
  { id: "bush_center", kind: "bush", x: 870, y: 210, width: 110, height: 140 },
  { id: "bush_northeast", kind: "bush", x: 1375, y: 235, width: 130, height: 185 },
  { id: "bush_east", kind: "bush", x: 1578, y: 430, width: 140, height: 116 },
  { id: "bush_south", kind: "bush", x: 1168, y: 765, width: 112, height: 150 },
  { id: "bush_southeast", kind: "bush", x: 1540, y: 748, width: 128, height: 112 },
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
