import {
  clampToWorld,
  collidesForMovement,
  collidesForProjectile,
  WORLD_CENTER_X,
  WORLD_CENTER_Y
} from "../content/map";
import { WEAPONS, weaponForSlot, type WeaponId } from "../content/weapons";
import type { InputFrame } from "../input/actions";

export type EntityKind = "player" | "bot" | "pve" | "projectile" | "pickup";
export type MatchPhase = "playing" | "won" | "lost";
export type FighterRole = "rogue" | "samurai" | "ninja" | "cowboy" | "mage";
export type PveType = "bat" | "slime";
export type PickupType = "ammo" | "medkit" | "shield" | "rifle" | "shotgun" | "coin";

export interface EntityState {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  label?: string;
  role?: FighterRole;
  pveType?: PveType;
  pickupType?: PickupType;
  health?: number;
  maxHealth?: number;
  shield?: number;
  speed?: number;
  aimAngle?: number;
  weaponId?: WeaponId;
  ammo?: Partial<Record<WeaponId, number>>;
  fireCooldownMs?: number;
  touchCooldownMs?: number;
  aiThinkMs?: number;
  aiTargetId?: string;
  aiMoveAngle?: number;
  teamIndex?: number;
  vx?: number;
  vy?: number;
  damage?: number;
  ownerId?: string;
  distanceLeft?: number;
  ageMs?: number;
}

export interface StormState {
  centerX: number;
  centerY: number;
  radius: number;
  initialRadius: number;
  minRadius: number;
  elapsedMs: number;
  shrinkStartMs: number;
  shrinkDurationMs: number;
  damagePerSecond: number;
}

export interface InventoryState {
  selectedSlot: number;
  pistolAmmo: number;
  shotgunAmmo: number;
  rifleAmmo: number;
  shieldPotions: number;
  medkits: number;
  coins: number;
}

export interface ScoreboardState {
  aliveFighters: number;
  kills: number;
  pveKills: number;
  shotsFired: number;
}

export interface GameEvent {
  id: number;
  type: "pickup" | "hit" | "elimination" | "shoot" | "heal" | "shield";
  x: number;
  y: number;
  entityId?: string;
  value?: number;
}

export interface GameState {
  matchTimeMs: number;
  phase: MatchPhase;
  playerId: string;
  entities: Record<string, EntityState>;
  storm: StormState;
  inventory: InventoryState;
  scoreboard: ScoreboardState;
  events: GameEvent[];
  nextEventId: number;
  nextEntityId: number;
}

const PLAYER_ID = "player_1";
const STEP_MS = 50;
const FIGHTER_RADIUS = 17;
const PROJECTILE_RADIUS = 5;
const PICKUP_RADIUS = 16;
type EntityList = EntityState[];

export const createInitialGameState = (): GameState => {
  const entities: Record<string, EntityState> = {};
  const add = (entity: EntityState) => {
    entities[entity.id] = entity;
  };

  add(createFighter(PLAYER_ID, "player", "Rogue99", "rogue", 1, 990, 520));
  add(createFighter("bot_samurai", "bot", "PixelSamurai", "samurai", 2, 1185, 325));
  add(createFighter("bot_ninja", "bot", "WildNinja", "ninja", 3, 900, 185));
  add(createFighter("bot_cowboy", "bot", "Cowboy", "cowboy", 4, 560, 520));
  add(createFighter("bot_mage", "bot", "MageDude", "mage", 5, 1090, 710));

  add(createPve("pve_bat_west", "bat", 180, 725));
  add(createPve("pve_bat_east", "bat", 1505, 615));
  add(createPve("pve_bat_north", "bat", 1350, 160));
  add(createPve("pve_slime_center", "slime", 1280, 655));
  add(createPve("pve_slime_southwest", "slime", 700, 805));

  for (const pickup of createInitialPickups()) {
    add(pickup);
  }

  return {
    matchTimeMs: 0,
    phase: "playing",
    playerId: PLAYER_ID,
    entities,
    storm: {
      centerX: WORLD_CENTER_X,
      centerY: WORLD_CENTER_Y,
      radius: 900,
      initialRadius: 900,
      minRadius: 260,
      elapsedMs: 0,
      shrinkStartMs: 12_000,
      shrinkDurationMs: 138_000,
      damagePerSecond: 2
    },
    inventory: {
      selectedSlot: 1,
      pistolAmmo: 25,
      shotgunAmmo: 10,
      rifleAmmo: 30,
      shieldPotions: 2,
      medkits: 1,
      coins: 0
    },
    scoreboard: {
      aliveFighters: 5,
      kills: 0,
      pveKills: 0,
      shotsFired: 0
    },
    events: [],
    nextEventId: 1,
    nextEntityId: 1
  };
};

