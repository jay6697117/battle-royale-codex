# Monster Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast-paced in-match monster progression loop where killing PVE enemies grants bounded XP, small player power growth, controlled resource drops, and three new behavior-distinct monster types.

**Architecture:** Keep gameplay rules in `src/game/simulation/state.ts` and reusable tuning data in focused `src/game/content/*` modules. Phaser remains a renderer that maps `pveType` to animations and event effects, while the DOM HUD reads `state.progression` directly.

**Tech Stack:** Phaser 3.90, TypeScript 5.9, Vite 7, Vitest 4, Python PIL asset generation.

---

## File Structure

- Create `src/game/content/pickups.ts`: source of truth for pickup IDs shared by simulation and asset manifest.
- Create `src/game/content/pve.ts`: source of truth for PVE types, base stats, XP rewards, drop tables, animation preferences, and drop selection helpers.
- Create `src/game/content/pve.test.ts`: unit tests for PVE definitions and deterministic drop selection.
- Modify `src/game/simulation/state.ts`: add progression state, XP awarding, player damage bonus, drop spawning, new PVE behavior, and PVE projectiles.
- Modify `src/game/simulation/simulation.test.ts`: integration tests for XP, leveling, drops, no reward from non-player kills, and new PVE attacks.
- Modify `src/game/assets/manifest.ts`: import shared pickup/PVE IDs, add new enemy animation keys and frame counts.
- Modify `tools/generate_pixel_assets.py`: generate the new enemy sprite sheets used by manifest tests.
- Modify generated files under `public/assets/enemies/boar/`, `public/assets/enemies/spitter/`, and `public/assets/enemies/brute/`: output from the asset generator.
- Modify `src/phaser/scenes/BattleScene.ts`: map new PVE types to their animations and add a level-up effect branch.
- Modify `src/ui/hud/HudController.ts`: render level and XP progress and include progression in the HUD snapshot.
- Modify `src/styles.css`: style the progression HUD without overlapping existing HUD regions.

Execution must leave unrelated dirty worktree changes untouched. Only stage files listed in each task.

---

### Task 1: Add Shared Pickup And PVE Content Definitions

**Files:**
- Create: `src/game/content/pickups.ts`
- Create: `src/game/content/pve.ts`
- Create: `src/game/content/pve.test.ts`

- [ ] **Step 1: Write the failing PVE content tests**

Create `src/game/content/pve.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_PLAYER_LEVEL,
  PVE_DEFINITIONS,
  PVE_TYPES,
  XP_THRESHOLDS,
  choosePveDrops,
  xpToNextLevel
} from "./pve";

describe("pve content definitions", () => {
  it("defines bounded progression thresholds", () => {
    expect(MAX_PLAYER_LEVEL).toBe(5);
    expect(XP_THRESHOLDS).toEqual([30, 55, 85, 120]);
    expect(xpToNextLevel(1)).toBe(30);
    expect(xpToNextLevel(4)).toBe(120);
    expect(xpToNextLevel(5)).toBe(0);
  });

  it("defines every PVE type with positive combat stats", () => {
    expect(PVE_TYPES).toEqual(["bat", "slime", "boar", "spitter", "brute"]);

    for (const pveType of PVE_TYPES) {
      const definition = PVE_DEFINITIONS[pveType];
      expect(definition.maxHealth, pveType).toBeGreaterThan(0);
      expect(definition.radius, pveType).toBeGreaterThan(0);
      expect(definition.speed, pveType).toBeGreaterThan(0);
      expect(definition.xpReward, pveType).toBeGreaterThan(0);
      expect(definition.touchDamage, pveType).toBeGreaterThanOrEqual(0);
      expect(definition.touchCooldownMs, pveType).toBeGreaterThan(0);
      expect(definition.thinkMs, pveType).toBeGreaterThan(0);
    }
  });

  it("chooses deterministic drops from ordered rolls", () => {
    expect(choosePveDrops("bat", [0.1, 0.9])).toEqual(["ammo"]);
    expect(choosePveDrops("bat", [0.9, 0.1])).toEqual(["coin"]);
    expect(choosePveDrops("slime", [0.1, 0.1])).toEqual(["shield"]);
    expect(choosePveDrops("spitter", [0.2, 0.3])).toEqual(["ammo"]);
    expect(choosePveDrops("brute", [0.99, 0.1, 0.1])).toEqual(["coin", "shield"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/game/content/pve.test.ts
```

Expected: `FAIL` because `src/game/content/pve.ts` does not exist.

- [ ] **Step 3: Create shared pickup definitions**

Create `src/game/content/pickups.ts` with this content:

```ts
export const PICKUP_TYPES = ["ammo", "medkit", "shield", "rifle", "shotgun", "coin"] as const;

export type PickupType = (typeof PICKUP_TYPES)[number];
```

- [ ] **Step 4: Create PVE content definitions**

Create `src/game/content/pve.ts` with this content:

