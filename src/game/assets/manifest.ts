export const TextureKey = {
  GrassTiles: "tiles-grass",
  ArenaGround: "map-arena-ground",
  WaterTiles: "tiles-water",
  RuinsTiles: "tiles-ruins",
  FoliageTiles: "tiles-foliage",
  StormSea: "fx-storm-sea",
  StormEdge: "fx-storm-edge",
  Rogue: "character-rogue-idle",
  Samurai: "character-samurai-idle",
  Ninja: "character-ninja-idle",
  Cowboy: "character-cowboy-idle",
  Mage: "character-mage-idle",
  Bat: "enemy-bat-fly",
  Slime: "enemy-slime-idle",
  Projectile: "fx-projectile-bullet",
  Spark: "fx-hit-spark",
  Ammo: "pickup-ammo",
  Medkit: "pickup-medkit",
  Shield: "pickup-shield",
  Rifle: "pickup-rifle",
  Shotgun: "pickup-shotgun",
  Coin: "pickup-coin",
  Crate: "prop-crate",
  Chest: "prop-chest",
  Barrel: "prop-barrel",
  TeamPanel: "ui-team-panel",
  InventorySlot: "ui-inventory-slot",
  InventorySlotActive: "ui-inventory-slot-active",
  StatPill: "ui-stat-pill",
  ActionButton: "ui-action-button",
  MiniMapFrame: "ui-minimap-frame"
} as const;

export type TextureKey = (typeof TextureKey)[keyof typeof TextureKey];

export type CharacterId = "rogue" | "samurai" | "ninja" | "cowboy" | "mage";
export type CharacterAnimationId = "idle" | "walk" | "shoot" | "hurt";
export type EnemyId = "bat" | "slime";
export type EnemyAnimationId = "fly" | "dash" | "hurt" | "idle" | "hop" | "squash";

export interface ImageAsset {
  key: string;
  path: string;
  requiresAlpha?: boolean;
}