export const stepSimulation = (state: GameState, input: InputFrame, deltaMs: number): GameState => {
  let remainingMs = Math.max(0, Math.min(deltaMs, 120_000));
  state.events = [];
  let isFirstFrame = true;

  while (remainingMs > 0) {
    const frameMs = Math.min(STEP_MS, remainingMs);
    stepFixed(
      state,
      isFirstFrame
        ? input
        : {
            ...input,
            useItem: false
          },
      frameMs
    );
    isFirstFrame = false;
    remainingMs -= frameMs;
  }

  return state;
};

const stepFixed = (state: GameState, input: InputFrame, deltaMs: number) => {
  if (state.phase !== "playing") {
    return;
  }

  state.matchTimeMs += deltaMs;
  const entities = Object.values(state.entities);
  updateStorm(state, deltaMs);
  updateCooldowns(entities, deltaMs);
  updatePlayer(state, input, deltaMs);
  updateBots(state, entities, deltaMs);
  updatePve(state, entities, deltaMs);
  updateProjectiles(state, entities, deltaMs);
  applyStormDamage(entities, state, deltaMs);
  collectPickups(state, entities);
  applyUsableItem(state, input);
  updateScoreboard(state, entities);
  resolvePhase(state, entities);
};

const createFighter = (
  id: string,
  kind: "player" | "bot",
  label: string,
  role: FighterRole,
  teamIndex: number,
  x: number,
  y: number
): EntityState => ({
  id,
  kind,
  label,
  role,
  teamIndex,
  x,
  y,
  radius: FIGHTER_RADIUS,
  alive: true,
  health: 100,
  maxHealth: 100,
  shield: teamIndex === 1 ? 12 : 0,
  speed: kind === "player" ? 245 : 190,
  weaponId: role === "samurai" ? "rifle" : role === "cowboy" ? "shotgun" : "pistol",
  ammo: {
    pistol: 99,
    shotgun: 18,
    rifle: 42
  },
  fireCooldownMs: kind === "bot" ? 1_200 : 0,
  aiThinkMs: 0,
  aiMoveAngle: 0,
  aimAngle: 0
});

const createPve = (id: string, pveType: PveType, x: number, y: number): EntityState => ({
  id,
  kind: "pve",
  pveType,
  x,
  y,
  radius: pveType === "bat" ? 18 : 20,
  alive: true,
  health: pveType === "bat" ? 48 : 70,
  maxHealth: pveType === "bat" ? 48 : 70,
  speed: pveType === "bat" ? 150 : 95,
  touchCooldownMs: 0,
  aiThinkMs: 0,
  aiMoveAngle: Math.random() * Math.PI * 2
});

const createInitialPickups = (): EntityState[] => [
  createPickup("pickup_rifle", "rifle", 560, 375),
  createPickup("pickup_shield_1", "shield", 900, 250),
  createPickup("pickup_coin", "coin", 760, 780),
  createPickup("pickup_medkit", "medkit", 1135, 870),
  createPickup("pickup_ammo_west", "ammo", 430, 505),
  createPickup("pickup_shotgun", "shotgun", 1530, 825),
  createPickup("pickup_shield_2", "shield", 1475, 790),
  createPickup("pickup_ammo_east", "ammo", 1595, 640)
];

const createPickup = (id: string, pickupType: PickupType, x: number, y: number): EntityState => ({
  id,
  kind: "pickup",
  pickupType,
  x,
  y,
  radius: PICKUP_RADIUS,
  alive: true,
  ageMs: 0
});

const updateStorm = (state: GameState, deltaMs: number) => {
  state.storm.elapsedMs += deltaMs;
  const progress = Math.max(
    0,
    Math.min(1, (state.storm.elapsedMs - state.storm.shrinkStartMs) / state.storm.shrinkDurationMs)
  );
  const eased = progress * progress * (3 - 2 * progress);
  state.storm.radius =
    state.storm.initialRadius - (state.storm.initialRadius - state.storm.minRadius) * eased;
};