```ts
import type { PickupType } from "./pickups";

export const PVE_TYPES = ["bat", "slime", "boar", "spitter", "brute"] as const;

export type PveType = (typeof PVE_TYPES)[number];
export type PveBehavior = "chase" | "pulse" | "charge" | "spit" | "brute";

export interface PveDropEntry {
  pickupType: PickupType;
  chance: number;
}

export interface PveDefinition {
  type: PveType;
  radius: number;
  maxHealth: number;
  speed: number;
  xpReward: number;
  touchDamage: number;
  touchCooldownMs: number;
  thinkMs: number;
  targetRange: number;
  behavior: PveBehavior;
  maxDrops: number;
  dropTable: PveDropEntry[];
}

export const MAX_PLAYER_LEVEL = 5;
export const XP_THRESHOLDS = [30, 55, 85, 120] as const;
export const PLAYER_DAMAGE_BONUS_PER_LEVEL = 0.04;
export const PLAYER_MAX_HEALTH_PER_LEVEL = 5;
export const LEVEL_UP_HEAL = 12;

export const xpToNextLevel = (level: number): number => {
  if (level >= MAX_PLAYER_LEVEL) {
    return 0;
  }
  return XP_THRESHOLDS[Math.max(0, level - 1)] ?? 0;
};

export const PVE_DEFINITIONS: Record<PveType, PveDefinition> = {
  bat: {
    type: "bat",
    radius: 18,
    maxHealth: 48,
    speed: 150,
    xpReward: 12,
    touchDamage: 3,
    touchCooldownMs: 1_050,
    thinkMs: 260,
    targetRange: 320,
    behavior: "chase",
    maxDrops: 1,
    dropTable: [
      { pickupType: "ammo", chance: 0.35 },
      { pickupType: "coin", chance: 0.2 }
    ]
  },
  slime: {
    type: "slime",
    radius: 20,
    maxHealth: 70,
    speed: 95,
    xpReward: 18,
    touchDamage: 5,
    touchCooldownMs: 1_250,
    thinkMs: 520,
    targetRange: 320,
    behavior: "pulse",
    maxDrops: 1,
    dropTable: [
      { pickupType: "shield", chance: 0.3 },
      { pickupType: "coin", chance: 0.3 }
    ]
  },
  boar: {
    type: "boar",
    radius: 21,
    maxHealth: 82,
    speed: 112,
    xpReward: 20,
    touchDamage: 8,
    touchCooldownMs: 1_150,
    thinkMs: 360,
    targetRange: 360,
    behavior: "charge",
    maxDrops: 1,
    dropTable: [
      { pickupType: "ammo", chance: 0.45 },
      { pickupType: "medkit", chance: 0.12 }
    ]
  },
  spitter: {
    type: "spitter",
    radius: 18,
    maxHealth: 58,
    speed: 82,
    xpReward: 22,
    touchDamage: 2,
    touchCooldownMs: 1_350,
    thinkMs: 420,
    targetRange: 460,
    behavior: "spit",
    maxDrops: 1,
    dropTable: [
      { pickupType: "ammo", chance: 0.55 },
      { pickupType: "shield", chance: 0.18 }
    ]
  },
  brute: {
    type: "brute",
    radius: 25,
    maxHealth: 150,
    speed: 72,
    xpReward: 38,
    touchDamage: 12,
    touchCooldownMs: 1_450,
    thinkMs: 620,
    targetRange: 300,
    behavior: "brute",
    maxDrops: 2,
    dropTable: [
      { pickupType: "coin", chance: 1 },
      { pickupType: "shield", chance: 0.45 },
      { pickupType: "medkit", chance: 0.25 }
    ]
  }
};

export const choosePveDrops = (pveType: PveType, rolls: readonly number[]): PickupType[] => {
  const definition = PVE_DEFINITIONS[pveType];
  const drops: PickupType[] = [];

  for (const [index, entry] of definition.dropTable.entries()) {
    if (drops.length >= definition.maxDrops) {
      break;
    }
    const roll = rolls[index] ?? 1;
    if (roll <= entry.chance) {
      drops.push(entry.pickupType);
    }
  }

  return drops;
};
```

- [ ] **Step 5: Run the content tests**

Run:

```bash
npm test -- src/game/content/pve.test.ts
```

Expected: `PASS`.

- [ ] **Step 6: Commit**

```bash
git add src/game/content/pickups.ts src/game/content/pve.ts src/game/content/pve.test.ts
git commit -m "feat: add pve progression content"
```

---

### Task 2: Add Progression Integration Tests

**Files:**
- Modify: `src/game/simulation/simulation.test.ts`

- [ ] **Step 1: Add helper functions to simulation tests**

In `src/game/simulation/simulation.test.ts`, after `requireEntity`, add:

```ts
const killEntityWithPlayerRifle = (
  state: ReturnType<typeof createInitialGameState>,
  entityId: string
) => {
  const player = requireEntity(state, state.playerId);
  const target = requireEntity(state, entityId);
  player.x = 500;
  player.y = 500;
  player.aimAngle = 0;
  target.x = 610;
  target.y = 500;
  target.health = 1;
  target.shield = 0;

  for (const entity of Object.values(state.entities)) {
    if (entity.id !== state.playerId && entity.id !== entityId && entity.kind !== "pickup") {
      entity.alive = false;
    }
  }

  stepSimulation(
    state,
    {
      ...emptyInput,
      aimX: 700,
      aimY: 500,
      shooting: true,
      selectedSlot: 3
    },
    120
  );
  stepSimulation(state, { ...emptyInput, selectedSlot: 3 }, 260);
};
```

- [ ] **Step 2: Add failing XP and level tests**

In the same `describe("battle royale simulation", () => { ... })` block, before the final closing `});`, add:

```ts
  it("awards player XP for PVE kills and levels up with bounded stat growth", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    state.progression.xp = 29;
    player.health = 80;

    killEntityWithPlayerRifle(state, "pve_bat_west");

    expect(state.scoreboard.pveKills).toBe(1);
    expect(state.progression.level).toBe(2);
    expect(state.progression.xp).toBe(11);
    expect(state.progression.xpToNext).toBe(55);
    expect(state.progression.totalXp).toBe(41);
    expect(player.maxHealth).toBe(105);
    expect(player.health).toBe(92);
    expect(state.events.some((event) => event.type === "level-up" && event.value === 2)).toBe(true);
  });

  it("applies player damage bonus without increasing bot projectile damage", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    const pve = requireEntity(state, "pve_slime_center");
    state.progression.level = 5;
    state.progression.xp = 0;
    state.progression.xpToNext = 0;
    pve.x = 610;
    pve.y = 500;
    player.x = 500;
    player.y = 500;

    for (const entity of Object.values(state.entities)) {
      if (entity.id !== state.playerId && entity.id !== pve.id && entity.kind !== "pickup") {
        entity.alive = false;
      }
    }

    const healthBefore = pve.health ?? 0;
    stepSimulation(
      state,
      {
        ...emptyInput,
        aimX: 700,
        aimY: 500,
        shooting: true,
        selectedSlot: 3
      },
      120
    );
    stepSimulation(state, { ...emptyInput, selectedSlot: 3 }, 260);

    expect(healthBefore - (pve.health ?? 0)).toBeCloseTo(27.84, 2);
  });

  it("does not award player XP when a bot projectile kills PVE", () => {
    const state = createInitialGameState();
    const pve = requireEntity(state, "pve_bat_west");
    pve.x = 505;
    pve.y = 500;
    pve.health = 1;

    state.entities.test_bot_projectile = {
      id: "test_bot_projectile",
      kind: "projectile",
      x: 480,
      y: 500,
      radius: 5,
      alive: true,
      vx: 600,
      vy: 0,
      damage: 10,
      ownerId: "bot_samurai",
      distanceLeft: 120,
      ageMs: 0
    };

    stepSimulation(state, emptyInput, 80);

    expect(pve.alive).toBe(false);
    expect(state.progression.totalXp).toBe(0);
    expect(state.scoreboard.pveKills).toBe(0);
  });
```

