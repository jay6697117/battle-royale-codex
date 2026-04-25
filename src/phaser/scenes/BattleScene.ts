import Phaser from "phaser";
import {
  PHASER_IMAGE_ASSETS,
  PHASER_SPRITESHEET_ASSETS,
  TextureKey,
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
import { HudController, type ViewportBounds } from "../../ui/hud/HudController";
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
  playerLocatorRing?: Phaser.GameObjects.Graphics;
  playerLocatorArrow?: Phaser.GameObjects.Text;
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
  slotCycle: Phaser.Input.Keyboard.Key;
  use: Phaser.Input.Keyboard.Key;
  start: Phaser.Input.Keyboard.Key;
  restart: Phaser.Input.Keyboard.Key;
}

type MobileButtonId = "fire" | "cycle";

interface MobileControls {
  root: HTMLDivElement;
  joystick: HTMLDivElement;
  joystickKnob: HTMLDivElement;
  joystickPointerId?: number;
  moveX: number;
  moveY: number;
  firePointerIds: Set<number>;
  buttonPointerIds: Partial<Record<MobileButtonId, number>>;
  fireQueued: boolean;
  slotCycleQueued: boolean;
}

interface MobileInputSnapshot {
  moveX: number;
  moveY: number;
  fireHeld: boolean;
  firePressed: boolean;
  slotCycle: boolean;
}

const HUD_UPDATE_INTERVAL_MS = 100;
const STORM_GRAPHICS_UPDATE_INTERVAL_MS = 83;
const STORM_RADIUS_REDRAW_THRESHOLD = 1.5;
const MOBILE_JOYSTICK_MAX_DISTANCE = 58;

