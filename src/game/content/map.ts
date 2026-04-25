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
  kind: "wall" | "bush" | "crate" | "chest" | "barrel" | "water" | "ruin";
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MovementBlocker = "solid" | "water";
export type ProjectileBlocker = "solid";

export interface CollisionEntity {
  kind: string;
  pveType?: string;
}

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const WORLD_CENTER_X = WORLD_WIDTH / 2;
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2;

export const STRUCTURE_ZONES: RectZone[] = [
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
  { id: "south_column", x: 1165, y: 900, width: 54, height: 110 }
];

export const PROP_SOLID_ZONES: RectZone[] = [
  { id: "crate_stack_left", x: 1488, y: 908, width: 64, height: 64 },
  { id: "crate_stack_right", x: 1533, y: 878, width: 64, height: 64 },
  { id: "crate_loot", x: 598, y: 748, width: 64, height: 64 },
  { id: "north_chest", x: 658, y: 68, width: 64, height: 64 }
];

export const BARREL_ZONES: RectZone[] = [
  { id: "barrel_west", x: 365, y: 505, width: 64, height: 64 }
];

export const SOLID_ZONES: RectZone[] = [...STRUCTURE_ZONES, ...PROP_SOLID_ZONES, ...BARREL_ZONES];

export const OBSTACLES = SOLID_ZONES;

export const WATER_ZONES: RectZone[] = [
  { id: "southwest_pond_top", x: 275, y: 640, width: 310, height: 56 },
  { id: "southwest_pond_left", x: 270, y: 696, width: 168, height: 139 },
  { id: "southwest_pond_lower", x: 270, y: 835, width: 245, height: 130 },
  { id: "north_pond_cap", x: 1165, y: 92, width: 90, height: 33 },
  { id: "north_pond_main", x: 1105, y: 125, width: 253, height: 120 },
  { id: "north_pond_lower", x: 1105, y: 245, width: 175, height: 75 }
];

export const FOLIAGE_ZONES: RectZone[] = [
  { id: "bush_west", x: 100, y: 470, width: 140, height: 155 },
  { id: "bush_northwest", x: 605, y: 78, width: 84, height: 124 },
  { id: "bush_center", x: 870, y: 210, width: 110, height: 140 },
  { id: "bush_northeast", x: 1375, y: 235, width: 130, height: 185 },
  { id: "bush_east", x: 1578, y: 430, width: 140, height: 116 },
  { id: "bush_south", x: 1168, y: 765, width: 112, height: 150 },
  { id: "bush_southeast", x: 1540, y: 748, width: 128, height: 112 }
];

export const MAP_FEATURES: MapFeature[] = [
  ...STRUCTURE_ZONES.map((zone) => ({ ...zone, kind: "wall" as const })),
  ...PROP_SOLID_ZONES.map((zone) => ({
    ...zone,
    kind: zone.id.includes("chest") ? ("chest" as const) : ("crate" as const)
  })),
  ...WATER_ZONES.map((zone) => ({ ...zone, kind: "water" as const })),
  ...FOLIAGE_ZONES.map((zone) => ({ ...zone, kind: "bush" as const })),
  ...BARREL_ZONES.map((zone) => ({ ...zone, kind: "barrel" as const }))
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
  SOLID_ZONES.some((obstacle) => intersectsRect(x, y, radius, obstacle));

export const collidesForMovement = (
  entity: CollisionEntity,
  x: number,
  y: number,
  radius: number
): boolean => {
  if (SOLID_ZONES.some((zone) => intersectsRect(x, y, radius, zone))) {
    return true;
  }

  if (entity.kind === "pve" && entity.pveType === "bat") {
    return false;
  }

  return WATER_ZONES.some((zone) => intersectsRect(x, y, radius, zone));
};

export const collidesForProjectile = (x: number, y: number, radius: number): boolean =>
  SOLID_ZONES.some((zone) => intersectsRect(x, y, radius, zone));