- [ ] **Step 3: Run tests to verify progression is missing**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts
```

Expected: `FAIL` with TypeScript errors or assertion failures because `GameState.progression` and `level-up` events are not implemented yet.

- [ ] **Step 4: Commit the failing tests**

```bash
git add src/game/simulation/simulation.test.ts
git commit -m "test: cover pve progression rewards"
```

---

### Task 3: Implement Progression Rewards And Player Damage Bonus

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/game/simulation/simulation.test.ts`

- [ ] **Step 1: Update imports and type definitions**

In `src/game/simulation/state.ts`, replace the local `PveType` and `PickupType` definitions with imports from content modules:

```ts
import {
  LEVEL_UP_HEAL,
  MAX_PLAYER_LEVEL,
  PLAYER_DAMAGE_BONUS_PER_LEVEL,
  PLAYER_MAX_HEALTH_PER_LEVEL,
  PVE_DEFINITIONS,
  xpToNextLevel,
  type PveType
} from "../content/pve";
import type { PickupType } from "../content/pickups";

export type { PickupType } from "../content/pickups";
export type { PveType } from "../content/pve";
```

Then remove these old lines:

```ts
export type PveType = "bat" | "slime";
export type PickupType = "ammo" | "medkit" | "shield" | "rifle" | "shotgun" | "coin";
```

Add this interface after `ScoreboardState`:

```ts
export interface ProgressionState {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
}
```

Change `GameEvent["type"]` to include `level-up`:

```ts
type: "pickup" | "hit" | "elimination" | "shoot" | "heal" | "shield" | "level-up";
```

Add `progression` to `GameState`:

```ts
progression: ProgressionState;
```

- [ ] **Step 2: Initialize progression state**

Inside `createInitialGameState`, add this field between `scoreboard` and `events`:

```ts
    progression: {
      level: 1,
      xp: 0,
      xpToNext: xpToNextLevel(1),
      totalXp: 0
    },
```

- [ ] **Step 3: Use PVE definitions in `createPve`**

Replace the existing `createPve` function with:

```ts
const createPve = (id: string, pveType: PveType, x: number, y: number): EntityState => {
  const definition = PVE_DEFINITIONS[pveType];
  return {
    id,
    kind: "pve",
    pveType,
    x,
    y,
    radius: definition.radius,
    alive: true,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    speed: definition.speed,
    fireCooldownMs: pveType === "spitter" ? 900 : undefined,
    touchCooldownMs: 0,
    aiThinkMs: 0,
    aiMoveAngle: Math.random() * Math.PI * 2
  };
};
```

- [ ] **Step 4: Apply player damage bonus in `fireWeapon`**

In `fireWeapon`, replace this field:

```ts
damage: shooter.kind === "bot" ? weapon.damage * 0.35 : weapon.damage,
```

with:

```ts
damage: projectileDamageForShooter(state, shooter, weapon.damage),
```

Add this helper near `ammoKeyForWeapon`:

```ts
const projectileDamageForShooter = (state: GameState, shooter: EntityState, baseDamage: number): number => {
  if (shooter.id === state.playerId) {
    return baseDamage * (1 + (state.progression.level - 1) * PLAYER_DAMAGE_BONUS_PER_LEVEL);
  }
  if (shooter.kind === "bot") {
    return baseDamage * 0.35;
  }
  return baseDamage;
};
```

- [ ] **Step 5: Award XP when the player kills PVE**

In `damageEntity`, inside the `if (sourceId === state.playerId)` block, replace the PVE branch:

```ts
if (entity.kind === "pve") {
  state.scoreboard.pveKills += 1;
} else {
  state.scoreboard.kills += 1;
}
```

with:

```ts
if (entity.kind === "pve" && entity.pveType) {
  state.scoreboard.pveKills += 1;
  awardPveXp(state, entity);
} else {
  state.scoreboard.kills += 1;
}
```

Add these helpers near `pushEvent`:

```ts
const awardPveXp = (state: GameState, entity: EntityState) => {
  if (!entity.pveType) {
    return;
  }

  const reward = PVE_DEFINITIONS[entity.pveType].xpReward;
  state.progression.xp += reward;
  state.progression.totalXp += reward;

  const player = state.entities[state.playerId];
  while (state.progression.level < MAX_PLAYER_LEVEL && state.progression.xp >= state.progression.xpToNext) {
    state.progression.xp -= state.progression.xpToNext;
    state.progression.level += 1;
    state.progression.xpToNext = xpToNextLevel(state.progression.level);
    applyLevelUpStats(state, player);
    pushEvent(state, "level-up", player?.x ?? entity.x, player?.y ?? entity.y, state.playerId, state.progression.level);
  }

  if (state.progression.level >= MAX_PLAYER_LEVEL) {
    state.progression.xp = 0;
    state.progression.xpToNext = 0;
  }
};

const applyLevelUpStats = (state: GameState, player: EntityState | undefined) => {
  if (!isLivingFighter(player)) {
    return;
  }
  player.maxHealth = 100 + (state.progression.level - 1) * PLAYER_MAX_HEALTH_PER_LEVEL;
  player.health = Math.min(player.maxHealth, (player.health ?? 0) + LEVEL_UP_HEAL);
};
```

- [ ] **Step 6: Run focused simulation tests**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts
```

Expected: the XP, level-up, and damage bonus tests pass. The bot projectile no-XP test passes because rewards are only awarded when `sourceId === state.playerId`.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: `PASS`.

- [ ] **Step 8: Commit**

```bash
git add src/game/simulation/state.ts src/game/simulation/simulation.test.ts
git commit -m "feat: award pve progression"
```

---

### Task 4: Implement PVE Drop Spawning

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/game/simulation/simulation.test.ts`