const updateCooldowns = (entities: EntityList, deltaMs: number) => {
  for (const entity of entities) {
    if (entity.fireCooldownMs !== undefined) {
      entity.fireCooldownMs = Math.max(0, entity.fireCooldownMs - deltaMs);
    }
    if (entity.touchCooldownMs !== undefined) {
      entity.touchCooldownMs = Math.max(0, entity.touchCooldownMs - deltaMs);
    }
    if (entity.aiThinkMs !== undefined) {
      entity.aiThinkMs = Math.max(0, entity.aiThinkMs - deltaMs);
    }
    if (entity.ageMs !== undefined) {
      entity.ageMs += deltaMs;
    }
  }
};

const updatePlayer = (state: GameState, input: InputFrame, deltaMs: number) => {
  const player = state.entities[state.playerId];
  if (!isLivingFighter(player)) {
    return;
  }

  state.inventory.selectedSlot = Math.max(1, Math.min(5, input.selectedSlot));
  const length = Math.hypot(input.moveX, input.moveY) || 1;
  moveEntity(
    player,
    (input.moveX / length) * (player.speed ?? 0) * (deltaMs / 1_000),
    (input.moveY / length) * (player.speed ?? 0) * (deltaMs / 1_000)
  );
  player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

  if (input.shooting && state.inventory.selectedSlot <= 3) {
    const weapon = weaponForSlot(state.inventory.selectedSlot);
    const ammoKey = ammoKeyForWeapon(weapon.id);
    if ((state.inventory[ammoKey] as number) >= weapon.ammoCost) {
      const shot = fireWeapon(state, player, weapon.id, player.aimAngle);
      if (shot) {
        state.inventory[ammoKey] = Math.max(0, (state.inventory[ammoKey] as number) - weapon.ammoCost);
        state.scoreboard.shotsFired += 1;
      }
    }
  }
};

const updateBots = (state: GameState, entities: EntityList, deltaMs: number) => {
  const bots = entities.filter(
    (entity): entity is EntityState => entity.kind === "bot" && entity.alive
  );
  let botShotsThisFrame = 0;

  for (const bot of bots) {
    if ((bot.aiThinkMs ?? 0) <= 0) {
      const target = chooseBotTarget(state, bot, entities);
      bot.aiTargetId = target?.id;
      bot.aiMoveAngle = chooseBotMoveAngle(state, bot, target, entities);
      bot.aiThinkMs = 280 + Math.random() * 180;
    }

    const target = bot.aiTargetId ? state.entities[bot.aiTargetId] : undefined;
    const avoid = stormAvoidanceVector(state, bot);
    const dx = Math.cos(bot.aiMoveAngle ?? 0) + avoid.x * 1.6;
    const dy = Math.sin(bot.aiMoveAngle ?? 0) + avoid.y * 1.6;
    const len = Math.hypot(dx, dy) || 1;
    moveEntity(bot, (dx / len) * (bot.speed ?? 0) * (deltaMs / 1_000), (dy / len) * (bot.speed ?? 0) * (deltaMs / 1_000));

    if (isDamageable(target)) {
      const distance = distanceBetween(bot, target);
      bot.aimAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      const weaponId = bot.weaponId ?? "pistol";
      if (state.matchTimeMs > 1_800 && botShotsThisFrame === 0 && distance < WEAPONS[weaponId].range * 0.92) {
        const didShoot = fireWeapon(state, bot, weaponId, bot.aimAngle);
        if (didShoot) {
          botShotsThisFrame += 1;
          for (const otherBot of bots) {
            otherBot.fireCooldownMs = Math.max(otherBot.fireCooldownMs ?? 0, 1_800);
          }
        }
      }
    }
  }
};

