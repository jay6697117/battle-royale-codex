export const TextureKey = {
  Rogue: "character-rogue",
  Samurai: "character-samurai",
  Ninja: "character-ninja",
  Cowboy: "character-cowboy",
  Mage: "character-mage",
  Bat: "enemy-bat",
  Slime: "enemy-slime",
  Projectile: "fx-projectile",
  Spark: "fx-spark",
  Ammo: "pickup-ammo",
  Medkit: "pickup-medkit",
  Shield: "pickup-shield",
  Rifle: "pickup-rifle",
  Shotgun: "pickup-shotgun",
  Coin: "pickup-coin"
} as const;

export type TextureKey = (typeof TextureKey)[keyof typeof TextureKey];