- [ ] **Step 1: Add a failing guaranteed drop integration test**

In `src/game/simulation/simulation.test.ts`, before the final closing `});`, add:

```ts
  it("spawns controlled drops when the player kills elite PVE", () => {
    const state = createInitialGameState();
    state.entities.test_brute = {
      id: "test_brute",
      kind: "pve",
      pveType: "brute",
      x: 610,
      y: 500,
      radius: 25,
      alive: true,
      health: 1,
      maxHealth: 150,
      speed: 72,
      touchCooldownMs: 0,
      aiThinkMs: 0,
      aiMoveAngle: 0
    };

    killEntityWithPlayerRifle(state, "test_brute");

    const drops = Object.values(state.entities).filter(
      (entity) => entity.kind === "pickup" && entity.id.startsWith("drop_test_brute_") && entity.alive
    );

    expect(drops.some((entity) => entity.pickupType === "coin")).toBe(true);
    expect(drops.length).toBeGreaterThanOrEqual(1);
    expect(drops.length).toBeLessThanOrEqual(2);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts -t "spawns controlled drops"
```

Expected: `FAIL` because no drop entities are created on PVE death.

- [ ] **Step 3: Import drop helper**

In `src/game/simulation/state.ts`, add `choosePveDrops` to the existing import from `../content/pve`:

```ts
  choosePveDrops,
```

- [ ] **Step 4: Spawn drops when player kills PVE**

In `damageEntity`, after `awardPveXp(state, entity);`, add:

```ts
  spawnPveDrops(state, entity);
```

Add these helpers near `awardPveXp`:

```ts
const spawnPveDrops = (state: GameState, entity: EntityState) => {
  if (!entity.pveType) {
    return;
  }

  const drops = choosePveDrops(entity.pveType, [Math.random(), Math.random(), Math.random()]);
  for (const [index, pickupType] of drops.entries()) {
    const angle = index * ((Math.PI * 2) / Math.max(1, drops.length)) + 0.35;
    const distance = 18 + index * 9;
    const id = `drop_${entity.id}_${state.nextEntityId}`;
    state.nextEntityId += 1;
    state.entities[id] = createPickup(
      id,
      pickupType,
      entity.x + Math.cos(angle) * distance,
      entity.y + Math.sin(angle) * distance
    );
  }
};
```

- [ ] **Step 5: Run the focused drop test**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts -t "spawns controlled drops"
```

Expected: `PASS`.

- [ ] **Step 6: Run full simulation tests**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts
```

Expected: `PASS`.

- [ ] **Step 7: Commit**

```bash
git add src/game/simulation/state.ts src/game/simulation/simulation.test.ts
git commit -m "feat: drop loot from pve kills"
```

---

### Task 5: Add New PVE Behaviors

**Files:**
- Modify: `src/game/simulation/state.ts`
- Modify: `src/game/simulation/simulation.test.ts`

- [ ] **Step 1: Add failing tests for new PVE types**

In `src/game/simulation/simulation.test.ts`, before the final closing `});`, add:

```ts
  it("starts the match with behavior-distinct expanded PVE threats", () => {
    const state = createInitialGameState();
    const livingPve = Object.values(state.entities).filter((entity) => entity.kind === "pve" && entity.alive);

    expect(livingPve).toHaveLength(11);
    expect(livingPve.some((entity) => entity.pveType === "boar")).toBe(true);
    expect(livingPve.some((entity) => entity.pveType === "spitter")).toBe(true);
    expect(livingPve.some((entity) => entity.pveType === "brute")).toBe(true);
  });

  it("lets spitters fire low-damage PVE projectiles at nearby fighters", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    const spitter = Object.values(state.entities).find((entity) => entity.kind === "pve" && entity.pveType === "spitter");
    expect(spitter).toBeDefined();

    for (const entity of Object.values(state.entities)) {
      if (entity.id !== state.playerId && entity.id !== spitter!.id && entity.kind !== "pickup") {
        entity.alive = false;
      }
    }

    player.x = 650;
    player.y = 500;
    spitter!.x = 500;
    spitter!.y = 500;
    spitter!.fireCooldownMs = 0;
    spitter!.aiThinkMs = 0;

    stepSimulation(state, emptyInput, 80);

    const pveProjectiles = Object.values(state.entities).filter(
      (entity) => entity.kind === "projectile" && entity.ownerId === spitter!.id && entity.alive
    );
    expect(pveProjectiles.length).toBeGreaterThan(0);
    expect(pveProjectiles[0]?.damage).toBe(7);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts -t "PVE"
```

Expected: `FAIL` because new initial monsters and spitter projectile behavior are not implemented.

- [ ] **Step 3: Expand initial PVE spawn list**

In `createInitialGameState`, replace the five current `createPve` calls with:

```ts
  add(createPve("pve_bat_west", "bat", 180, 725));
  add(createPve("pve_bat_east", "bat", 1505, 615));
  add(createPve("pve_bat_north", "bat", 1350, 160));
  add(createPve("pve_slime_center", "slime", 1280, 655));
  add(createPve("pve_slime_southwest", "slime", 700, 805));
  add(createPve("pve_slime_south", "slime", 1040, 870));
  add(createPve("pve_boar_west", "boar", 360, 760));
  add(createPve("pve_boar_northwest", "boar", 650, 245));
  add(createPve("pve_spitter_east", "spitter", 1610, 455));
  add(createPve("pve_spitter_northeast", "spitter", 1405, 285));
  add(createPve("pve_brute_southeast", "brute", 1510, 860));
```

- [ ] **Step 4: Update cooldown ticking for PVE fire cooldown**

`updateCooldowns` already decrements `fireCooldownMs`, so no extra cooldown loop is needed. Confirm the existing block remains:

```ts
if (entity.fireCooldownMs !== undefined) {
  entity.fireCooldownMs = Math.max(0, entity.fireCooldownMs - deltaMs);
}
```

- [ ] **Step 5: Replace `updatePve` with behavior-aware logic**

Replace the existing `updatePve` function with:

