import { describe, expect, it } from "vitest";
import { createInitialGameState, stepSimulation } from "./state";
import type { InputFrame } from "../input/actions";

const emptyInput: InputFrame = {
  moveX: 0,
  moveY: 0,
  aimX: 960,
  aimY: 540,
  shooting: false,
  selectedSlot: 1,
  useItem: false
};

const requireEntity = (state: ReturnType<typeof createInitialGameState>, id: string) => {
  const entity = state.entities[id];
  if (!entity) {
    throw new Error(`Missing entity ${id}`);
  }
  return entity;
};

describe("battle royale simulation", () => {
  it("shrinks the storm and damages living fighters outside the safe circle", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    for (const entity of Object.values(state.entities)) {
      if (entity.id !== state.playerId && entity.kind !== "pickup") {
        entity.alive = false;
      }
    }
    const passiveBot = Object.values(state.entities).find((entity) => entity.kind === "bot");
    expect(passiveBot).toBeDefined();
    passiveBot!.alive = true;
    passiveBot!.x = 960;
    passiveBot!.y = 540;
    passiveBot!.fireCooldownMs = 90_000;
    player.x = 80;
    player.y = 80;
    const healthBefore = player.health ?? 0;

    stepSimulation(state, emptyInput, 46_000);

    expect(state.storm.radius).toBeLessThan(state.storm.initialRadius);
    expect(player.health ?? 0).toBeLessThan(healthBefore);
  });

  it("creates projectiles from the selected weapon and resolves hits against bots", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    const bot = Object.values(state.entities).find((entity) => entity.kind === "bot");
    expect(bot).toBeDefined();
    for (const entity of Object.values(state.entities)) {
      if (entity.id !== state.playerId && entity.id !== bot!.id && entity.kind !== "pickup") {
        entity.alive = false;
      }
    }
    player.x = 500;
    player.y = 500;
    bot!.x = 610;
    bot!.y = 500;
    const botHealthBefore = bot!.health ?? 0;

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

    expect(bot!.health ?? 0).toBeLessThan(botHealthBefore);
    expect(state.scoreboard.shotsFired).toBeGreaterThan(0);
  });

  it("adds nearby pickups to inventory and applies healing items", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    player.health = 42;
    player.x = 720;
    player.y = 520;
    state.entities.test_medkit = {
      id: "test_medkit",
      kind: "pickup",
      pickupType: "medkit",
      x: 724,
      y: 522,
      radius: 18,
      alive: true
    };

    stepSimulation(state, emptyInput, 80);
    expect(state.inventory.medkits).toBeGreaterThan(1);

    stepSimulation(state, { ...emptyInput, selectedSlot: 5, useItem: true }, 80);
    expect(player.health).toBeGreaterThan(42);
    expect(state.inventory.medkits).toBeGreaterThanOrEqual(1);
  });

  it("lets bots choose weak targets and finish the match when all enemy fighters fall", () => {
    const state = createInitialGameState();
    const player = requireEntity(state, state.playerId);
    player.x = 930;
    player.y = 530;
    player.health = 28;
    player.shield = 0;

    const bots = Object.values(state.entities).filter((entity) => entity.kind === "bot");
    for (const [index, bot] of bots.entries()) {
      bot.x = index === 0 ? 990 : 1_360 + index * 60;
      bot.y = index === 0 ? 530 : 760;
      bot.health = 100;
      bot.fireCooldownMs = index === 0 ? 0 : 10_000;
      bot.aiThinkMs = 10_000;
      bot.aiTargetId = index === 0 ? player.id : undefined;
      bot.aiMoveAngle = Math.PI;
    }
    state.matchTimeMs = 31_000;
    state.storm.elapsedMs = 31_000;

    stepSimulation(state, emptyInput, 1_200);

    expect(player.health ?? 0).toBeLessThan(28);

    player.alive = true;
    player.health = 10;
    state.phase = "playing";
    for (const bot of bots) {
      bot.health = 0;
      bot.alive = false;
    }
    stepSimulation(state, emptyInput, 80);

    expect(state.phase).toBe("won");
  });
});
