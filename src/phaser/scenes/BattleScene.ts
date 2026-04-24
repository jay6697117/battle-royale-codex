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
import {
  STORM_EDGE_PROFILE,
  buildStormEdgePoints,
  buildStormLightningBranches,
  type StormVisualPoint
} from "./stormVisuals";

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
  lastShield: number;
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
  weaponCycle: Phaser.Input.Keyboard.Key;
  use: Phaser.Input.Keyboard.Key;
  start: Phaser.Input.Keyboard.Key;
  restart: Phaser.Input.Keyboard.Key;
}

const TILE_SIZE = 32;
const HUD_UPDATE_INTERVAL_MS = 100;
const STORM_GRAPHICS_UPDATE_INTERVAL_MS = 83;
const STORM_RADIUS_REDRAW_THRESHOLD = 1.5;

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private hud!: HudController;
  private keys!: ControlKeys;
  private entityViews = new Map<string, EntityView>();
  private stormLayer!: Phaser.GameObjects.Graphics;
  private stormBackdrop!: Phaser.GameObjects.Graphics;
  private stormSea!: Phaser.GameObjects.TileSprite;
  private stormSeaMaskShape!: Phaser.GameObjects.Graphics;
  private stormSeaMask!: Phaser.Display.Masks.GeometryMask;
  private stormEdgeSprites: Phaser.GameObjects.Sprite[] = [];
  private activeEffects = new Set<Phaser.GameObjects.Sprite>();
  private selectedSlot = 1;
  private useItemQueued = false;
  private matchStarted = false;
  private suppressPointerInput = false;
  private lastEventId = 0;
  private lastHudUpdateMs = Number.NEGATIVE_INFINITY;
  private lastStormGraphicsUpdateMs = Number.NEGATIVE_INFINITY;
  private lastStormGraphicsRadius = Number.NaN;

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
    this.hud = new HudController(document.getElementById("hud-root"), () => this.startMatch());
    this.createAnimations();
    this.createMap();
    this.createInput();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.scale.on("resize", () => this.hud.update(this.state, Object.values(this.state.entities), !this.matchStarted));
    this.hud.update(this.state, Object.values(this.state.entities), true);
    window.__battleState = this.state;
  }

  update(time: number, delta: number) {
    const input = this.collectInput();
    if (this.matchStarted) {
      stepSimulation(this.state, input, Math.min(delta, 16.67));
    }
    const entities = Object.values(this.state.entities);
    window.__battleState = this.state;
    this.renderStorm(time);
    this.renderEntities(entities);
    this.renderEvents();
    this.updateHud(entities, time);
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
      weaponCycle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      use: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      start: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    };

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.matchStarted) {
        this.startMatch();
        return;
      }
      if (pointer.rightButtonDown()) {
        this.useItemQueued = true;
      }
    });
  }

  private collectInput(): InputFrame {
    if (!this.matchStarted && Phaser.Input.Keyboard.JustDown(this.keys.start)) {
      this.startMatch();
    }
    if (!this.matchStarted) {
      const frame = createEmptyInputFrame();
      frame.selectedSlot = this.selectedSlot;
      return frame;
    }

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
    if (Phaser.Input.Keyboard.JustDown(this.keys.weaponCycle)) {
      this.selectedSlot = this.nextWeaponSlot(this.selectedSlot);
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
    frame.shooting = !this.suppressPointerInput && pointer.isDown && !pointer.rightButtonDown() && this.selectedSlot <= 3;
    frame.selectedSlot = this.selectedSlot;
    frame.useItem = this.useItemQueued || (!this.suppressPointerInput && pointer.isDown && pointer.rightButtonDown());
    this.useItemQueued = false;
    this.suppressPointerInput = false;
    return frame;
  }

  private startMatch() {
    if (this.matchStarted) {
      return;
    }
    this.matchStarted = true;
    this.suppressPointerInput = true;
    this.forceHudUpdate(false);
  }

  private nextWeaponSlot(currentSlot: number) {
    if (currentSlot === 1) {
      return 2;
    }
    if (currentSlot === 2) {
      return 3;
    }
    return 1;
  }

  private updateHud(entities: EntityState[], timeMs: number) {
    if (timeMs - this.lastHudUpdateMs < HUD_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastHudUpdateMs = timeMs;
    this.hud.update(this.state, entities, !this.matchStarted);
  }

  private forceHudUpdate(showStartNotice: boolean) {
    this.lastHudUpdateMs = this.time.now;
    this.hud.update(this.state, Object.values(this.state.entities), showStartNotice);
  }

  private restartMatch() {
    for (const view of this.entityViews.values()) {
      view.container.destroy(true);
    }
    this.entityViews.clear();
    this.state = createInitialGameState();
    this.selectedSlot = 1;
    this.useItemQueued = false;
    this.matchStarted = false;
    this.suppressPointerInput = false;
    this.lastEventId = 0;
    this.lastHudUpdateMs = Number.NEGATIVE_INFINITY;
    this.lastStormGraphicsUpdateMs = Number.NEGATIVE_INFINITY;
    this.lastStormGraphicsRadius = Number.NaN;
    this.forceHudUpdate(true);
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
    for (const key of ["fx-muzzle-flash", TextureKey.Spark, "fx-pickup-ring", TextureKey.StormEdge]) {
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
      if (feature.kind === "crate" || feature.kind === "chest") {
        const texture = feature.kind === "chest" ? TextureKey.Chest : TextureKey.Crate;
        this.add.image(feature.x + feature.width / 2, feature.y + feature.height / 2, texture).setDepth(25);
        continue;
      }
      if (feature.kind === "barrel") {
        this.add.image(feature.x + feature.width / 2, feature.y + feature.height / 2, TextureKey.Barrel).setDepth(25);
        continue;
      }
      this.createRuin(feature.x, feature.y, feature.width, feature.height);
    }
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
    this.stormSeaMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    this.stormSeaMask = this.stormSeaMaskShape.createGeometryMask();
    this.stormSeaMask.setInvertAlpha(true);

    this.stormBackdrop = this.add.graphics();
    this.stormBackdrop.setDepth(86);
    this.stormBackdrop.setMask(this.stormSeaMask);

    this.stormSea = this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, TextureKey.StormSea);
    this.stormSea.setDepth(88);
    this.stormSea.setAlpha(STORM_EDGE_PROFILE.outsideTextureAlpha);
    this.stormSea.setMask(this.stormSeaMask);

    this.stormLayer = this.add.graphics();
    this.stormLayer.setDepth(91);
    for (let index = 0; index < STORM_EDGE_PROFILE.spriteCount; index += 1) {
      const edge = this.add.sprite(0, 0, TextureKey.StormEdge);
      edge.play(TextureKey.StormEdge);
      edge.setDepth(93);
      edge.setAlpha(0.34);
      this.stormEdgeSprites.push(edge);
    }
  }

  private renderStorm(timeMs: number) {
    this.stormSea.tilePositionX += 0.12;
    this.stormSea.tilePositionY -= 0.07;
    this.stormSea.setAlpha(STORM_EDGE_PROFILE.outsideTextureAlpha + Math.abs(Math.sin(timeMs / 1_100)) * 0.03);

    if (this.shouldRedrawStormGraphics(timeMs)) {
      this.redrawStormGraphics(timeMs);
    }

    this.updateStormEdgeSprites(timeMs);
  }

  private shouldRedrawStormGraphics(timeMs: number) {
    return (
      timeMs - this.lastStormGraphicsUpdateMs >= STORM_GRAPHICS_UPDATE_INTERVAL_MS ||
      Math.abs(this.state.storm.radius - this.lastStormGraphicsRadius) >= STORM_RADIUS_REDRAW_THRESHOLD
    );
  }

  private redrawStormGraphics(timeMs: number) {
    this.lastStormGraphicsUpdateMs = timeMs;
    this.lastStormGraphicsRadius = this.state.storm.radius;
    this.stormLayer.clear();
    this.stormBackdrop.clear();

    this.stormSeaMaskShape.clear();
    this.stormSeaMaskShape.fillStyle(0xffffff, 1);
    this.stormSeaMaskShape.fillCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius);

    this.drawStormOutside(timeMs);

    const pulse = 0.32 + Math.abs(Math.sin(timeMs / 260)) * 0.28;
    const mainPoints = buildStormEdgePoints({
      centerX: this.state.storm.centerX,
      centerY: this.state.storm.centerY,
      radius: this.state.storm.radius,
      count: STORM_EDGE_PROFILE.edgePointCount,
      seedOffset: 0,
      timeMs
    });
    const secondaryPoints = buildStormEdgePoints({
      centerX: this.state.storm.centerX,
      centerY: this.state.storm.centerY,
      radius: this.state.storm.radius + 5,
      count: STORM_EDGE_PROFILE.edgePointCount,
      seedOffset: 37,
      timeMs
    });

    this.drawStormPolyline(mainPoints, STORM_EDGE_PROFILE.outerAuraWidth, 0x4a1598, 0.12 + pulse * 0.08);
    this.drawStormPolyline(secondaryPoints, STORM_EDGE_PROFILE.midAuraWidth, 0x8040d8, 0.14 + pulse * 0.1);
    this.drawStormPolyline(mainPoints, STORM_EDGE_PROFILE.brightAuraWidth, 0xb985ff, 0.2 + pulse * 0.12);
    this.drawStormPolyline(secondaryPoints, STORM_EDGE_PROFILE.coreWidth, 0xffedff, 0.56 + pulse * 0.14);
    this.drawStormPolyline(
      buildStormEdgePoints({
        centerX: this.state.storm.centerX,
        centerY: this.state.storm.centerY,
        radius: this.state.storm.radius - 9,
        count: STORM_EDGE_PROFILE.edgePointCount,
        seedOffset: 71,
        timeMs
      }),
      STORM_EDGE_PROFILE.traceWidth,
      0xffffff,
      0.38 + pulse * 0.1
    );
    this.drawStormLightningBranches(
      buildStormLightningBranches({
        centerX: this.state.storm.centerX,
        centerY: this.state.storm.centerY,
        radius: this.state.storm.radius,
        count: STORM_EDGE_PROFILE.branchCount,
        timeMs
      }),
      pulse
    );
    this.stormLayer.lineStyle(1, 0xffffff, 0.12);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius - 5);
  }

  private updateStormEdgeSprites(timeMs: number) {
    for (let index = 0; index < this.stormEdgeSprites.length; index += 1) {
      const edge = this.stormEdgeSprites[index];
      if (!edge) {
        continue;
      }
      const angle =
        index * ((Math.PI * 2) / this.stormEdgeSprites.length) +
        Math.sin(timeMs / 1_100 + index) * 0.026;
      const radius = this.state.storm.radius + 1 + Math.sin(timeMs / 360 + index * 1.7) * 4;
      edge.setPosition(
        this.state.storm.centerX + Math.cos(angle) * radius,
        this.state.storm.centerY + Math.sin(angle) * radius
      );
      edge.setRotation(angle + Math.PI / 2);
      edge.setScale(0.62 + (index % 4) * 0.07);
      edge.setAlpha(0.14 + Math.abs(Math.sin(timeMs / 260 + index)) * 0.18);
    }
  }

  private drawStormOutside(timeMs: number) {
    this.stormBackdrop.fillStyle(STORM_EDGE_PROFILE.outsideFillColor, STORM_EDGE_PROFILE.outsideFillAlpha);
    this.stormBackdrop.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.stormBackdrop.fillStyle(0x190237, 0.08);
    this.stormBackdrop.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let index = 0; index < 12; index += 1) {
      const y = ((index * 131 + timeMs * 0.006) % (WORLD_HEIGHT + 220)) - 110;
      const x = ((index * 197 + timeMs * 0.009) % (WORLD_WIDTH + 300)) - 150;
      const width = 260 + (index % 5) * 86;
      this.stormBackdrop.fillStyle(index % 2 === 0 ? 0x8e53d6 : 0x2a0b5c, 0.045);
      this.stormBackdrop.fillRoundedRect(x, y, width, 26 + (index % 3) * 13, 18);
    }
  }

  private drawStormPolyline(points: StormVisualPoint[], width: number, color: number, alpha: number) {
    if (points.length < 2) {
      return;
    }
    this.stormLayer.lineStyle(width, color, alpha);
    this.stormLayer.beginPath();
    this.stormLayer.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      if (point) {
        this.stormLayer.lineTo(point.x, point.y);
      }
    }
    this.stormLayer.closePath();
    this.stormLayer.strokePath();
  }

  private drawStormLightningBranches(branches: StormVisualPoint[][], pulse: number) {
    for (let index = 0; index < branches.length; index += 1) {
      const branch = branches[index];
      if (!branch || branch.length < 2) {
        continue;
      }
      this.drawStormOpenPath(branch, 4, 0x8b46dd, 0.08 + pulse * 0.06);
      this.drawStormOpenPath(branch, 1.5, 0xf4dcff, 0.24 + pulse * 0.1);
      if (index % 4 === 0) {
        this.drawStormOpenPath(branch.slice(0, 3), 1, 0xffffff, 0.32);
      }
    }
  }

  private drawStormOpenPath(points: StormVisualPoint[], width: number, color: number, alpha: number) {
    if (points.length < 2) {
      return;
    }
    this.stormLayer.lineStyle(width, color, alpha);
    this.stormLayer.beginPath();
    this.stormLayer.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      if (point) {
        this.stormLayer.lineTo(point.x, point.y);
      }
    }
    this.stormLayer.strokePath();
  }

  private renderEntities(entities: EntityState[]) {
    const liveIds = new Set<string>();

    for (const entity of entities) {
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
      lastHealth: Number.NaN,
      lastShield: Number.NaN
    };
    if (entity.kind === "pickup" && entity.pickupType) {
      this.playEntityAnimation(view, pickupGlowKey(entity.pickupType));
      sprite.setScale(0.9);
    }
    if (entity.kind === "pve") {
      this.playEntityAnimation(view, this.animationForPve(entity));
      this.stylePveSprite(entity, sprite);
    }
    if (entity.kind === "player" || entity.kind === "bot") {
      sprite.setScale(0.72);
      const label = this.add.text(0, -48, entity.label ?? "", {
        fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif",
        fontSize: "13px",
        color: "#f8ffe7",
        stroke: "#172019",
        strokeThickness: 3
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

    if (
      view.bar &&
      ((entity.health ?? 0) !== view.lastHealth || (entity.shield ?? 0) !== view.lastShield)
    ) {
      this.renderHealthBar(view.bar, entity);
    }

    view.lastX = entity.x;
    view.lastY = entity.y;
    view.lastHealth = entity.health ?? view.lastHealth;
    view.lastShield = entity.shield ?? view.lastShield;
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

  private animationForPve(entity: EntityState) {
    if (entity.pveType === "slime" || entity.pveType === "spitter" || entity.pveType === "golem") {
      return enemySheetKey("slime", "hop");
    }
    return enemySheetKey("bat", entity.pveType === "wolf" ? "dash" : "fly");
  }

  private textureForPve(entity: EntityState) {
    if (entity.pveType === "slime" || entity.pveType === "spitter" || entity.pveType === "golem") {
      return enemySheetKey("slime", "idle");
    }
    return enemySheetKey("bat", "fly");
  }

  private stylePveSprite(entity: EntityState, sprite: Phaser.GameObjects.Sprite) {
    const tintByType = {
      bat: 0xffffff,
      slime: 0xffffff,
      wolf: 0xd8d3ff,
      spitter: 0x80ff86,
      golem: 0xb8b8c4
    } as const;
    const scaleByType = {
      bat: 0.78,
      slime: 0.78,
      wolf: 0.84,
      spitter: 0.86,
      golem: 1.08
    } as const;
    const type = entity.pveType ?? "bat";
    sprite.setScale(scaleByType[type]);
    sprite.setTint(tintByType[type]);
  }

  private renderHealthBar(graphics: Phaser.GameObjects.Graphics, entity: EntityState) {
    const width = 46;
    const healthRatio = Math.max(0, Math.min(1, (entity.health ?? 0) / (entity.maxHealth ?? 100)));
    const shieldRatio = Math.max(0, Math.min(1, (entity.shield ?? 0) / 60));
    graphics.clear();
    graphics.fillStyle(0x121712, 0.92);
    graphics.fillRoundedRect(-width / 2, -37, width, 7, 2);
    graphics.fillStyle(0x80e05c, 1);
    graphics.fillRoundedRect(-width / 2 + 2, -35, (width - 4) * healthRatio, 4, 1);
    if (shieldRatio > 0) {
      graphics.fillStyle(0x62c8ff, 1);
      graphics.fillRoundedRect(-width / 2 + 2, -30, (width - 4) * shieldRatio, 2, 1);
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
    if (this.activeEffects.size > 36) {
      const oldest = this.activeEffects.values().next().value;
      oldest?.destroy();
      if (oldest) {
        this.activeEffects.delete(oldest);
      }
    }
    const animationKey =
      event.type === "pickup" || event.type === "loot"
        ? "fx-pickup-ring"
        : event.type === "shoot"
          ? "fx-muzzle-flash"
          : TextureKey.Spark;
    const effect = this.add.sprite(event.x, event.y, animationKey);
    this.activeEffects.add(effect);
    effect.setDepth(85);
    effect.setScale(event.type === "levelup" ? 1.45 : event.type === "xp" ? 0.8 : 1);
    effect.setTint(event.type === "levelup" ? 0xffd45a : event.type === "loot" ? 0x9fffa1 : 0xffffff);
    effect.play(animationKey);
    const destroyEffect = () => {
      if (!effect.active) {
        return;
      }
      this.activeEffects.delete(effect);
      effect.destroy();
    };
    effect.once(Phaser.Animations.Events.ANIMATION_REPEAT, destroyEffect);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      duration: event.type === "pickup" ? 520 : 280,
      delay: event.type === "pickup" ? 120 : 80,
      onComplete: destroyEffect
    });
  }

  private textureForEntity(entity: EntityState): string {
    if (entity.kind === "projectile") {
      return TextureKey.Projectile;
    }
    if (entity.kind === "pve") {
      return this.textureForPve(entity);
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