```ts
const updatePve = (state: GameState, entities: EntityList, deltaMs: number) => {
  const pveEntities = entities.filter(
    (entity): entity is EntityState => entity.kind === "pve" && entity.alive && Boolean(entity.pveType)
  );

  for (const pve of pveEntities) {
    const definition = PVE_DEFINITIONS[pve.pveType as PveType];
    const target = nearestFighter(entities, pve);

    if ((pve.aiThinkMs ?? 0) <= 0) {
      if (target && distanceBetween(pve, target) < definition.targetRange) {
        pve.aiMoveAngle = Math.atan2(target.y - pve.y, target.x - pve.x);
      } else {
        pve.aiMoveAngle = (pve.aiMoveAngle ?? 0) + (Math.random() - 0.5) * 1.4;
      }
      pve.aiThinkMs = definition.thinkMs;
    }

    if (definition.behavior === "spit" && target) {
      updateSpitterAttack(state, pve, target);
    }

    const speedMultiplier = pveSpeedMultiplier(state, pve, definition, target);
    moveEntity(
      pve,
      Math.cos(pve.aiMoveAngle ?? 0) * (pve.speed ?? 0) * speedMultiplier * (deltaMs / 1_000),
      Math.sin(pve.aiMoveAngle ?? 0) * (pve.speed ?? 0) * speedMultiplier * (deltaMs / 1_000)
    );

    const updatedTarget = nearestFighter(entities, pve);
    if (
      updatedTarget &&
      (pve.touchCooldownMs ?? 0) <= 0 &&
      distanceBetween(pve, updatedTarget) < pve.radius + updatedTarget.radius + 8
    ) {
      if (updatedTarget.kind !== "bot" || state.matchTimeMs > 20_000) {
        damageEntity(state, updatedTarget, definition.touchDamage, pve.id);
      }
      pve.touchCooldownMs = definition.touchCooldownMs;
      const pushAngle = Math.atan2(updatedTarget.y - pve.y, updatedTarget.x - pve.x);
      const pushDistance = definition.behavior === "charge" ? 18 : 10;
      moveEntity(updatedTarget, Math.cos(pushAngle) * pushDistance, Math.sin(pushAngle) * pushDistance);
    }
  }
};
```

- [ ] **Step 6: Add PVE behavior helpers**

Add these helpers after `updatePve`:

```ts
const pveSpeedMultiplier = (
  state: GameState,
  pve: EntityState,
  definition: (typeof PVE_DEFINITIONS)[PveType],
  target: EntityState | undefined
): number => {
  if (definition.behavior === "pulse") {
    return 0.55 + Math.abs(Math.sin(state.matchTimeMs / 260));
  }
  if (definition.behavior === "charge" && target && distanceBetween(pve, target) < 260) {
    return 1.9;
  }
  if (definition.behavior === "spit" && target && distanceBetween(pve, target) < 240) {
    return 0.55;
  }
  return 1;
};

const updateSpitterAttack = (state: GameState, spitter: EntityState, target: EntityState) => {
  if ((spitter.fireCooldownMs ?? 0) > 0 || distanceBetween(spitter, target) > 460) {
    return;
  }

  const angle = Math.atan2(target.y - spitter.y, target.x - spitter.x);
  spitter.aimAngle = angle;
  spitter.fireCooldownMs = 1_350;
  const id = `projectile_${state.nextEntityId}`;
  state.nextEntityId += 1;
  state.entities[id] = {
    id,
    kind: "projectile",
    x: spitter.x + Math.cos(angle) * (spitter.radius + 8),
    y: spitter.y + Math.sin(angle) * (spitter.radius + 8),
    radius: PROJECTILE_RADIUS + 1,
    alive: true,
    vx: Math.cos(angle) * 360,
    vy: Math.sin(angle) * 360,
    damage: 7,
    ownerId: spitter.id,
    distanceLeft: 440,
    ageMs: 0
  };
};
```

- [ ] **Step 7: Prevent PVE projectiles from damaging PVE**

In `updateProjectiles`, replace the hit filter with a call to `canProjectileHit`:

```ts
    const hit = entities.find(
      (entity) =>
        entity.alive &&
        isDamageable(entity) &&
        canProjectileHit(state, projectile, entity) &&
        segmentCircleHit(prevX, prevY, projectile.x, projectile.y, entity.x, entity.y, entity.radius + projectile.radius)
    );
```

Add this helper near `isDamageable`:

```ts
const canProjectileHit = (state: GameState, projectile: EntityState, target: EntityState): boolean => {
  if (target.id === projectile.ownerId) {
    return false;
  }

  const owner = projectile.ownerId ? state.entities[projectile.ownerId] : undefined;
  if (owner?.kind === "pve" && target.kind === "pve") {
    return false;
  }

  return true;
};
```

- [ ] **Step 8: Run focused PVE tests**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts -t "PVE"
```

Expected: `PASS`.

- [ ] **Step 9: Run full simulation tests**

Run:

```bash
npm test -- src/game/simulation/simulation.test.ts
```

Expected: `PASS`.

- [ ] **Step 10: Commit**

```bash
git add src/game/simulation/state.ts src/game/simulation/simulation.test.ts
git commit -m "feat: add expanded pve behaviors"
```

---

### Task 6: Generate And Register New Enemy Assets

**Files:**
- Modify: `tools/generate_pixel_assets.py`
- Modify: `src/game/assets/manifest.ts`
- Modify: `src/game/assets/asset-manifest.test.ts`
- Create: `public/assets/enemies/boar/run.png`
- Create: `public/assets/enemies/boar/charge.png`
- Create: `public/assets/enemies/boar/hurt.png`
- Create: `public/assets/enemies/spitter/idle.png`
- Create: `public/assets/enemies/spitter/spit.png`
- Create: `public/assets/enemies/spitter/hurt.png`
- Create: `public/assets/enemies/brute/walk.png`
- Create: `public/assets/enemies/brute/slam.png`
- Create: `public/assets/enemies/brute/hurt.png`

- [ ] **Step 1: Update asset tests for new enemies**

In `src/game/assets/asset-manifest.test.ts`, replace the import from `./manifest` with:

```ts
import { IMAGE_ASSETS, SPRITESHEET_ASSETS, TextureKey, UI_ASSETS, enemySheetKey } from "./manifest";
```

Then add this test before the final closing `});`:

```ts
  it("includes expanded PVE enemy spritesheets", () => {
    const requiredEnemyAnimations = [
      enemySheetKey("boar", "run"),
      enemySheetKey("boar", "charge"),
      enemySheetKey("boar", "hurt"),
      enemySheetKey("spitter", "idle"),
      enemySheetKey("spitter", "spit"),
      enemySheetKey("spitter", "hurt"),
      enemySheetKey("brute", "walk"),
      enemySheetKey("brute", "slam"),
      enemySheetKey("brute", "hurt")
    ];

    for (const key of requiredEnemyAnimations) {
      const asset = SPRITESHEET_ASSETS.find((item) => item.key === key);
      expect(asset, key).toBeDefined();
      if (!asset) {
        throw new Error(`Missing enemy asset ${key}`);
      }
      const info = readPngInfo(asset.path);
      expect(info.width, key).toBe(asset.frameWidth * asset.frames);
      expect(info.height, key).toBe(asset.frameHeight);
      expect(hasAlpha(info), key).toBe(true);
    }
  });
