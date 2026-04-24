import Phaser from "phaser";
import {
  IMAGE_ASSETS,
  SPRITESHEET_ASSETS,
  TextureKey,
  UI_ASSETS,
  characterSheetKey,
  enemySheetKey,
  pickupGlowKey,
  type CharacterAnimationId,
  type CharacterId,
  type EnemyAnimationId,
  type EnemyId
} from "../../game/assets/manifest";
import { MAP_FEATURES, WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import { createEmptyInputFrame, type InputFrame } from "../../game/input/actions";
import {
  createInitialGameState,
  stepSimulation,
  type EntityState,
  type GameEvent,
  type GameState,
  type PickupType
} from "../../game/simulation/state";
import { HudController } from "../../ui/hud/HudController";

declare global {
  interface Window {
    __battleState?: GameState;
  }
}

interface EntityView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Text;
  bar?: Phaser.GameObjects.Graphics;
  lastX: number;
  lastY: number;
  lastHealth: number;
  currentAnimation?: string;
}

interface ControlKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  arrowUp: Phaser.Input.Keyboard.Key;
  arrowDown: Phaser.Input.Keyboard.Key;
  arrowLeft: Phaser.Input.Keyboard.Key;
  arrowRight: Phaser.Input.Keyboard.Key;
  slot1: Phaser.Input.Keyboard.Key;
  slot2: Phaser.Input.Keyboard.Key;
  slot3: Phaser.Input.Keyboard.Key;
  slot4: Phaser.Input.Keyboard.Key;
  slot5: Phaser.Input.Keyboard.Key;
  use: Phaser.Input.Keyboard.Key;
  restart: Phaser.Input.Keyboard.Key;
}