type AudioCue =
  | "start"
  | "restart"
  | "slot"
  | "shoot"
  | "hit"
  | "pickup"
  | "loot"
  | "heal"
  | "shield"
  | "xp"
  | "levelup"
  | "elimination"
  | "win"
  | "loss";

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
  private lastPhase: GameState["phase"] = "playing";
  private audioContext?: AudioContext;
  private audioGain?: GainNode;
  private audioUnlocked = false;
  private lastHudUpdateMs = Number.NEGATIVE_INFINITY;
  private lastStormGraphicsUpdateMs = Number.NEGATIVE_INFINITY;
  private lastStormGraphicsRadius = Number.NaN;
  private mobileControls?: MobileControls;

  constructor() {
    super("BattleScene");
  }

  preload() {
    for (const asset of PHASER_IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of PHASER_SPRITESHEET_ASSETS) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        endFrame: asset.frames - 1
      });
    }
  }

  create() {
    this.state = createInitialGameState();
    this.hud = new HudController(document.getElementById("hud-root"), () => this.startMatch(), () => this.restartMatch());
    this.createAnimations();
    this.createMap();
    this.createInput();
    this.createMobileControls();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.scale.on("resize", () => this.hud.update(this.state, Object.values(this.state.entities), !this.matchStarted, this.getViewportBounds()));
    this.hud.update(this.state, Object.values(this.state.entities), true, this.getViewportBounds());
    this.exposeDebugState();
  }

  update(time: number, delta: number) {
    const input = this.collectInput();
    if (this.matchStarted) {
      stepSimulation(this.state, input, Math.min(delta, 16.67));
    }
    const entities = Object.values(this.state.entities);
    this.exposeDebugState();
    this.renderStorm(time);
    this.renderEntities(entities);
    this.renderEvents();
    this.renderPhaseAudio();
    this.updateHud(entities, time);
  }

  private exposeDebugState() {
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
      window.__battleState = this.state;
    }
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
      slotCycle: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      use: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      start: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      restart: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    };

    this.input.addPointer(3);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.unlockAudio();
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
      this.unlockAudio();
      this.startMatch();
    }
    if (!this.matchStarted) {
      const frame = createEmptyInputFrame();
      frame.selectedSlot = this.selectedSlot;
      return frame;
    }

    this.unlockAudioFromKeyboard();

    const mobileInput = this.consumeMobileInput();
    const previousSlot = this.selectedSlot;
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.slotCycle)) {
      this.selectedSlot = this.nextSlot(this.selectedSlot);
    }
    if (mobileInput.slotCycle) {
      this.selectedSlot = this.nextSlot(this.selectedSlot);
    }
    if (mobileInput.firePressed && this.selectedSlot > 3) {
      this.useItemQueued = true;
    }
    if (this.selectedSlot !== previousSlot) {
      this.playAudioCue("slot");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.use)) {
      this.useItemQueued = true;
    }
    if (this.state.phase !== "playing" && Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.restartMatch();
    }

    const pointer = this.input.activePointer;
    const frame = createEmptyInputFrame();
    const keyboardMoveX =
      (this.keys.right.isDown || this.keys.arrowRight.isDown ? 1 : 0) -
      (this.keys.left.isDown || this.keys.arrowLeft.isDown ? 1 : 0);
    const keyboardMoveY =
      (this.keys.down.isDown || this.keys.arrowDown.isDown ? 1 : 0) -
      (this.keys.up.isDown || this.keys.arrowUp.isDown ? 1 : 0);
    const mobileShooting = (mobileInput.fireHeld || mobileInput.firePressed) && this.selectedSlot <= 3;
    const mobileAim = mobileShooting ? this.mobileAimTarget(mobileInput) : undefined;
    frame.moveX = this.clampAxis(keyboardMoveX + mobileInput.moveX);
    frame.moveY = this.clampAxis(keyboardMoveY + mobileInput.moveY);
    frame.aimX = mobileAim?.x ?? pointer.worldX;
    frame.aimY = mobileAim?.y ?? pointer.worldY;
    frame.shooting =
      (!this.suppressPointerInput && pointer.isDown && !pointer.rightButtonDown() && this.selectedSlot <= 3) ||
      mobileShooting;
    frame.selectedSlot = this.selectedSlot;
    frame.useItem = this.useItemQueued;
    this.useItemQueued = false;
    this.suppressPointerInput = false;
    return frame;
  }

  private createMobileControls() {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }

    const root = document.createElement("div");
    root.className = "mobile-controls";
    root.innerHTML = `
      <div class="mobile-joystick" aria-label="移动摇杆">
        <span class="mobile-joystick-knob"></span>
      </div>
      <div class="mobile-buttons" aria-label="移动端操作按钮">
        <button class="mobile-button mobile-button-cycle" type="button" data-mobile-action="cycle" aria-label="切换武器或道具"><strong>切换</strong><span>武器/道具</span></button>
        <button class="mobile-button mobile-button-fire" type="button" data-mobile-action="fire" aria-label="开火或使用道具"><strong>开火</strong><span>射击/使用</span></button>
      </div>
    `;
    app.appendChild(root);

    const joystick = root.querySelector<HTMLDivElement>(".mobile-joystick");
    const joystickKnob = root.querySelector<HTMLDivElement>(".mobile-joystick-knob");
    if (!joystick || !joystickKnob) {
      root.remove();
      return;
    }

    this.mobileControls = {
      root,
      joystick,
      joystickKnob,
      moveX: 0,
      moveY: 0,
      firePointerIds: new Set<number>(),
      buttonPointerIds: {},
      fireQueued: false,
      slotCycleQueued: false
    };

    joystick.addEventListener("pointerdown", (event) => this.handleMobileJoystickDown(event));
    joystick.addEventListener("pointermove", (event) => this.handleMobileJoystickMove(event));
    joystick.addEventListener("pointerup", (event) => this.handleMobileJoystickUp(event));
    joystick.addEventListener("pointercancel", (event) => this.handleMobileJoystickUp(event));
    for (const button of root.querySelectorAll<HTMLButtonElement>(".mobile-button")) {
      button.addEventListener("pointerdown", (event) => this.handleMobileButtonDown(event));
      button.addEventListener("pointerup", (event) => this.handleMobileButtonUp(event));
      button.addEventListener("pointercancel", (event) => this.handleMobileButtonUp(event));
      button.addEventListener("lostpointercapture", (event) => this.handleMobileButtonUp(event));
    }
  }

  private handleMobileJoystickDown(event: PointerEvent) {
    const controls = this.mobileControls;
    if (!controls || controls.joystickPointerId !== undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.unlockAudio();
    controls.joystickPointerId = event.pointerId;
    controls.joystick.setPointerCapture(event.pointerId);
    this.updateMobileJoystick(event);
  }

  private handleMobileJoystickMove(event: PointerEvent) {
    const controls = this.mobileControls;
    if (!controls || controls.joystickPointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.updateMobileJoystick(event);
  }

  private handleMobileJoystickUp(event: PointerEvent) {
    const controls = this.mobileControls;
    if (!controls || controls.joystickPointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    controls.joystickPointerId = undefined;
    controls.moveX = 0;
    controls.moveY = 0;
    controls.joystickKnob.style.transform = "translate(-50%, -50%)";
  }

  private updateMobileJoystick(event: PointerEvent) {
    const controls = this.mobileControls;
    if (!controls) {
      return;
    }
    const rect = controls.joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const limitedDistance = Math.min(distance, MOBILE_JOYSTICK_MAX_DISTANCE);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * limitedDistance;
    const knobY = Math.sin(angle) * limitedDistance;
    controls.moveX = distance > 8 ? knobX / MOBILE_JOYSTICK_MAX_DISTANCE : 0;
    controls.moveY = distance > 8 ? knobY / MOBILE_JOYSTICK_MAX_DISTANCE : 0;
    controls.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  }

  private handleMobileButtonDown(event: PointerEvent) {
    const controls = this.mobileControls;
    const button = event.currentTarget as HTMLButtonElement;
    const action = button.dataset.mobileAction as MobileButtonId | undefined;
    if (!controls || !action || controls.buttonPointerIds[action] !== undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.unlockAudio();
    controls.buttonPointerIds[action] = event.pointerId;
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-pressed");
    if (action === "fire") {
      controls.firePointerIds.add(event.pointerId);
      controls.fireQueued = true;
      return;
    }
    controls.slotCycleQueued = true;
  }

  private handleMobileButtonUp(event: PointerEvent) {
    const controls = this.mobileControls;
    const button = event.currentTarget as HTMLButtonElement;
    const action = button.dataset.mobileAction as MobileButtonId | undefined;
    if (!controls || !action || controls.buttonPointerIds[action] !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    controls.buttonPointerIds[action] = undefined;
    button.classList.remove("is-pressed");
    if (action === "fire") {
      controls.firePointerIds.delete(event.pointerId);
    }
  }

  private consumeMobileInput(): MobileInputSnapshot {
    const controls = this.mobileControls;
    if (!controls) {
      return { moveX: 0, moveY: 0, fireHeld: false, firePressed: false, slotCycle: false };
    }
    const input = {
      moveX: controls.moveX,
      moveY: controls.moveY,
      fireHeld: controls.firePointerIds.size > 0,
      firePressed: controls.fireQueued,
      slotCycle: controls.slotCycleQueued
    };
    controls.fireQueued = false;
    controls.slotCycleQueued = false;
    return input;
  }

  private mobileAimTarget(input: MobileInputSnapshot) {
    const player = this.state.entities[this.state.playerId];
    if (!player) {
      return undefined;
    }
    const nearest = Object.values(this.state.entities)
      .filter(
        (entity) =>
          entity.alive &&
          entity.id !== player.id &&
          (entity.kind === "bot" || entity.kind === "pve") &&
          Math.hypot(entity.x - player.x, entity.y - player.y) < 620
      )
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    if (nearest) {
      return { x: nearest.x, y: nearest.y };
    }
    if (Math.hypot(input.moveX, input.moveY) > 0.2) {
      return { x: player.x + input.moveX * 260, y: player.y + input.moveY * 260 };
    }
    const angle = player.aimAngle ?? 0;
    return { x: player.x + Math.cos(angle) * 260, y: player.y + Math.sin(angle) * 260 };
  }

  private clampAxis(value: number) {
    return Math.max(-1, Math.min(1, value));
  }

  private startMatch() {
    if (this.matchStarted) {
      return;
    }
    this.unlockAudio();
    this.matchStarted = true;
    this.suppressPointerInput = true;
    this.setMobileControlsActive(true);
    this.playAudioCue("start");
    this.forceHudUpdate(false);
  }

  private nextSlot(currentSlot: number) {
    return currentSlot >= 5 ? 1 : currentSlot + 1;
  }

  private updateHud(entities: EntityState[], timeMs: number) {
    if (timeMs - this.lastHudUpdateMs < HUD_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastHudUpdateMs = timeMs;
    this.hud.update(this.state, entities, !this.matchStarted, this.getViewportBounds());
  }

  private forceHudUpdate(showStartNotice: boolean) {
    this.lastHudUpdateMs = this.time.now;
    this.hud.update(this.state, Object.values(this.state.entities), showStartNotice, this.getViewportBounds());
  }

  private getViewportBounds(): ViewportBounds {
    const canvasRect = this.scale.canvas.getBoundingClientRect();
    return {
      left: canvasRect.left,
      top: canvasRect.top,
      width: canvasRect.width,
      height: canvasRect.height
    };
  }

  private restartMatch() {
    this.playAudioCue("restart");
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
    this.lastPhase = "playing";
    this.lastHudUpdateMs = Number.NEGATIVE_INFINITY;
    this.lastStormGraphicsUpdateMs = Number.NEGATIVE_INFINITY;
    this.lastStormGraphicsRadius = Number.NaN;
    this.resetMobileControls();
    this.setMobileControlsActive(false);
    this.forceHudUpdate(true);
  }

  private setMobileControlsActive(active: boolean) {
    this.mobileControls?.root.classList.toggle("is-active", active);
  }

  private resetMobileControls() {
    const controls = this.mobileControls;
    if (!controls) {
      return;
    }
    controls.joystickPointerId = undefined;
    controls.moveX = 0;
    controls.moveY = 0;
    controls.firePointerIds.clear();
    controls.buttonPointerIds = {};
    controls.fireQueued = false;
    controls.slotCycleQueued = false;
    controls.joystickKnob.style.transform = "translate(-50%, -50%)";
    for (const button of controls.root.querySelectorAll(".mobile-button")) {
      button.classList.remove("is-pressed");
    }
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
      ["slime", "squash"],
      ["wolf", "dash"],
      ["wolf", "hurt"],
      ["spitter", "idle"],
      ["spitter", "hop"],
      ["spitter", "squash"],
      ["golem", "idle"],
      ["golem", "hop"],
      ["golem", "squash"]
    ] as [EnemyId, EnemyAnimationId][]) {
      this.createLoopingAnimation(enemySheetKey(id, animation), animation === "dash" ? 10 : 7);
    }
    for (const id of ["ammo", "medkit", "shield", "pistol", "rifle", "shotgun", "coin"] as const) {
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
      if (feature.kind === "water" || feature.kind === "wall" || feature.kind === "ruin") {
        continue;
      }
      if (feature.kind === "bush") {
        this.createFoliageCluster(feature.x, feature.y, feature.width, feature.height);
        continue;
      }
      if (feature.kind === "crate" || feature.kind === "chest") {
        const texture = feature.kind === "chest" ? TextureKey.Chest : TextureKey.Crate;
        this.add
          .image(feature.x + feature.width / 2, feature.y + feature.height / 2, texture)
          .setDisplaySize(feature.width, feature.height)
          .setDepth(25);
        continue;
      }
      if (feature.kind === "barrel") {
        this.add
          .image(feature.x + feature.width / 2, feature.y + feature.height / 2, TextureKey.Barrel)
          .setDisplaySize(feature.width, feature.height)
          .setDepth(25);
        continue;
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
    this.stormBackdrop.setDepth(36);
    this.stormBackdrop.setMask(this.stormSeaMask);

    this.stormSea = this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, TextureKey.StormSea);
    this.stormSea.setDepth(37);
    this.stormSea.setAlpha(STORM_EDGE_PROFILE.outsideTextureAlpha);
    this.stormSea.setMask(this.stormSeaMask);

    this.stormLayer = this.add.graphics();
    this.stormLayer.setDepth(46);
    for (let index = 0; index < STORM_EDGE_PROFILE.spriteCount; index += 1) {
      const edge = this.add.sprite(0, 0, TextureKey.StormEdge);
      edge.play(TextureKey.StormEdge);
      edge.setDepth(47);
      edge.setAlpha(0.2);
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
      edge.setAlpha(0.08 + Math.abs(Math.sin(timeMs / 260 + index)) * 0.12);
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
    sprite.setOrigin(0.5, entity.kind === "projectile" ? 0.5 : 0.72);
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
      const isPlayer = entity.id === this.state.playerId;
      if (isPlayer) {
        const locatorRing = this.add.graphics();
        locatorRing.setPosition(0, 0);
        const locatorArrow = this.add.text(0, -78, "▼ 你", {
          fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif",
          fontSize: "18px",
          color: "#ffe86a",
          stroke: "#241300",
          strokeThickness: 5
        });
        locatorArrow.setOrigin(0.5, 1);
        container.addAt(locatorRing, 0);
        container.add(locatorArrow);
        view.playerLocatorRing = locatorRing;
        view.playerLocatorArrow = locatorArrow;
      }
      const label = this.add.text(0, -48, entity.label ?? "", {
        fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif",
        fontSize: isPlayer ? "15px" : "13px",
        color: isPlayer ? "#ffe86a" : "#f8ffe7",
        stroke: isPlayer ? "#241300" : "#172019",
        strokeThickness: isPlayer ? 5 : 3
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
      const hurt = (entity.health ?? 0) < view.lastHealth;
      this.playEntityAnimation(view, hurt ? this.hurtAnimationForPve(entity) : this.animationForPve(entity));
      const dx = entity.x - view.lastX;
      if (Math.abs(dx) > 0.6) {
        view.sprite.setFlipX(dx < 0);
      }
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

    if (view.playerLocatorRing || view.playerLocatorArrow) {
      this.renderPlayerLocator(view, this.time.now);
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
    switch (entity.pveType) {
      case "wolf":
        return enemySheetKey("wolf", "dash");
      case "spitter":
        return enemySheetKey("spitter", "hop");
      case "golem":
        return enemySheetKey("golem", "hop");
      case "slime":
        return enemySheetKey("slime", "hop");
      default:
        return enemySheetKey("bat", "fly");
    }
  }

  private hurtAnimationForPve(entity: EntityState) {
    switch (entity.pveType) {
      case "wolf":
        return enemySheetKey("wolf", "hurt");
      case "spitter":
        return enemySheetKey("spitter", "squash");
      case "golem":
        return enemySheetKey("golem", "squash");
      case "slime":
        return enemySheetKey("slime", "squash");
      default:
        return enemySheetKey("bat", "hurt");
    }
  }

  private textureForPve(entity: EntityState) {
    switch (entity.pveType) {
      case "wolf":
        return enemySheetKey("wolf", "dash");
      case "spitter":
        return enemySheetKey("spitter", "idle");
      case "golem":
        return enemySheetKey("golem", "idle");
      case "slime":
        return enemySheetKey("slime", "idle");
      default:
        return enemySheetKey("bat", "fly");
    }
  }

  private stylePveSprite(entity: EntityState, sprite: Phaser.GameObjects.Sprite) {
    const scaleByType = {
      bat: 0.78,
      slime: 0.78,
      wolf: 0.84,
      spitter: 0.86,
      golem: 1.08
    } as const;
    const type = entity.pveType ?? "bat";
    sprite.setScale(scaleByType[type]);
    sprite.clearTint();
  }

  private renderPlayerLocator(view: EntityView, timeMs: number) {
    const pulse = 0.5 + Math.abs(Math.sin(timeMs / 230)) * 0.5;
    if (view.playerLocatorRing) {
      view.playerLocatorRing.clear();
      view.playerLocatorRing.lineStyle(5, 0x251100, 0.8);
      view.playerLocatorRing.strokeEllipse(0, -5, 58 + pulse * 10, 24 + pulse * 5);
      view.playerLocatorRing.lineStyle(3, 0xffe86a, 0.78 + pulse * 0.2);
      view.playerLocatorRing.strokeEllipse(0, -5, 50 + pulse * 12, 18 + pulse * 6);
    }
    if (view.playerLocatorArrow) {
      view.playerLocatorArrow.setY(-76 - pulse * 8);
      view.playerLocatorArrow.setAlpha(0.82 + pulse * 0.18);
      view.playerLocatorArrow.setScale(1 + pulse * 0.08);
    }
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
      this.playAudioCueForEvent(event);
      this.spawnEventFx(event);
      this.lastEventId = Math.max(this.lastEventId, event.id);
    }
  }

  private renderPhaseAudio() {
    if (this.state.phase === this.lastPhase) {
      return;
    }
    this.lastPhase = this.state.phase;
    if (this.state.phase !== "playing") {
      this.resetMobileControls();
      this.setMobileControlsActive(false);
    }
    if (this.state.phase === "won") {
      this.playAudioCue("win");
    } else if (this.state.phase === "lost") {
      this.playAudioCue("loss");
    }
  }

  private playAudioCueForEvent(event: GameEvent) {
    if (!this.isPlayerAudioEvent(event)) {
      return;
    }
    this.playAudioCue(event.type);
  }

  private isPlayerAudioEvent(event: GameEvent) {
    if (event.entityId === this.state.playerId || event.sourceId === this.state.playerId) {
      return true;
    }
    const entity = event.entityId ? this.state.entities[event.entityId] : undefined;
    return event.type === "pickup" && entity?.kind === "pickup";
  }

  private unlockAudioFromKeyboard() {
    if (this.audioUnlocked) {
      return;
    }
    if (
      this.keys.slot1.isDown ||
      this.keys.slot2.isDown ||
      this.keys.slot3.isDown ||
      this.keys.slot4.isDown ||
      this.keys.slot5.isDown ||
      this.keys.slotCycle.isDown ||
      this.keys.use.isDown ||
      this.keys.restart.isDown
    ) {
      this.unlockAudio();
    }
  }

  private unlockAudio() {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      void context.resume().then(() => {
        this.audioUnlocked = true;
      });
      return;
    }
    this.audioUnlocked = true;
  }

  private playAudioCue(cue: AudioCue) {
    const context = this.getAudioContext();
    if (!context || !this.audioGain || !this.audioUnlocked || context.state !== "running") {
      return;
    }

    const now = context.currentTime + 0.01;
    switch (cue) {
      case "start":
        this.playTone(392, now, 0.08, "sine", 0.1);
        this.playTone(588, now + 0.07, 0.1, "sine", 0.1);
        this.playTone(784, now + 0.15, 0.16, "triangle", 0.12);
        break;
      case "restart":
        this.playTone(330, now, 0.08, "triangle", 0.1);
        this.playTone(247, now + 0.06, 0.08, "triangle", 0.08);
        this.playTone(392, now + 0.14, 0.12, "sine", 0.1);
        break;
      case "slot":
        this.playTone(760, now, 0.045, "square", 0.045);
        break;
      case "shoot":
        this.playTone(118, now, 0.055, "sawtooth", 0.13);
        this.playTone(248, now, 0.035, "square", 0.05);
        break;
      case "hit":
        this.playTone(176, now, 0.07, "square", 0.1);
        this.playTone(72, now + 0.015, 0.08, "sine", 0.08);
        break;
      case "pickup":
        this.playTone(680, now, 0.07, "triangle", 0.1);
        this.playTone(1_020, now + 0.055, 0.1, "sine", 0.1);
        break;
      case "loot":
        this.playTone(440, now, 0.1, "triangle", 0.08);
        this.playTone(660, now + 0.08, 0.12, "triangle", 0.09);
        break;
      case "heal":
        this.playTone(523, now, 0.12, "sine", 0.08);
        this.playTone(659, now + 0.09, 0.14, "sine", 0.08);
        this.playTone(784, now + 0.18, 0.18, "sine", 0.07);
        break;
      case "shield":
        this.playTone(932, now, 0.09, "triangle", 0.08);
        this.playTone(1_244, now + 0.06, 0.14, "sine", 0.07);
        break;
      case "xp":
        this.playTone(880, now, 0.055, "sine", 0.055);
        this.playTone(1_176, now + 0.045, 0.075, "triangle", 0.055);
        break;
      case "levelup":
        this.playTone(523, now, 0.08, "triangle", 0.09);
        this.playTone(659, now + 0.08, 0.08, "triangle", 0.09);
        this.playTone(784, now + 0.16, 0.09, "triangle", 0.1);
        this.playTone(1_047, now + 0.24, 0.2, "sine", 0.12);
        break;
      case "elimination":
        this.playTone(196, now, 0.1, "sawtooth", 0.1);
        this.playTone(147, now + 0.09, 0.12, "sawtooth", 0.09);
        this.playTone(98, now + 0.2, 0.18, "sine", 0.08);
        break;
      case "win":
        this.playTone(523, now, 0.12, "triangle", 0.1);
        this.playTone(659, now + 0.11, 0.12, "triangle", 0.1);
        this.playTone(784, now + 0.22, 0.13, "triangle", 0.11);
        this.playTone(1_047, now + 0.35, 0.28, "sine", 0.13);
        break;
      case "loss":
        this.playTone(330, now, 0.16, "triangle", 0.09);
        this.playTone(247, now + 0.14, 0.18, "triangle", 0.08);
        this.playTone(196, now + 0.3, 0.22, "sine", 0.08);
        break;
    }
  }

  private getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.audioGain = this.audioContext.createGain();
      this.audioGain.gain.value = 0.42;
      this.audioGain.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  private playTone(frequency: number, startTime: number, duration: number, type: OscillatorType, volume: number) {
    const context = this.audioContext;
    const output = this.audioGain;
    if (!context || !output) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
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