```

- [ ] **Step 2: Run asset tests to verify manifest is missing new assets**

Run:

```bash
npm test -- src/game/assets/asset-manifest.test.ts
```

Expected: `FAIL` because new manifest keys and files are not present.

- [ ] **Step 3: Register new enemy IDs and animation IDs**

In `src/game/assets/manifest.ts`, add this import at the top:

```ts
import { PICKUP_TYPES } from "../content/pickups";
```

Replace:

```ts
export type EnemyId = "bat" | "slime";
export type EnemyAnimationId = "fly" | "dash" | "hurt" | "idle" | "hop" | "squash";
```

with:

```ts
export type EnemyId = "bat" | "slime" | "boar" | "spitter" | "brute";
export type EnemyAnimationId =
  | "fly"
  | "dash"
  | "hurt"
  | "idle"
  | "hop"
  | "squash"
  | "run"
  | "charge"
  | "spit"
  | "walk"
  | "slam";
```

Replace the `enemyFrames` object with:

```ts
const enemyFrames: Record<string, number> = {
  "bat-fly": 6,
  "bat-dash": 4,
  "bat-hurt": 3,
  "slime-idle": 4,
  "slime-hop": 6,
  "slime-squash": 3,
  "boar-run": 6,
  "boar-charge": 4,
  "boar-hurt": 3,
  "spitter-idle": 4,
  "spitter-spit": 4,
  "spitter-hurt": 3,
  "brute-walk": 6,
  "brute-slam": 4,
  "brute-hurt": 3
};
```

Replace:

```ts
const pickupTypes = ["ammo", "medkit", "shield", "rifle", "shotgun", "coin"] as const;
```

with:

```ts
const pickupTypes = PICKUP_TYPES;
```

- [ ] **Step 4: Add new enemy output directories**

In `tools/generate_pixel_assets.py`, update `ensure_dirs()` by adding:

```python
        "enemies/boar",
        "enemies/spitter",
        "enemies/brute",
```

- [ ] **Step 5: Add generator helpers for new enemies**

In `tools/generate_pixel_assets.py`, after the existing `generate_enemies()` function, add:

```python
def draw_boar_frame(draw: ImageDraw.ImageDraw, frame: int, animation: str) -> None:
    charge = 7 if animation == "charge" and frame in {1, 2} else 0
    hurt = 3 if animation == "hurt" and frame % 2 else 0
    bob = int(math.sin(frame * 1.5) * 2)
    draw.ellipse((20, 70, 76, 82), fill=rgba("#0b0c0d", 80))
    draw.rounded_rectangle((23 + charge + hurt, 43 + bob, 75 + charge + hurt, 68 + bob), radius=11, fill=rgba("#7d4a2c"))
    draw.rounded_rectangle((17 + charge + hurt, 36 + bob, 46 + charge + hurt, 58 + bob), radius=9, fill=rgba("#9b6438"))
    draw.polygon([(19 + charge + hurt, 42 + bob), (8 + charge + hurt, 37 + bob), (18 + charge + hurt, 50 + bob)], fill=rgba("#e9d2a0"))
    draw.polygon([(39 + charge + hurt, 42 + bob), (51 + charge + hurt, 37 + bob), (42 + charge + hurt, 50 + bob)], fill=rgba("#e9d2a0"))
    draw.rectangle((26 + charge + hurt, 45 + bob, 31 + charge + hurt, 50 + bob), fill=rgba("#111111"))
    draw.rectangle((41 + charge + hurt, 45 + bob, 46 + charge + hurt, 50 + bob), fill=rgba("#111111"))
    for x in [31, 45, 58, 70]:
        step = int(math.sin(frame * 2 + x) * 4) if animation in {"run", "charge"} else 0
        draw.rectangle((x + charge + hurt, 64 + bob, x + 5 + charge + hurt, 78 + bob + step), fill=rgba("#50311f"))
    if animation == "hurt":
        draw.line((22, 36, 74, 68), fill=rgba("#ff564a", 190), width=3)


def draw_spitter_frame(draw: ImageDraw.ImageDraw, frame: int, animation: str) -> None:
    spit = 8 if animation == "spit" and frame in {1, 2} else 0
    hurt = 3 if animation == "hurt" and frame % 2 else 0
    bob = int(math.sin(frame * 1.1) * 2)
    draw.ellipse((24, 70, 72, 82), fill=rgba("#0b0c0d", 80))
    draw.rounded_rectangle((26 + hurt, 40 + bob, 70 + hurt, 70 + bob), radius=13, fill=rgba("#2f8f66"))
    draw.rounded_rectangle((30 + hurt, 32 + bob, 62 + hurt, 55 + bob), radius=12, fill=rgba("#58c98e"))
    draw.rectangle((35 + hurt, 43 + bob, 40 + hurt, 48 + bob), fill=rgba("#10251c"))
    draw.rectangle((52 + hurt, 43 + bob, 57 + hurt, 48 + bob), fill=rgba("#10251c"))
    draw.ellipse((60 + hurt, 45 + bob, 82 + hurt + spit, 58 + bob), fill=rgba("#6cf0a8"))
    if animation == "spit" and frame in {1, 2}:
        draw.ellipse((82 + hurt + spit, 47 + bob, 92 + hurt + spit, 55 + bob), fill=rgba("#b6ffd2"))
    if animation == "hurt":
        draw.line((27, 34, 70, 66), fill=rgba("#ff564a", 190), width=3)


