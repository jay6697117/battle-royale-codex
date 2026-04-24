export type WeaponId = "pistol" | "shotgun" | "rifle";

export interface WeaponDefinition {
  id: WeaponId;
  label: string;
  slot: number;
  damage: number;
  projectileSpeed: number;
  cooldownMs: number;
  range: number;
  ammoCost: number;
  spreadRadians: number;
  pellets: number;
}

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: "pistol",
    label: "Pistol",
    slot: 1,
    damage: 18,
    projectileSpeed: 700,
    cooldownMs: 360,
    range: 520,
    ammoCost: 1,
    spreadRadians: 0.02,
    pellets: 1
  },
  shotgun: {
    id: "shotgun",
    label: "Shotgun",
    slot: 2,
    damage: 14,
    projectileSpeed: 620,
    cooldownMs: 700,
    range: 330,
    ammoCost: 1,
    spreadRadians: 0.22,
    pellets: 5
  },
  rifle: {
    id: "rifle",
    label: "Rifle",
    slot: 3,
    damage: 24,
    projectileSpeed: 820,
    cooldownMs: 240,
    range: 680,
    ammoCost: 1,
    spreadRadians: 0.01,
    pellets: 1
  }
};

export const weaponForSlot = (slot: number): WeaponDefinition => {
  if (slot === 2) {
    return WEAPONS.shotgun;
  }
  if (slot === 3) {
    return WEAPONS.rifle;
  }
  return WEAPONS.pistol;
};