const TILE_SIZE = 32;

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private hud!: HudController;
  private keys!: ControlKeys;
  private entityViews = new Map<string, EntityView>();
  private stormLayer!: Phaser.GameObjects.Graphics;
  private stormOverlay!: Phaser.GameObjects.TileSprite;
  private stormArcs: Phaser.GameObjects.Sprite[] = [];
  private selectedSlot = 1;
  private useItemQueued = false;
  private lastEventId = 0;

  constructor() {
    super("BattleScene");
  }

  preload() {
    for (const asset of IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of UI_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of SPRITESHEET_ASSETS) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        endFrame: asset.frames - 1
      });
    }
  }

  create() {
    this.state = createInitialGameState();
    this.hud = new HudController(document.getElementById("hud-root"));
    this.createAnimations();
    this.createMap();
    this.createInput();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.scale.on("resize", () => this.hud.update(this.state));
    this.hud.update(this.state);
    window.__battleState = this.state;
  }

  update(_time: number, delta: number) {
    const input = this.collectInput();
    stepSimulation(this.state, input, Math.min(delta, 16.67));
    window.__battleState = this.state;
    this.renderStorm();
    this.renderEntities();
    this.renderEvents();
    this.hud.update(this.state);
  }

  private createInput() {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable");
    }

    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      arrowUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      arrowDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      arrowLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      slot1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      slot2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      slot3: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      slot4: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      slot5: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      use: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    };

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.useItemQueued = true;
      }
    });
  }

  private collectInput(): InputFrame {
    if (Phaser.Input.Keyboard.JustDown(this.keys.slot1)) {
      this.selectedSlot = 1;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.slot2)) {
      this.selectedSlot = 2;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.slot3)) {
      this.selectedSlot = 3;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.slot4)) {
      this.selectedSlot = 4;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.slot5)) {
      this.selectedSlot = 5;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.use)) {
      this.useItemQueued = true;
    }
    if (this.state.phase !== "playing" && Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.restartMatch();
    }

    const pointer = this.input.activePointer;
    const frame = createEmptyInputFrame();
    frame.moveX =
      (this.keys.right.isDown || this.keys.arrowRight.isDown ? 1 : 0) -
      (this.keys.left.isDown || this.keys.arrowLeft.isDown ? 1 : 0);
    frame.moveY =
      (this.keys.down.isDown || this.keys.arrowDown.isDown ? 1 : 0) -
      (this.keys.up.isDown || this.keys.arrowUp.isDown ? 1 : 0);
    frame.aimX = pointer.worldX;
    frame.aimY = pointer.worldY;
    frame.shooting = pointer.isDown && !pointer.rightButtonDown() && this.selectedSlot <= 3;
    frame.selectedSlot = this.selectedSlot;
    frame.useItem = this.useItemQueued || (pointer.isDown && pointer.rightButtonDown());
    this.useItemQueued = false;
    return frame;
  }

  private restartMatch() {
    for (const view of this.entityViews.values()) {
      view.container.destroy(true);
    }
    this.entityViews.clear();
    this.state = createInitialGameState();
    this.selectedSlot = 1;
    this.lastEventId = 0;
  }

  private createAnimations() {
    for (const id of ["rogue", "samurai", "ninja", "cowboy", "mage"] as const) {
      for (const animation of ["idle", "walk", "shoot", "hurt"] as const) {
        this.createLoopingAnimation(characterSheetKey(id, animation), animation === "walk" ? 9 : 7);
      }
    }
    for (const [id, animation] of [
      ["bat", "fly"],
      ["bat", "dash"],
      ["bat", "hurt"],
      ["slime", "idle"],
      ["slime", "hop"],
      ["slime", "squash"]
    ] as [EnemyId, EnemyAnimationId][]) {
      this.createLoopingAnimation(enemySheetKey(id, animation), animation === "dash" ? 10 : 7);
    }
    for (const id of ["ammo", "medkit", "shield", "rifle", "shotgun", "coin"] as const) {
      this.createLoopingAnimation(pickupGlowKey(id), 6);
    }
    for (const key of ["fx-muzzle-flash", TextureKey.Spark, "fx-pickup-ring", "fx-storm-arc"]) {
      this.createLoopingAnimation(key, 12);
    }
  }

  private createLoopingAnimation(key: string, frameRate: number) {
    const texture = this.textures.get(key);
    const frameTotal = texture.frameTotal - 1;
    if (this.anims.exists(key) || frameTotal <= 0) {
      return;
    }
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(key, { start: 0, end: frameTotal - 1 }),
      frameRate,
      repeat: -1
    });
  }

  private createMap() {
    this.createGroundLayer();
    this.createPropLayer();
    this.createStormLayer();
  }

  private createGroundLayer() {
    this.add.image(0, 0, TextureKey.ArenaGround).setOrigin(0, 0).setDepth(0);
  }

  private createPropLayer() {
    for (const feature of MAP_FEATURES) {
      if (feature.kind === "water") {
        continue;
      }
      if (feature.kind === "bush") {
        this.createFoliageCluster(feature.x, feature.y, feature.width, feature.height);
        continue;
      }
      if (feature.kind === "crate") {
        this.add.image(feature.x + feature.width / 2, feature.y + feature.height / 2, TextureKey.Crate).setDepth(25);
        continue;
      }
      if (feature.kind === "barrel") {
        this.add.image(feature.x + feature.width / 2, feature.y + feature.height / 2, TextureKey.Barrel).setDepth(25);
        continue;
      }
      this.createRuin(feature.x, feature.y, feature.width, feature.height);
    }

    this.add.image(690, 100, TextureKey.Chest).setDepth(25);
    this.add.image(1_520, 940, TextureKey.Crate).setDepth(25);
    this.add.image(1_565, 910, TextureKey.Crate).setDepth(25);
    this.add.image(630, 780, TextureKey.Crate).setDepth(25);
  }

  private createRuin(x: number, y: number, width: number, height: number) {
    const cols = Math.max(1, Math.ceil(width / TILE_SIZE));
    const rows = Math.max(1, Math.ceil(height / TILE_SIZE));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const frame = row === 0 || col === 0 || row === rows - 1 || col === cols - 1 ? (col + row) % 4 : 4 + ((col + row) % 4);
        const tile = this.add.image(x + col * TILE_SIZE, y + row * TILE_SIZE, TextureKey.RuinsTiles, frame);
        tile.setOrigin(0, 0);
        tile.setDepth(18 + (y + row * TILE_SIZE) / 10_000);
      }
    }
  }

  private createFoliageCluster(x: number, y: number, width: number, height: number) {
    const count = Math.max(8, Math.floor((width * height) / 1_400));
    for (let index = 0; index < count; index += 1) {
      const px = x + ((index * 37) % Math.max(1, width));
      const py = y + ((index * 29) % Math.max(1, height));
      const sprite = this.add.image(px, py, TextureKey.FoliageTiles, index % 8);
      sprite.setDepth(20 + py / 10_000);
      sprite.setScale(1.35 + (index % 3) * 0.15);
    }
  }

  private createStormLayer() {
    this.stormOverlay = this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, "fx-storm-overlay");
    this.stormOverlay.setDepth(90);
    this.stormOverlay.setAlpha(0.35);
    this.stormLayer = this.add.graphics();
    this.stormLayer.setDepth(91);
    for (let index = 0; index < 14; index += 1) {
      const arc = this.add.sprite(0, 0, "fx-storm-arc");
      arc.play("fx-storm-arc");
      arc.setDepth(92);
      arc.setAlpha(0.86);
      this.stormArcs.push(arc);
    }
  }

  private renderStorm() {
    this.stormLayer.clear();
    this.stormOverlay.tilePositionX += 0.25;
    this.stormOverlay.tilePositionY -= 0.18;
    this.stormOverlay.setAlpha(0.05 + Math.abs(Math.sin(this.time.now / 420)) * 0.04);

    const pulse = 0.12 + Math.abs(Math.sin(this.time.now / 210)) * 0.08;
    this.stormLayer.lineStyle(900, 0x5728a8, 0.28);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius + 450);
    this.stormLayer.lineStyle(8, 0xf4ecff, 0.95);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius);
    this.stormLayer.lineStyle(16, 0xa75cff, pulse);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius + 5);

    for (let index = 0; index < this.stormArcs.length; index += 1) {
      const arc = this.stormArcs[index];
      if (!arc) {
        continue;
      }
      const angle = index * 0.45 + this.time.now / 640;
      const radius = this.state.storm.radius + 10 + (index % 3) * 7;
      arc.setPosition(
        this.state.storm.centerX + Math.cos(angle) * radius,
        this.state.storm.centerY + Math.sin(angle) * radius
      );
      arc.setRotation(angle + Math.PI / 2);
      arc.setScale(0.95 + (index % 3) * 0.16);
    }
  }

  private renderEntities() {
    const liveIds = new Set<string>();

    for (const entity of Object.values(this.state.entities)) {
      if (!entity.alive) {
        continue;
      }
      liveIds.add(entity.id);
      const view = this.entityViews.get(entity.id) ?? this.createEntityView(entity);
      this.updateEntityView(entity, view);
    }

    for (const [id, view] of this.entityViews.entries()) {
      if (!liveIds.has(id)) {
        view.container.destroy(true);
        this.entityViews.delete(id);
      }
    }
  }

  private createEntityView(entity: EntityState): EntityView {
    const texture = this.textureForEntity(entity);
    const sprite = this.add.sprite(0, 0, texture);
    sprite.setOrigin(0.5, 0.72);
    const container = this.add.container(entity.x, entity.y, [sprite]);
    container.setDepth(this.depthForEntity(entity));

    const view: EntityView = {
      container,
      sprite,
      lastX: entity.x,
      lastY: entity.y,
      lastHealth: entity.health ?? 0
    };
    if (entity.kind === "pickup" && entity.pickupType) {
      this.playEntityAnimation(view, pickupGlowKey(entity.pickupType));
      sprite.setScale(0.9);
    }
    if (entity.kind === "pve") {
      const animation = entity.pveType === "slime" ? enemySheetKey("slime", "hop") : enemySheetKey("bat", "fly");
      this.playEntityAnimation(view, animation);
      sprite.setScale(0.78);
    }
    if (entity.kind === "player" || entity.kind === "bot") {
      sprite.setScale(0.72);
      const label = this.add.text(0, -54, entity.label ?? "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#f8ffe7",
        stroke: "#172019",
        strokeThickness: 4
      });
      label.setOrigin(0.5, 1);
      const bar = this.add.graphics();
      container.add([label, bar]);
      view.label = label;
      view.bar = bar;
    }

    this.entityViews.set(entity.id, view);
    return view;
  }

  private updateEntityView(entity: EntityState, view: EntityView) {
    view.container.setPosition(entity.x, entity.y);
    view.container.setDepth(this.depthForEntity(entity) + entity.y / 10_000);

    if (entity.kind === "projectile") {
      view.sprite.setRotation(Math.atan2(entity.vy ?? 0, entity.vx ?? 1));
    } else if (entity.kind === "pve") {
      view.sprite.setFlipX(Math.sin(this.time.now / 500 + entity.x) < 0);
    } else if (entity.kind === "player" || entity.kind === "bot") {
      const dx = entity.x - view.lastX;
      const dy = entity.y - view.lastY;
      const moved = Math.hypot(dx, dy) > 0.8;
      const hurt = (entity.health ?? 0) < view.lastHealth;
      const shooting = (entity.fireCooldownMs ?? 0) > 0 && (entity.fireCooldownMs ?? 0) < 180;
      const animation = this.animationForFighter(entity, hurt ? "hurt" : shooting ? "shoot" : moved ? "walk" : "idle");
      this.playEntityAnimation(view, animation);
      if (entity.aimAngle !== undefined) {
        view.sprite.setFlipX(Math.cos(entity.aimAngle) < 0);
      }
    }

    if (view.bar) {
      this.renderHealthBar(view.bar, entity);
    }

    view.lastX = entity.x;
    view.lastY = entity.y;
    view.lastHealth = entity.health ?? view.lastHealth;
  }

  private playEntityAnimation(view: EntityView, animationKey: string) {
    if (view.currentAnimation === animationKey) {
      return;
    }
    view.sprite.play(animationKey, true);
    view.currentAnimation = animationKey;
  }

  private animationForFighter(entity: EntityState, animation: CharacterAnimationId) {
    const role = (entity.role ?? "rogue") as CharacterId;
    return characterSheetKey(role, animation);
  }

  private renderHealthBar(graphics: Phaser.GameObjects.Graphics, entity: EntityState) {
    const width = 58;
    const healthRatio = Math.max(0, Math.min(1, (entity.health ?? 0) / (entity.maxHealth ?? 100)));
    const shieldRatio = Math.max(0, Math.min(1, (entity.shield ?? 0) / 60));
    graphics.clear();
    graphics.fillStyle(0x121712, 0.92);
    graphics.fillRoundedRect(-width / 2, -42, width, 9, 2);
    graphics.fillStyle(0x80e05c, 1);
    graphics.fillRoundedRect(-width / 2 + 2, -40, (width - 4) * healthRatio, 5, 1);
    if (shieldRatio > 0) {
      graphics.fillStyle(0x62c8ff, 1);
      graphics.fillRoundedRect(-width / 2 + 2, -34, (width - 4) * shieldRatio, 3, 1);
    }
  }

  private renderEvents() {
    const events = this.state.events.filter((event) => event.id > this.lastEventId);
    for (const event of events) {
      this.spawnEventFx(event);
      this.lastEventId = Math.max(this.lastEventId, event.id);
    }
  }

  private spawnEventFx(event: GameEvent) {
    const animationKey =
      event.type === "pickup" ? "fx-pickup-ring" : event.type === "shoot" ? "fx-muzzle-flash" : TextureKey.Spark;
    const effect = this.add.sprite(event.x, event.y, animationKey);
    effect.setDepth(85);
    effect.play(animationKey);
    effect.once(Phaser.Animations.Events.ANIMATION_REPEAT, () => effect.destroy());
    this.tweens.add({
      targets: effect,
      alpha: 0,
      duration: event.type === "pickup" ? 520 : 280,
      delay: event.type === "pickup" ? 120 : 80,
      onComplete: () => effect.destroy()
    });
  }

  private textureForEntity(entity: EntityState): string {
    if (entity.kind === "projectile") {
      return TextureKey.Projectile;
    }
    if (entity.kind === "pve") {
      return entity.pveType === "slime" ? enemySheetKey("slime", "idle") : enemySheetKey("bat", "fly");
    }
    if (entity.kind === "pickup") {
      return pickupGlowKey((entity.pickupType ?? "coin") as PickupType);
    }
    return this.animationForFighter(entity, "idle");
  }

  private depthForEntity(entity: EntityState) {
    if (entity.kind === "projectile") {
      return 70;
    }
    if (entity.kind === "pickup") {
      return 30;
    }
    return 50;
  }
}