def draw_brute_frame(draw: ImageDraw.ImageDraw, frame: int, animation: str) -> None:
    slam = 8 if animation == "slam" and frame in {1, 2} else 0
    hurt = 4 if animation == "hurt" and frame % 2 else 0
    bob = int(math.sin(frame * 1.0) * 2)
    draw.ellipse((18, 72, 80, 85), fill=rgba("#0b0c0d", 90))
    draw.rounded_rectangle((25 + hurt, 34 + bob + slam, 72 + hurt, 72 + bob), radius=12, fill=rgba("#4e5360"))
    draw.rounded_rectangle((32 + hurt, 24 + bob + slam, 63 + hurt, 47 + bob + slam), radius=10, fill=rgba("#7d8795"))
    draw.rectangle((37 + hurt, 35 + bob + slam, 43 + hurt, 41 + bob + slam), fill=rgba("#ffde6a"))
    draw.rectangle((53 + hurt, 35 + bob + slam, 59 + hurt, 41 + bob + slam), fill=rgba("#ffde6a"))
    draw.rectangle((15 + hurt, 44 + bob + slam, 28 + hurt, 70 + bob), fill=rgba("#373c47"))
    draw.rectangle((69 + hurt, 44 + bob + slam, 82 + hurt, 70 + bob), fill=rgba("#373c47"))
    for x in [33, 57]:
        step = int(math.sin(frame * 1.7 + x) * 3) if animation == "walk" else 0
        draw.rectangle((x + hurt, 68 + bob, x + 11 + hurt, 84 + bob + step), fill=rgba("#2b3039"))
    if animation == "hurt":
        draw.line((23, 30, 76, 70), fill=rgba("#ff564a", 190), width=3)


def make_enemy_sheet(frames: int, animation: str, draw_frame) -> Image.Image:
    sheet = Image.new("RGBA", (96 * frames, 96), (0, 0, 0, 0))
    for frame in range(frames):
        image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        draw_frame(ImageDraw.Draw(image), frame, animation)
        sheet.alpha_composite(image, (frame * 96, 0))
    return sheet


def generate_extra_enemies() -> None:
    for animation, frames in {"run": 6, "charge": 4, "hurt": 3}.items():
        save(make_enemy_sheet(frames, animation, draw_boar_frame), f"enemies/boar/{animation}.png")
    for animation, frames in {"idle": 4, "spit": 4, "hurt": 3}.items():
        save(make_enemy_sheet(frames, animation, draw_spitter_frame), f"enemies/spitter/{animation}.png")
    for animation, frames in {"walk": 6, "slam": 4, "hurt": 3}.items():
        save(make_enemy_sheet(frames, animation, draw_brute_frame), f"enemies/brute/{animation}.png")
```

- [ ] **Step 6: Call the new generator**

In `main()`, add `generate_extra_enemies()` immediately after `generate_enemies()`:

```python
    generate_enemies()
    generate_extra_enemies()
```

- [ ] **Step 7: Generate assets**

Run:

```bash
python3 tools/generate_pixel_assets.py
```

Expected: the nine new enemy PNG files are created under `public/assets/enemies`.

- [ ] **Step 8: Run asset manifest tests**

Run:

```bash
npm test -- src/game/assets/asset-manifest.test.ts
```

Expected: `PASS`.

- [ ] **Step 9: Commit**

```bash
git add tools/generate_pixel_assets.py src/game/assets/manifest.ts src/game/assets/asset-manifest.test.ts public/assets/enemies/boar public/assets/enemies/spitter public/assets/enemies/brute
git commit -m "feat: add expanded pve assets"
```

---

### Task 7: Render New PVE Types In Phaser

**Files:**
- Modify: `src/phaser/scenes/BattleScene.ts`

- [ ] **Step 1: Replace hard-coded enemy animation list**

In `BattleScene.createAnimations`, replace the enemy animation tuple array with:

```ts
    for (const [id, animation] of [
      ["bat", "fly"],
      ["bat", "dash"],
      ["bat", "hurt"],
      ["slime", "idle"],
      ["slime", "hop"],
      ["slime", "squash"],
      ["boar", "run"],
      ["boar", "charge"],
      ["boar", "hurt"],
      ["spitter", "idle"],
      ["spitter", "spit"],
      ["spitter", "hurt"],
      ["brute", "walk"],
      ["brute", "slam"],
      ["brute", "hurt"]
    ] as [EnemyId, EnemyAnimationId][]) {
      this.createLoopingAnimation(enemySheetKey(id, animation), animation === "dash" || animation === "charge" ? 10 : 7);
    }
```

- [ ] **Step 2: Add enemy animation mapping helpers**

Add these methods near `animationForFighter`:

```ts
  private animationForPve(entity: EntityState) {
    switch (entity.pveType) {
      case "slime":
        return enemySheetKey("slime", "hop");
      case "boar":
        return enemySheetKey("boar", "run");
      case "spitter":
        return (entity.fireCooldownMs ?? 0) > 900 ? enemySheetKey("spitter", "spit") : enemySheetKey("spitter", "idle");
      case "brute":
        return enemySheetKey("brute", "walk");
      case "bat":
      default:
        return enemySheetKey("bat", "fly");
    }
  }

  private textureForPve(entity: EntityState) {
    switch (entity.pveType) {
      case "slime":
        return enemySheetKey("slime", "idle");
      case "boar":
        return enemySheetKey("boar", "run");
      case "spitter":
        return enemySheetKey("spitter", "idle");
      case "brute":
        return enemySheetKey("brute", "walk");
      case "bat":
      default:
        return enemySheetKey("bat", "fly");
    }
  }

  private scaleForPve(entity: EntityState) {
    switch (entity.pveType) {
      case "brute":
        return 0.9;
      case "boar":
        return 0.82;
      case "spitter":
        return 0.76;
      default:
        return 0.78;
    }
  }
```

- [ ] **Step 3: Use mapping helpers when creating PVE views**

In `createEntityView`, replace:

```ts
    if (entity.kind === "pve") {
      const animation = entity.pveType === "slime" ? enemySheetKey("slime", "hop") : enemySheetKey("bat", "fly");
      this.playEntityAnimation(view, animation);
      sprite.setScale(0.78);
    }
