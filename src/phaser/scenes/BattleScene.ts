import Phaser from "phaser";
import { TextureKey } from "../../game/assets/manifest";
import { MAP_FEATURES, WATER_ZONES, WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import { createEmptyInputFrame, type InputFrame } from "../../game/input/actions";
import {
  createInitialGameState,
  stepSimulation,
  type EntityState,
  type GameEvent,
  type GameState
} from "../../game/simulation/state";
import { HudController } from "../../ui/hud/HudController";

declare global {
  interface Window {
    __battleState?: GameState;
  }
}

interface EntityView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  bar?: Phaser.GameObjects.Graphics;
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

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private hud!: HudController;
  private keys!: ControlKeys;
  private entityViews = new Map<string, EntityView>();
  private mapLayer!: Phaser.GameObjects.Graphics;
  private stormLayer!: Phaser.GameObjects.Graphics;
  private waterLayer!: Phaser.GameObjects.Graphics;
  private selectedSlot = 1;
  private useItemQueued = false;
  private lastEventId = 0;

  constructor() {
    super("BattleScene");
  }

  create() {
    this.state = createInitialGameState();
    this.hud = new HudController(document.getElementById("hud-root"));
    this.createTextures();
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
    stepSimulation(this.state, input, Math.min(delta, 50));
    window.__battleState = this.state;
    this.renderStorm();
    this.renderWater(delta);
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

  private createMap() {
    this.mapLayer = this.add.graphics();
    this.waterLayer = this.add.graphics();
    this.stormLayer = this.add.graphics();
    this.drawGrass();
    this.drawFeatures();
    this.renderWater(0);
    this.renderStorm();
  }

  private drawGrass() {
    this.mapLayer.fillStyle(0x78a858, 1);
    this.mapLayer.fillRoundedRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 28);

    for (let y = 0; y < WORLD_HEIGHT; y += 32) {
      for (let x = 0; x < WORLD_WIDTH; x += 32) {
        const seed = (x * 17 + y * 31) % 11;
        const color = seed < 3 ? 0x6e9e51 : seed > 8 ? 0x8ab866 : 0x79a95a;
        this.mapLayer.fillStyle(color, 0.5);
        this.mapLayer.fillRect(x, y, 32, 32);
        if (seed === 4 || seed === 7) {
          this.mapLayer.fillStyle(0xd8d97a, 0.55);
          this.mapLayer.fillRect(x + 12, y + 10, 4, 9);
          this.mapLayer.fillRect(x + 8, y + 14, 12, 3);
        }
      }
    }

    this.mapLayer.lineStyle(3, 0xe5edd3, 0.35);
    this.mapLayer.beginPath();
    this.mapLayer.moveTo(250, 145);
    this.mapLayer.lineTo(500, 205);
    this.mapLayer.lineTo(670, 390);
    this.mapLayer.lineTo(800, 570);
    this.mapLayer.lineTo(840, 815);
    this.mapLayer.strokePath();
    this.mapLayer.beginPath();
    this.mapLayer.moveTo(1450, 110);
    this.mapLayer.lineTo(1610, 245);
    this.mapLayer.lineTo(1680, 500);
    this.mapLayer.lineTo(1560, 730);
    this.mapLayer.strokePath();
  }

  private drawFeatures() {
    for (const feature of MAP_FEATURES) {
      if (feature.kind === "water") {
        continue;
      }

      if (feature.kind === "bush") {
        this.drawBush(feature.x, feature.y, feature.width, feature.height);
        continue;
      }

      if (feature.kind === "crate") {
        this.drawCrate(feature.x, feature.y, feature.width, feature.height);
        continue;
      }

      if (feature.kind === "barrel") {
        this.drawBarrel(feature.x, feature.y, feature.width, feature.height);
        continue;
      }

      this.drawStoneWall(feature.x, feature.y, feature.width, feature.height);
    }
  }

  private renderWater(delta: number) {
    this.waterLayer.clear();
    const shimmer = 0.08 + Math.sin(this.time.now / 260 + delta) * 0.025;
    for (const zone of WATER_ZONES) {
      this.waterLayer.fillStyle(0x2f7fb0, 1);
      this.waterLayer.fillRoundedRect(zone.x, zone.y, zone.width, zone.height, 14);
      this.waterLayer.fillStyle(0x1d5f8d, 0.9);
      this.waterLayer.fillRoundedRect(zone.x + 8, zone.y + 8, zone.width - 16, zone.height - 16, 12);
      this.waterLayer.lineStyle(3, 0x9eddeb, 0.35 + shimmer);
      for (let y = zone.y + 22; y < zone.y + zone.height - 8; y += 34) {
        this.waterLayer.beginPath();
        this.waterLayer.moveTo(zone.x + 20, y);
        this.waterLayer.lineTo(zone.x + zone.width - 30, y + Math.sin(this.time.now / 340 + y) * 5);
        this.waterLayer.strokePath();
      }
      this.waterLayer.fillStyle(0x82c65f, 0.9);
      this.waterLayer.fillCircle(zone.x + zone.width * 0.72, zone.y + zone.height * 0.65, 12);
      this.waterLayer.fillCircle(zone.x + zone.width * 0.42, zone.y + zone.height * 0.38, 10);
    }
  }

  private renderStorm() {
    this.stormLayer.clear();
    const pulse = 0.12 + Math.abs(Math.sin(this.time.now / 210)) * 0.08;
    this.stormLayer.lineStyle(900, 0x5728a8, 0.34);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius + 450);
    this.stormLayer.lineStyle(7, 0xf4ecff, 0.92);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius);
    this.stormLayer.lineStyle(15, 0xa75cff, pulse);
    this.stormLayer.strokeCircle(this.state.storm.centerX, this.state.storm.centerY, this.state.storm.radius + 5);

    for (let i = 0; i < 10; i += 1) {
      const angle = i * 0.62 + this.time.now / 520;
      const radius = this.state.storm.radius + 8 + (i % 3) * 6;
      const x = this.state.storm.centerX + Math.cos(angle) * radius;
      const y = this.state.storm.centerY + Math.sin(angle) * radius;
      this.stormLayer.lineStyle(3, 0xffffff, 0.45);
      this.stormLayer.beginPath();
      this.stormLayer.moveTo(x, y);
      this.stormLayer.lineTo(x + Math.cos(angle + 1.9) * 32, y + Math.sin(angle + 1.9) * 32);
      this.stormLayer.lineTo(x + Math.cos(angle - 0.9) * 56, y + Math.sin(angle - 0.9) * 56);
      this.stormLayer.strokePath();
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
    const sprite = this.add.image(0, 0, texture);
    sprite.setOrigin(0.5, 0.62);
    const container = this.add.container(entity.x, entity.y, [sprite]);
    container.setDepth(this.depthForEntity(entity));

    const view: EntityView = { container, sprite };
    if (entity.kind === "player" || entity.kind === "bot") {
      const label = this.add.text(0, -44, entity.label ?? "", {
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
      const bob = entity.pveType === "slime" ? Math.sin(this.time.now / 160 + entity.x) * 0.08 : Math.sin(this.time.now / 120 + entity.x) * 0.12;
      view.sprite.setScale(1 + bob, 1 - bob * 0.5);
      if ((entity.vx ?? 0) < 0) {
        view.sprite.setFlipX(true);
      }
    } else if (entity.aimAngle !== undefined) {
      view.sprite.setRotation(entity.aimAngle * 0.08);
      view.sprite.setFlipX(Math.cos(entity.aimAngle) < 0);
    }

    if (view.bar) {
      this.renderHealthBar(view.bar, entity);
    }
  }

  private renderHealthBar(graphics: Phaser.GameObjects.Graphics, entity: EntityState) {
    const width = 54;
    const healthRatio = Math.max(0, Math.min(1, (entity.health ?? 0) / (entity.maxHealth ?? 100)));
    const shieldRatio = Math.max(0, Math.min(1, (entity.shield ?? 0) / 60));
    graphics.clear();
    graphics.fillStyle(0x121712, 0.9);
    graphics.fillRoundedRect(-width / 2, -36, width, 8, 2);
    graphics.fillStyle(0x80e05c, 1);
    graphics.fillRoundedRect(-width / 2 + 2, -34, (width - 4) * healthRatio, 4, 1);
    if (shieldRatio > 0) {
      graphics.fillStyle(0x62c8ff, 1);
      graphics.fillRoundedRect(-width / 2 + 2, -29, (width - 4) * shieldRatio, 3, 1);
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
    const color = event.type === "pickup" ? 0xffe66d : event.type === "hit" ? 0xff5a4f : 0x9be8ff;
    const ring = this.add.circle(event.x, event.y, event.type === "pickup" ? 10 : 6, color, 0.6);
    ring.setDepth(80);
    this.tweens.add({
      targets: ring,
      radius: event.type === "pickup" ? 34 : 22,
      alpha: 0,
      duration: event.type === "pickup" ? 380 : 220,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private textureForEntity(entity: EntityState): string {
    if (entity.kind === "projectile") {
      return TextureKey.Projectile;
    }
    if (entity.kind === "pve") {
      return entity.pveType === "slime" ? TextureKey.Slime : TextureKey.Bat;
    }
    if (entity.kind === "pickup") {
      switch (entity.pickupType) {
        case "ammo":
          return TextureKey.Ammo;
        case "medkit":
          return TextureKey.Medkit;
        case "shield":
          return TextureKey.Shield;
        case "rifle":
          return TextureKey.Rifle;
        case "shotgun":
          return TextureKey.Shotgun;
        case "coin":
        default:
          return TextureKey.Coin;
      }
    }
    switch (entity.role) {
      case "samurai":
        return TextureKey.Samurai;
      case "ninja":
        return TextureKey.Ninja;
      case "cowboy":
        return TextureKey.Cowboy;
      case "mage":
        return TextureKey.Mage;
      case "rogue":
      default:
        return TextureKey.Rogue;
    }
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

  private drawStoneWall(x: number, y: number, width: number, height: number) {
    this.mapLayer.fillStyle(0x4f5b57, 0.55);
    this.mapLayer.fillRect(x + 5, y + 7, width, height);
    for (let tileY = y; tileY < y + height; tileY += 24) {
      for (let tileX = x; tileX < x + width; tileX += 24) {
        this.mapLayer.fillStyle((tileX + tileY) % 3 === 0 ? 0xaab1a6 : 0x858c84, 1);
        this.mapLayer.fillRect(tileX, tileY, 22, 22);
        this.mapLayer.lineStyle(1, 0x4d554f, 0.8);
        this.mapLayer.strokeRect(tileX, tileY, 22, 22);
      }
    }
  }

  private drawBush(x: number, y: number, width: number, height: number) {
    this.mapLayer.fillStyle(0x2f6d3d, 0.92);
    for (let i = 0; i < 18; i += 1) {
      const px = x + ((i * 37) % width);
      const py = y + ((i * 29) % height);
      this.mapLayer.fillCircle(px, py, 24 + (i % 3) * 5);
      this.mapLayer.fillStyle(i % 2 === 0 ? 0x3f8b4e : 0x285b35, 0.9);
    }
  }

  private drawCrate(x: number, y: number, width: number, height: number) {
    this.mapLayer.fillStyle(0x8a5728, 1);
    this.mapLayer.fillRect(x, y, width, height);
    this.mapLayer.lineStyle(4, 0x3e2918, 1);
    this.mapLayer.strokeRect(x, y, width, height);
    this.mapLayer.lineBetween(x + 8, y + 8, x + width - 8, y + height - 8);
    this.mapLayer.lineBetween(x + width - 8, y + 8, x + 8, y + height - 8);
  }

  private drawBarrel(x: number, y: number, width: number, height: number) {
    this.mapLayer.fillStyle(0x654021, 1);
    this.mapLayer.fillEllipse(x + width / 2, y + height / 2, width, height);
    this.mapLayer.lineStyle(3, 0x2c2119, 1);
    this.mapLayer.strokeEllipse(x + width / 2, y + height / 2, width, height);
    this.mapLayer.lineBetween(x + 8, y + height / 2, x + width - 8, y + height / 2);
  }

  private createTextures() {
    this.createCharacterTexture(TextureKey.Rogue, 0x1c2522, 0x6cc9ff, 0x202020);
    this.createCharacterTexture(TextureKey.Samurai, 0xb42b26, 0xffd35c, 0x2f1715);
    this.createCharacterTexture(TextureKey.Ninja, 0x222b2b, 0x90d65f, 0x111515);
    this.createCharacterTexture(TextureKey.Cowboy, 0x8a552a, 0xffda87, 0x3e2715);
    this.createCharacterTexture(TextureKey.Mage, 0x2468d5, 0xa8d8ff, 0x172a68);
    this.createBatTexture();
    this.createSlimeTexture();
    this.createProjectileTexture();
    this.createPickupTextures();
  }

  private createCharacterTexture(key: string, body: number, accent: number, dark: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(24, 39, 34, 10);
    g.fillStyle(dark, 1);
    g.fillRect(15, 17, 18, 22);
    g.fillStyle(body, 1);
    g.fillRect(17, 13, 14, 20);
    g.fillRect(12, 26, 8, 13);
    g.fillRect(28, 26, 8, 13);
    g.fillStyle(0xf2c58d, 1);
    g.fillRect(18, 17, 12, 8);
    g.fillStyle(accent, 1);
    g.fillRect(15, 10, 18, 6);
    g.fillRect(20, 31, 9, 13);
    g.fillStyle(0x111111, 1);
    g.fillRect(18, 20, 3, 3);
    g.fillRect(27, 20, 3, 3);
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  private createBatTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1a1832, 1);
    g.fillTriangle(22, 22, 2, 12, 10, 32);
    g.fillTriangle(26, 22, 46, 12, 38, 32);
    g.fillStyle(0x51318d, 1);
    g.fillCircle(24, 24, 12);
    g.fillStyle(0xff5eb8, 1);
    g.fillRect(18, 19, 4, 4);
    g.fillRect(28, 19, 4, 4);
    g.generateTexture(TextureKey.Bat, 48, 48);
    g.destroy();
  }

  private createSlimeTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(24, 36, 34, 9);
    g.fillStyle(0x7336c7, 1);
    g.fillRoundedRect(9, 14, 30, 25, 12);
    g.fillStyle(0xb37cff, 1);
    g.fillRect(17, 19, 4, 4);
    g.fillRect(29, 19, 4, 4);
    g.fillStyle(0x512296, 1);
    g.fillRect(19, 30, 12, 3);
    g.generateTexture(TextureKey.Slime, 48, 48);
    g.destroy();
  }

  private createProjectileTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffef8a, 1);
    g.fillRect(2, 5, 18, 5);
    g.fillStyle(0xff7d36, 1);
    g.fillRect(0, 6, 8, 3);
    g.generateTexture(TextureKey.Projectile, 24, 16);
    g.destroy();
  }

  private createPickupTextures() {
    this.createPickupTexture(TextureKey.Ammo, 0xd98b3a, 0x4a2c17);
    this.createPickupTexture(TextureKey.Medkit, 0xf2f4e6, 0xd63131);
    this.createPickupTexture(TextureKey.Shield, 0x58a5ff, 0xe8f7ff);
    this.createPickupTexture(TextureKey.Rifle, 0x805334, 0x242424);
    this.createPickupTexture(TextureKey.Shotgun, 0xa06a3c, 0x222222);
    this.createPickupTexture(TextureKey.Coin, 0xffc83d, 0xfff1a5);
  }

  private createPickupTexture(key: string, primary: number, secondary: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.24);
    g.fillEllipse(18, 31, 24, 8);
    g.fillStyle(primary, 1);
    g.fillRoundedRect(7, 7, 22, 22, 5);
    g.lineStyle(3, secondary, 1);
    g.strokeRoundedRect(7, 7, 22, 22, 5);
    g.lineBetween(13, 18, 23, 18);
    g.lineBetween(18, 13, 18, 23);
    g.generateTexture(key, 36, 36);
    g.destroy();
  }
}