export interface SpritesheetAsset extends ImageAsset {
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

export const IMAGE_ASSETS: ImageAsset[] = [
  { key: TextureKey.ArenaGround, path: "/assets/maps/arena-ground.png" },
  { key: TextureKey.StormSea, path: "/assets/fx/storm-sea.png" },
  { key: TextureKey.Projectile, path: "/assets/fx/projectile-bullet.png", requiresAlpha: true },
  { key: TextureKey.Ammo, path: "/assets/pickups/ammo.png", requiresAlpha: true },
  { key: TextureKey.Medkit, path: "/assets/pickups/medkit.png", requiresAlpha: true },
  { key: TextureKey.Shield, path: "/assets/pickups/shield.png", requiresAlpha: true },
  { key: TextureKey.Rifle, path: "/assets/pickups/rifle.png", requiresAlpha: true },
  { key: TextureKey.Shotgun, path: "/assets/pickups/shotgun.png", requiresAlpha: true },
  { key: TextureKey.Coin, path: "/assets/pickups/coin.png", requiresAlpha: true },
  { key: TextureKey.Crate, path: "/assets/props/crate.png", requiresAlpha: true },
  { key: TextureKey.Chest, path: "/assets/props/chest.png", requiresAlpha: true },
  { key: TextureKey.Barrel, path: "/assets/props/barrel.png", requiresAlpha: true }
];

export const UI_ASSETS: ImageAsset[] = [
  { key: TextureKey.TeamPanel, path: "/assets/ui/team-panel.png", requiresAlpha: true },
  { key: TextureKey.InventorySlot, path: "/assets/ui/inventory-slot.png", requiresAlpha: true },
  { key: TextureKey.InventorySlotActive, path: "/assets/ui/inventory-slot-active.png", requiresAlpha: true },
  { key: TextureKey.StatPill, path: "/assets/ui/stat-pill.png", requiresAlpha: true },
  { key: TextureKey.ActionButton, path: "/assets/ui/action-button.png", requiresAlpha: true },
  { key: TextureKey.MiniMapFrame, path: "/assets/ui/minimap-frame.png", requiresAlpha: true },
  { key: "ui-rank-1", path: "/assets/ui/rank-1.png", requiresAlpha: true },
  { key: "ui-rank-2", path: "/assets/ui/rank-2.png", requiresAlpha: true },
  { key: "ui-rank-3", path: "/assets/ui/rank-3.png", requiresAlpha: true },
  { key: "ui-rank-4", path: "/assets/ui/rank-4.png", requiresAlpha: true },
  { key: "ui-rank-5", path: "/assets/ui/rank-5.png", requiresAlpha: true },
  { key: "ui-portrait-rogue", path: "/assets/ui/portrait-rogue.png", requiresAlpha: true },
  { key: "ui-portrait-samurai", path: "/assets/ui/portrait-samurai.png", requiresAlpha: true },
  { key: "ui-portrait-ninja", path: "/assets/ui/portrait-ninja.png", requiresAlpha: true },
  { key: "ui-portrait-cowboy", path: "/assets/ui/portrait-cowboy.png", requiresAlpha: true },
  { key: "ui-portrait-mage", path: "/assets/ui/portrait-mage.png", requiresAlpha: true }
];

const characterFrames: Record<CharacterAnimationId, number> = {
  idle: 4,
  walk: 6,
  shoot: 4,
  hurt: 3
};

const enemyFrames: Record<string, number> = {
  "bat-fly": 6,
  "bat-dash": 4,
  "bat-hurt": 3,
  "slime-idle": 4,
  "slime-hop": 6,
  "slime-squash": 3
};

const pickupTypes = ["ammo", "medkit", "shield", "rifle", "shotgun", "coin"] as const;

export const characterSheetKey = (id: CharacterId, animation: CharacterAnimationId) =>
  `character-${id}-${animation}`;

export const enemySheetKey = (id: EnemyId, animation: EnemyAnimationId) => `enemy-${id}-${animation}`;

export const pickupGlowKey = (id: (typeof pickupTypes)[number]) => `pickup-${id}-glow`;

export const SPRITESHEET_ASSETS: SpritesheetAsset[] = [
  {
    key: TextureKey.GrassTiles,
    path: "/assets/tiles/grass-tiles.png",
    frameWidth: 32,
    frameHeight: 32,
    frames: 24
  },
  {
    key: TextureKey.WaterTiles,
    path: "/assets/tiles/water-tiles.png",
    frameWidth: 32,
    frameHeight: 32,
    frames: 8
  },
  {
    key: TextureKey.RuinsTiles,
    path: "/assets/tiles/ruins-tiles.png",
    frameWidth: 32,
    frameHeight: 32,
    frames: 12,
    requiresAlpha: true
  },
  {
    key: TextureKey.FoliageTiles,
    path: "/assets/tiles/foliage-tiles.png",
    frameWidth: 32,
    frameHeight: 32,
    frames: 8,
    requiresAlpha: true
  },
  ...(["rogue", "samurai", "ninja", "cowboy", "mage"] as const).flatMap((id) =>
    (["idle", "walk", "shoot", "hurt"] as const).map((animation) => ({
      key: characterSheetKey(id, animation),
      path: `/assets/characters/${id}/${animation}.png`,
      frameWidth: 96,
      frameHeight: 96,
      frames: characterFrames[animation],
      requiresAlpha: true
    }))
  ),
  ...Object.entries(enemyFrames).map(([id, frames]) => {
    const [enemyId, animation] = id.split("-") as [EnemyId, EnemyAnimationId];
    return {
      key: enemySheetKey(enemyId, animation),
      path: `/assets/enemies/${enemyId}/${animation}.png`,
      frameWidth: 96,
      frameHeight: 96,
      frames,
      requiresAlpha: true
    };
  }),
  ...pickupTypes.map((id) => ({
    key: pickupGlowKey(id),
    path: `/assets/pickups/${id}-glow.png`,
    frameWidth: 48,
    frameHeight: 48,
    frames: 4,
    requiresAlpha: true
  })),
  {
    key: "fx-muzzle-flash",
    path: "/assets/fx/muzzle-flash.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 4,
    requiresAlpha: true
  },
  {
    key: TextureKey.Spark,
    path: "/assets/fx/hit-spark.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 5,
    requiresAlpha: true
  },
  {
    key: "fx-pickup-ring",
    path: "/assets/fx/pickup-ring.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 6,
    requiresAlpha: true
  },
  {
    key: "fx-storm-arc",
    path: "/assets/fx/storm-arc.png",
    frameWidth: 64,
    frameHeight: 64,
    frames: 8,
    requiresAlpha: true
  },
  {
    key: TextureKey.StormEdge,
    path: "/assets/fx/storm-edge.png",
    frameWidth: 128,
    frameHeight: 96,
    frames: 8,
    requiresAlpha: true
  }
];

export const ALL_ASSETS = [...IMAGE_ASSETS, ...SPRITESHEET_ASSETS, ...UI_ASSETS] as const;