```

with:

```ts
    if (entity.kind === "pve") {
      this.playEntityAnimation(view, this.animationForPve(entity));
      sprite.setScale(this.scaleForPve(entity));
    }
```

- [ ] **Step 4: Keep PVE animation current during updates**

In `updateEntityView`, replace:

```ts
    } else if (entity.kind === "pve") {
      view.sprite.setFlipX(Math.sin(this.time.now / 500 + entity.x) < 0);
```

with:

```ts
    } else if (entity.kind === "pve") {
      this.playEntityAnimation(view, this.animationForPve(entity));
      if (entity.aimAngle !== undefined) {
        view.sprite.setFlipX(Math.cos(entity.aimAngle) < 0);
      } else {
        view.sprite.setFlipX(Math.sin(this.time.now / 500 + entity.x) < 0);
      }
```

- [ ] **Step 5: Use mapping helper for PVE texture**

In `textureForEntity`, replace:

```ts
    if (entity.kind === "pve") {
      return entity.pveType === "slime" ? enemySheetKey("slime", "idle") : enemySheetKey("bat", "fly");
    }
```

with:

```ts
    if (entity.kind === "pve") {
      return this.textureForPve(entity);
    }
```

- [ ] **Step 6: Give level-up events a larger ring effect**

In `spawnEventFx`, replace:

```ts
    const animationKey =
      event.type === "pickup" ? "fx-pickup-ring" : event.type === "shoot" ? "fx-muzzle-flash" : TextureKey.Spark;
```

with:

```ts
    const animationKey =
      event.type === "pickup" || event.type === "level-up"
        ? "fx-pickup-ring"
        : event.type === "shoot"
          ? "fx-muzzle-flash"
          : TextureKey.Spark;
```

After `effect.setDepth(85);`, add:

```ts
    if (event.type === "level-up") {
      effect.setScale(1.45);
      effect.setTint(0xffe66d);
    }
```

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: `PASS`.

- [ ] **Step 8: Commit**

```bash
git add src/phaser/scenes/BattleScene.ts
git commit -m "feat: render expanded pve types"
```

---

### Task 8: Add Progression HUD

**Files:**
- Modify: `src/ui/hud/HudController.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Render progression HUD**

In `HudController.render`, after the `.hud-top-right` block, add:

```ts
      <div class="progression-pill ${hudOcclusion.topRight ? "is-occluding" : ""}">
        <strong>LV ${state.progression.level}</strong>
        <span>${state.progression.totalXp} XP</span>
        <i>
          <b style="width:${this.progressPercent(state)}%"></b>
        </i>
      </div>
```

- [ ] **Step 2: Add progression percent helper**

After `percent`, add:

```ts
  private progressPercent(state: GameState) {
    if (state.progression.xpToNext <= 0) {
      return 100;
    }
    return Math.max(0, Math.min(100, (state.progression.xp / state.progression.xpToNext) * 100));
  }
```

- [ ] **Step 3: Include progression in HUD snapshot**

In `createSnapshot`, add these entries before `entitySnapshot`:

```ts
      state.progression.level,
      state.progression.xp,
      state.progression.xpToNext,
      state.progression.totalXp,
```

- [ ] **Step 4: Add CSS for progression HUD**

In `src/styles.css`, add this block near the existing top HUD styles:

```css
.progression-pill {
  position: absolute;
  top: 64px;
  right: 24px;
  width: 158px;
  min-height: 48px;
  padding: 8px 11px;
  border: 2px solid rgba(255, 255, 255, 0.24);
  border-radius: 8px;
  background: rgba(17, 18, 24, 0.74);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.28);
  color: #f7ffe8;
  font-family: "Trebuchet MS", system-ui, sans-serif;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.progression-pill strong,
.progression-pill span {
  display: block;
  line-height: 1;
}

.progression-pill strong {
  font-size: 16px;
  letter-spacing: 0;
}

.progression-pill span {
  margin-top: 4px;
  color: #c9e9ff;
  font-size: 12px;
}

.progression-pill i {
  display: block;
  overflow: hidden;
  width: 100%;
  height: 6px;
  margin-top: 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
}

.progression-pill b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8eff78, #ffe66d);
}
```

- [ ] **Step 5: Run typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hud/HudController.ts src/styles.css
git commit -m "feat: show pve progression hud"
```

---

### Task 9: Full Verification And Browser Acceptance

**Files:**
- No source edits expected unless verification finds a concrete defect.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts and prints a local URL, usually `http://localhost:5173/`.

- [ ] **Step 3: Browser smoke test**

Open the local URL in the in-app browser and verify:

- The match loads without console errors.
- HUD shows `LV 1` and an XP bar.
- Minimap shows expanded PVE count.
- New enemies render with distinct silhouettes.
- Killing a weak PVE enemy increases XP.
- Killing enough PVE enemies levels the player up.
- A killed `brute` drops at least a coin.
- Existing movement, shooting, pickup collection, storm damage, and win/loss states still work.

- [ ] **Step 4: Capture acceptance screenshot**

Save one screenshot after a level-up to:

```text
output/monster-progression-acceptance.png
```

- [ ] **Step 5: Leave screenshot untracked and report its path**

Do not commit `output/monster-progression-acceptance.png` in this implementation branch. Mention the screenshot path in the final implementation summary.

---

## Self-Review Checklist

- Spec coverage: progression state, XP thresholds, bounded level cap, small health and damage growth, controlled drops, three new PVE types, HUD, asset manifest, tests, and browser verification are covered by Tasks 1 through 9.
- Scope control: full equipment, rarity, backpack UI, permanent progression, infinite spawning, and Boss events are excluded from this plan.
- Type consistency: `PveType` is owned by `src/game/content/pve.ts`; `PickupType` is owned by `src/game/content/pickups.ts`; `GameState.progression` is read by HUD and written only by simulation.
- Test coverage: content tests cover tuning data; simulation tests cover rewards, drops, damage bonus, and PVE behavior; asset manifest tests cover sprite availability.
- Commit granularity: every task ends with a focused commit containing only files for that task.