export const chooseBotTarget = (
  state: GameState,
  bot: EntityState,
  entities: EntityState[] = Object.values(state.entities)
): EntityState | undefined => {
  const candidates = entities.filter(
    (entity) =>
      entity.id !== bot.id &&
      entity.alive &&
      (entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve") &&
      (entity.kind !== "player" || state.matchTimeMs > 30_000) &&
      (entity.kind !== "bot" || state.matchTimeMs > 30_000) &&
      isDamageable(entity)
  );

  candidates.sort((a, b) => {
    const aScore = (a.health ?? 0) + distanceBetween(bot, a) * 0.08 + (a.kind === "pve" ? 35 : 0);
    const bScore = (b.health ?? 0) + distanceBetween(bot, b) * 0.08 + (b.kind === "pve" ? 35 : 0);
    return aScore - bScore;
  });

  return candidates[0];
};

const chooseBotMoveAngle = (
  state: GameState,
  bot: EntityState,
  target: EntityState | undefined,
  entities: EntityList
): number => {
  const lowHealthPickup = entities.find(
    (entity) =>
      entity.kind === "pickup" &&
      entity.alive &&
      (entity.pickupType === "medkit" || entity.pickupType === "shield") &&
      distanceBetween(bot, entity) < 360
  );

  if ((bot.health ?? 100) < 50 && lowHealthPickup) {
    return Math.atan2(lowHealthPickup.y - bot.y, lowHealthPickup.x - bot.x);
  }

  if (target) {
    const angle = Math.atan2(target.y - bot.y, target.x - bot.x);
    return angle + Math.sin(state.matchTimeMs / 420 + bot.x) * 0.7;
  }

  return (bot.aiMoveAngle ?? 0) + 0.5;
};

const updatePve = (state: GameState, entities: EntityList, deltaMs: number) => {
  const pveEntities = entities.filter(
    (entity): entity is EntityState => entity.kind === "pve" && entity.alive
  );

  for (const pve of pveEntities) {
    if ((pve.aiThinkMs ?? 0) <= 0) {
      const target = nearestFighter(entities, pve);
      if (target && distanceBetween(pve, target) < 320) {
        pve.aiMoveAngle = Math.atan2(target.y - pve.y, target.x - pve.x);
      } else {
        pve.aiMoveAngle = (pve.aiMoveAngle ?? 0) + (Math.random() - 0.5) * 1.4;
      }
      pve.aiThinkMs = pve.pveType === "slime" ? 520 : 260;
    }

    const pulse = pve.pveType === "slime" ? 0.55 + Math.abs(Math.sin(state.matchTimeMs / 260)) : 1;
    moveEntity(
      pve,
      Math.cos(pve.aiMoveAngle ?? 0) * (pve.speed ?? 0) * pulse * (deltaMs / 1_000),
      Math.sin(pve.aiMoveAngle ?? 0) * (pve.speed ?? 0) * pulse * (deltaMs / 1_000)
    );

    const target = nearestFighter(entities, pve);
    if (
      target &&
      (pve.touchCooldownMs ?? 0) <= 0 &&
      distanceBetween(pve, target) < pve.radius + target.radius + 8
    ) {
      if (target.kind !== "bot" || state.matchTimeMs > 20_000) {
        damageEntity(state, target, pve.pveType === "slime" ? 5 : 3, pve.id);
      }
      pve.touchCooldownMs = pve.pveType === "slime" ? 1_250 : 1_050;
      const pushAngle = Math.atan2(target.y - pve.y, target.x - pve.x);
      moveEntity(target, Math.cos(pushAngle) * 10, Math.sin(pushAngle) * 10);
    }
  }
};

const updateProjectiles = (state: GameState, entities: EntityList, deltaMs: number) => {
  const projectiles = entities.filter(
    (entity): entity is EntityState => entity.kind === "projectile" && entity.alive
  );

  for (const projectile of projectiles) {
    const prevX = projectile.x;
    const prevY = projectile.y;
    const moveX = (projectile.vx ?? 0) * (deltaMs / 1_000);
    const moveY = (projectile.vy ?? 0) * (deltaMs / 1_000);
    projectile.x += moveX;
    projectile.y += moveY;
    projectile.distanceLeft = (projectile.distanceLeft ?? 0) - Math.hypot(moveX, moveY);

    if (projectile.distanceLeft <= 0 || collidesForProjectile(projectile.x, projectile.y, projectile.radius)) {
      projectile.alive = false;
      continue;
    }

    const hit = entities.find(
      (entity) =>
        entity.alive &&
        isDamageable(entity) &&
        entity.id !== projectile.ownerId &&
        segmentCircleHit(prevX, prevY, projectile.x, projectile.y, entity.x, entity.y, entity.radius + projectile.radius)
    );

    if (hit) {
      damageEntity(state, hit, projectile.damage ?? 0, projectile.ownerId);
      projectile.alive = false;
      pushEvent(state, "hit", hit.x, hit.y, hit.id, projectile.damage);
    }
  }

  pruneDeadProjectiles(state);
};

const fireWeapon = (
  state: GameState,
  shooter: EntityState,
  weaponId: WeaponId,
  baseAngle: number
): boolean => {
  const weapon = WEAPONS[weaponId];
  if ((shooter.fireCooldownMs ?? 0) > 0 || !shooter.alive) {
    return false;
  }

  shooter.fireCooldownMs = weapon.cooldownMs;
  shooter.weaponId = weaponId;
  for (let i = 0; i < weapon.pellets; i += 1) {
    const centerOffset = i - (weapon.pellets - 1) / 2;
    const angle = baseAngle + centerOffset * weapon.spreadRadians;
    const id = `projectile_${state.nextEntityId}`;
    state.nextEntityId += 1;
    state.entities[id] = {
      id,
      kind: "projectile",
      x: shooter.x + Math.cos(angle) * (shooter.radius + 8),
      y: shooter.y + Math.sin(angle) * (shooter.radius + 8),
      radius: PROJECTILE_RADIUS,
      alive: true,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      damage: shooter.kind === "bot" ? weapon.damage * 0.35 : weapon.damage,
      ownerId: shooter.id,
      distanceLeft: weapon.range,
      ageMs: 0
    };
  }
  pushEvent(state, "shoot", shooter.x, shooter.y, shooter.id);
  return true;
};

const collectPickups = (state: GameState, entities: EntityList) => {
  const player = state.entities[state.playerId];
  if (!isLivingFighter(player)) {
    return;
  }

  for (const pickup of entities) {
    if (pickup.kind !== "pickup" || !pickup.alive || distanceBetween(player, pickup) > player.radius + pickup.radius + 8) {
      continue;
    }

    switch (pickup.pickupType) {
      case "ammo":
        state.inventory.pistolAmmo += 10;
        state.inventory.shotgunAmmo += 4;
        state.inventory.rifleAmmo += 12;
        break;
      case "medkit":
        state.inventory.medkits += 1;
        break;
      case "shield":
        state.inventory.shieldPotions += 1;
        break;
      case "rifle":
        state.inventory.rifleAmmo += 24;
        state.inventory.selectedSlot = 3;
        break;
      case "shotgun":
        state.inventory.shotgunAmmo += 10;
        state.inventory.selectedSlot = 2;
        break;
      case "coin":
        state.inventory.coins += 1;
        break;
    }

    pickup.alive = false;
    pushEvent(state, "pickup", pickup.x, pickup.y, pickup.id);
  }
};

const applyUsableItem = (state: GameState, input: InputFrame) => {
  if (!input.useItem) {
    return;
  }

  const player = state.entities[state.playerId];
  if (!isLivingFighter(player)) {
    return;
  }

  if (state.inventory.selectedSlot === 4 && state.inventory.shieldPotions > 0) {
    player.shield = Math.min(60, (player.shield ?? 0) + 35);
    state.inventory.shieldPotions -= 1;
    pushEvent(state, "shield", player.x, player.y, player.id, player.shield);
  }

  if (state.inventory.selectedSlot === 5 && state.inventory.medkits > 0) {
    player.health = Math.min(player.maxHealth ?? 100, (player.health ?? 0) + 38);
    state.inventory.medkits -= 1;
    pushEvent(state, "heal", player.x, player.y, player.id, player.health);
  }
};

const applyStormDamage = (entities: EntityList, state: GameState, deltaMs: number) => {
  for (const entity of entities) {
    if (!entity.alive || !isDamageable(entity)) {
      continue;
    }
    const dx = entity.x - state.storm.centerX;
    const dy = entity.y - state.storm.centerY;
    if (Math.hypot(dx, dy) > state.storm.radius) {
      damageEntity(state, entity, state.storm.damagePerSecond * (deltaMs / 1_000), "storm");
    }
  }
};

const damageEntity = (
  state: GameState,
  entity: EntityState,
  amount: number,
  sourceId: string | undefined
) => {
  if (!isDamageable(entity)) {
    return;
  }

  let remaining = amount;
  if ((entity.shield ?? 0) > 0) {
    const shieldDamage = Math.min(entity.shield ?? 0, remaining);
    entity.shield = (entity.shield ?? 0) - shieldDamage;
    remaining -= shieldDamage;
  }
  entity.health = Math.max(0, (entity.health ?? 0) - remaining);

  if (entity.health <= 0 && entity.alive) {
    entity.alive = false;
    pushEvent(state, "elimination", entity.x, entity.y, entity.id);

    if (sourceId === state.playerId) {
      if (entity.kind === "pve") {
        state.scoreboard.pveKills += 1;
      } else {
        state.scoreboard.kills += 1;
      }
    }
  }
};

const moveEntity = (entity: EntityState, dx: number, dy: number) => {
  if (!entity.alive || (dx === 0 && dy === 0)) {
    return;
  }

  const radius = entity.radius;
  const nextX = clampToWorld(entity.x + dx, entity.y, radius);
  if (!collidesForMovement(entity, nextX.x, nextX.y, radius)) {
    entity.x = nextX.x;
  }

  const nextY = clampToWorld(entity.x, entity.y + dy, radius);
  if (!collidesForMovement(entity, nextY.x, nextY.y, radius)) {
    entity.y = nextY.y;
  }
};

const stormAvoidanceVector = (state: GameState, entity: EntityState) => {
  const dx = state.storm.centerX - entity.x;
  const dy = state.storm.centerY - entity.y;
  const distance = Math.hypot(dx, dy) || 1;
  const margin = state.storm.radius - distance;
  if (margin > 90) {
    return { x: 0, y: 0 };
  }
  return { x: dx / distance, y: dy / distance };
};

const nearestFighter = (entities: EntityList, from: EntityState): EntityState | undefined => {
  let nearest: EntityState | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entity of entities) {
    if (entity.id === from.id || !entity.alive || (entity.kind !== "player" && entity.kind !== "bot")) {
      continue;
    }
    const distance = distanceBetween(from, entity);
    if (distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }

  return nearest;
};

const updateScoreboard = (state: GameState, entities: EntityList) => {
  state.scoreboard.aliveFighters = entities.filter(
    (entity) => entity.alive && (entity.kind === "player" || entity.kind === "bot")
  ).length;
};

const resolvePhase = (state: GameState, entities: EntityList) => {
  const player = state.entities[state.playerId];
  if (!isLivingFighter(player)) {
    state.phase = "lost";
    return;
  }

  const livingBots = entities.filter((entity) => entity.kind === "bot" && entity.alive);
  if (livingBots.length === 0) {
    state.phase = "won";
  }
};

const pushEvent = (
  state: GameState,
  type: GameEvent["type"],
  x: number,
  y: number,
  entityId?: string,
  value?: number
) => {
  state.events.push({
    id: state.nextEventId,
    type,
    x,
    y,
    entityId,
    value
  });
  state.nextEventId += 1;
};

const pruneDeadProjectiles = (state: GameState) => {
  for (const [id, entity] of Object.entries(state.entities)) {
    if (entity.kind === "projectile" && !entity.alive) {
      delete state.entities[id];
    }
  }
};

const isLivingFighter = (entity: EntityState | undefined): entity is EntityState =>
  Boolean(entity && entity.alive && (entity.kind === "player" || entity.kind === "bot"));

const isDamageable = (entity: EntityState | undefined): entity is EntityState =>
  Boolean(entity && entity.alive && (entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve"));

const distanceBetween = (a: EntityState, b: EntityState) => Math.hypot(a.x - b.x, a.y - b.y);

const segmentCircleHit = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lengthSq));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(cx - px, cy - py) <= radius;
};

const ammoKeyForWeapon = (weaponId: WeaponId): "pistolAmmo" | "shotgunAmmo" | "rifleAmmo" => {
  if (weaponId === "shotgun") {
    return "shotgunAmmo";
  }
  if (weaponId === "rifle") {
    return "rifleAmmo";
  }
  return "pistolAmmo";
};
