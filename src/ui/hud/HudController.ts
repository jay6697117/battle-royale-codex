import { WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import type { EntityState, GameState } from "../../game/simulation/state";

export interface ViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class HudController {
  private activeTooltipSlot: number | null = null;
  private root: HTMLElement;
  private lastHtml = "";
  private lastSnapshot = "";

  constructor(root: HTMLElement | null, private readonly onStart?: () => void, private readonly onRestart?: () => void) {
    if (!root) {
      throw new Error("HUD root is missing");
    }
    this.root = root;
    this.root.addEventListener("pointerdown", (event) => this.handleSlotPointerDown(event));
    this.root.addEventListener("click", (event) => this.handleRootClick(event));
    document.addEventListener("pointerdown", (event) => this.handleOutsidePointerDown(event));
    document.addEventListener("pointermove", (event) => this.handlePointerMove(event));
  }

  update(state: GameState, entities: EntityState[] = Object.values(state.entities), showStartNotice = false, viewport?: ViewportBounds) {
    const snapshot = this.createSnapshot(state, entities, showStartNotice, viewport);
    if (snapshot === this.lastSnapshot) {
      return;
    }
    this.lastSnapshot = snapshot;

    const html = this.render(state, entities, showStartNotice, viewport);
    if (html !== this.lastHtml) {
      this.root.innerHTML = html;
      this.lastHtml = html;
    }
  }

  private render(state: GameState, entities: EntityState[], showStartNotice: boolean, viewport?: ViewportBounds) {
    const fighters = entities.filter(
      (entity) => entity.kind === "player" || entity.kind === "bot"
    );
    const hudOcclusion = this.getHudOcclusion(entities, viewport);
    const stormSeconds = Math.max(
      0,
      Math.ceil((state.storm.shrinkStartMs + state.storm.shrinkDurationMs - state.storm.elapsedMs) / 1_000)
    );
    const xpPercent = this.percent(state.progression.xp, state.progression.xpToNextLevel);
    const damageBonus = Math.round((state.progression.damageMultiplier - 1) * 100);

    return `
      ${showStartNotice ? this.renderStartNotice() : ""}
      <div class="hud-left ${hudOcclusion.left ? "is-occluding" : ""}">
        ${fighters.map((fighter) => this.renderFighterRow(fighter)).join("")}
      </div>
      <div class="hud-right-stack">
        <div class="hud-top-right ${hudOcclusion.topRight ? "is-occluding" : ""}">
          <div class="stat-pill"><span class="stat-icon">●</span>${state.scoreboard.aliveFighters}</div>
          <div class="stat-pill"><span class="stat-icon skull">◆</span>${state.scoreboard.kills + state.scoreboard.pveKills}</div>
        </div>
        <div class="mini-map ${hudOcclusion.miniMap ? "is-occluding" : ""}">
          <div class="mini-storm" style="${this.stormMiniStyle(state)}"></div>
          ${fighters.map((fighter) => this.renderMiniDot(fighter)).join("")}
          ${entities
            .filter((entity) => entity.kind === "pve" && entity.alive)
            .map((entity) => this.renderMiniDot(entity))
            .join("")}
        </div>
        <div class="storm-timer ${hudOcclusion.miniMap ? "is-occluding" : ""}"><span></span>${this.formatTime(stormSeconds)}</div>
      </div>
      <div class="progression-panel ${hudOcclusion.progression ? "is-occluding" : ""}">
        <div class="progression-main"><strong>等级 ${state.progression.level}</strong><div class="xp-bar"><i style="width:${xpPercent}%"></i></div><span>${state.progression.xp}/${state.progression.xpToNextLevel}</span></div>
        <div class="progression-meta">
          <span>金币 ${state.inventory.coins}</span>
          <span>伤害 +${damageBonus}%</span>
          <span class="current-slot">当前 <b>${this.slotLabel(state.inventory.selectedSlot)}</b></span>
        </div>
      </div>
      <div class="hud-actions">
        <button type="button">◈</button>
        <button type="button">☺</button>
      </div>
      <div class="inventory ${hudOcclusion.inventory ? "is-occluding" : ""}">
        ${this.renderSlot(1, "weapon-pistol", state.inventory.pistolAmmo, state.inventory.selectedSlot, {
          title: "手枪",
          purpose: "稳定的基础武器，适合中近距离持续输出。",
          usage: "电脑按 1 直选或按 E 循环，鼠标瞄准后左键射击；手机用切换按钮选中后点开火。"
        })}
        ${this.renderSlot(2, "weapon-shotgun", state.inventory.shotgunAmmo, state.inventory.selectedSlot, {
          title: "霰弹枪",
          purpose: "近距离爆发伤害高，贴近敌人时更有效。",
          usage: "电脑按 2 直选或按 E 循环，靠近目标后左键射击；手机用切换按钮选中后点开火。"
        })}
        ${this.renderSlot(3, "weapon-rifle", state.inventory.rifleAmmo, state.inventory.selectedSlot, {
          title: "步枪",
          purpose: "射程更远、单发伤害更高，适合远距离压制。",
          usage: "电脑按 3 直选或按 E 循环，鼠标瞄准后左键射击；手机用切换按钮选中后点开火。"
        })}
        ${this.renderSlot(4, "item-shield", state.inventory.shieldPotions, state.inventory.selectedSlot, {
          title: "护盾药水",
          purpose: "恢复 35 点护盾，护盾最多 60 点。",
          usage: "电脑按 4 直选或按 E 循环，再按空格/右键使用；手机选中后点开火使用。"
        })}
        ${this.renderSlot(5, "item-medkit", state.inventory.medkits, state.inventory.selectedSlot, {
          title: "医疗包",
          purpose: "恢复 38 点生命值，生命值不会超过上限。",
          usage: "电脑按 5 直选或按 E 循环，再按空格/右键使用；手机选中后点开火使用。"
        })}
      </div>
      ${state.phase !== "playing" ? this.renderEndState(state.phase) : ""}
    `;
  }

  private renderFighterRow(fighter: EntityState) {
    const health = this.percent(fighter.health, fighter.maxHealth);
    const shield = this.percent(fighter.shield, 60);
    const deadClass = fighter.alive ? "" : " dead";
    return `
      <div class="fighter-row${deadClass}">
        <div class="fighter-rank rank-${fighter.teamIndex ?? 0}">${fighter.teamIndex ?? 0}</div>
        <div class="fighter-portrait ${fighter.role ?? "rogue"}"></div>
        <div class="fighter-body">
          <div class="fighter-meta">
            <div class="fighter-name">${fighter.label ?? fighter.id}</div>
            <div class="fighter-value">${Math.ceil(fighter.health ?? 0)}/${Math.ceil(fighter.maxHealth ?? 100)}</div>
          </div>
          <div class="fighter-bars">
            <i class="health" style="width:${health}%"></i>
            <i class="shield" style="width:${shield}%"></i>
          </div>
        </div>
      </div>
    `;
  }

  private slotLabel(selectedSlot: number) {
    if (selectedSlot === 1) {
      return "手枪";
    }
    if (selectedSlot === 2) {
      return "霰弹枪";
    }
    if (selectedSlot === 3) {
      return "步枪";
    }
    if (selectedSlot === 4) {
      return "护盾药水";
    }
    return "医疗包";
  }

  private renderSlot(
    index: number,
    slotClass: string,
    count: number,
    selectedSlot: number,
    tooltip: { title: string; purpose: string; usage: string }
  ) {
    return `
      <button class="inventory-slot ${slotClass} ${selectedSlot === index ? "active" : ""} ${this.activeTooltipSlot === index ? "show-tooltip" : ""}" type="button" data-slot="${index}" aria-label="${tooltip.title}：${tooltip.purpose}${tooltip.usage}" aria-describedby="slot-${index}-tooltip">
        <span class="slot-key">${index}</span>
        <span class="slot-icon" aria-hidden="true"></span>
        <strong>${count}</strong>
        <span class="slot-tooltip" id="slot-${index}-tooltip" role="tooltip">
          <b>${tooltip.title}</b>
          <span>${tooltip.purpose}</span>
          <em>${tooltip.usage}</em>
        </span>
      </button>
    `;
  }

  private handleSlotPointerDown(event: PointerEvent) {
    const slot = (event.target as HTMLElement).closest<HTMLButtonElement>(".inventory-slot");
    if (slot) {
      event.stopPropagation();
    }
  }

  private handleRootClick(event: MouseEvent) {
    const startNotice = (event.target as HTMLElement).closest(".start-notice");
    if (startNotice) {
      event.stopPropagation();
      this.onStart?.();
      return;
    }

    const restartButton = (event.target as HTMLElement).closest(".end-state-button");
    if (restartButton) {
      event.stopPropagation();
      this.onRestart?.();
      return;
    }

    const slot = (event.target as HTMLElement).closest<HTMLButtonElement>(".inventory-slot");
    if (!slot) {
      return;
    }
    event.stopPropagation();
    this.activeTooltipSlot = Number(slot.dataset.slot);
    this.lastSnapshot = "";
  }

  private handleOutsidePointerDown(event: PointerEvent) {
    if (!this.activeTooltipSlot || this.root.contains(event.target as Node)) {
      return;
    }
    this.activeTooltipSlot = null;
    this.lastSnapshot = "";
  }

  private handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }
    const slot = (event.target as HTMLElement).closest<HTMLButtonElement>(".inventory-slot");
    const nextSlot = slot ? Number(slot.dataset.slot) : null;
    if (this.activeTooltipSlot === nextSlot) {
      return;
    }
    this.activeTooltipSlot = nextSlot;
    this.lastSnapshot = "";
  }

  private renderMiniDot(entity: EntityState) {
    const x = (entity.x / WORLD_WIDTH) * 100;
    const y = (entity.y / WORLD_HEIGHT) * 100;
    const className =
      entity.kind === "player" ? "player" : entity.kind === "bot" ? `bot team-${entity.teamIndex ?? 0}` : "pve";
    return `<i class="mini-dot ${className}" style="left:${x}%;top:${y}%"></i>`;
  }

  private stormMiniStyle(state: GameState) {
    const diameter = (state.storm.radius * 2) / WORLD_WIDTH;
    const left = (state.storm.centerX - state.storm.radius) / WORLD_WIDTH;
    const top = (state.storm.centerY - state.storm.radius) / WORLD_HEIGHT;
    return `left:${left * 100}%;top:${top * 100}%;width:${diameter * 100}%;height:${diameter * (WORLD_WIDTH / WORLD_HEIGHT) * 100}%`;
  }

  private renderStartNotice() {
    return `
      <div class="start-notice" role="dialog" aria-label="游戏开始前说明">
        <div class="start-notice-header">
          <span>战术公告</span>
          <strong>大逃杀开始前说明</strong>
          <em>先看清键位和道具，准备好再开战。</em>
        </div>
        <div class="start-notice-grid">
          <section class="start-notice-controls">
            <div class="start-notice-control-set start-notice-control-desktop">
              <h2>电脑操作</h2>
              <p><b>WASD / 方向键</b><span>移动角色</span></p>
              <p><b>鼠标</b><span>瞄准方向</span></p>
              <p><b>左键</b><span>武器槽位射击</span></p>
              <p><b>E</b><span>循环切换武器和道具</span></p>
              <p><b>1 - 5</b><span>直接选择槽位</span></p>
              <p><b>空格 / 右键</b><span>道具槽位使用</span></p>
            </div>
            <div class="start-notice-control-set start-notice-control-touch">
              <h2>手机操作</h2>
              <p><b>左下摇杆</b><span>拖动控制移动</span></p>
              <p><b>右下切换</b><span>循环切换武器和道具</span></p>
              <p><b>右下开火</b><span>武器槽位射击</span></p>
              <p><b>右下开火</b><span>道具槽位使用</span></p>
              <p><b>库存图标</b><span>点击查看槽位用途</span></p>
              <p><b>金币 / 经验</b><span>拾取奖励并提升战力</span></p>
            </div>
          </section>
          <section class="start-notice-items">
            <h2>武器道具说明</h2>
            <p><b>手枪</b><span>稳定基础武器，中近距离补伤害。</span></p>
            <p><b>霰弹枪</b><span>近距离爆发，贴近敌人更有效。</span></p>
            <p><b>步枪</b><span>射程更远，适合持续压制。</span></p>
            <p><b>护盾药水</b><span>回复护盾，先抗住伤害。</span></p>
            <p><b>医疗包</b><span>回复生命，安全时使用。</span></p>
            <p><b>金币 / 经验</b><span>击败怪物或拾取奖励，升级强化伤害。</span></p>
          </section>
        </div>
        <button class="start-notice-button" type="button">开始游戏 Enter</button>
      </div>
    `;
  }

  private renderEndState(phase: "won" | "lost") {
    return `
      <div class="end-state ${phase}">
        <strong>${phase === "won" ? "胜利" : "已被淘汰"}</strong>
        <span>按 R 或点击按钮重新开始</span>
        <button class="end-state-button" type="button">重新开始</button>
      </div>
    `;
  }

  private formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  private percent(value: number | undefined, max: number | undefined) {
    if (!value || !max) {
      return 0;
    }
    return Math.max(0, Math.min(100, (value / max) * 100));
  }

  private createSnapshot(state: GameState, entities: EntityState[], showStartNotice: boolean, viewport?: ViewportBounds) {
    const stormSeconds = Math.max(
      0,
      Math.ceil((state.storm.shrinkStartMs + state.storm.shrinkDurationMs - state.storm.elapsedMs) / 1_000)
    );
    const entitySnapshot = entities
      .filter((entity) => entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve")
      .map((entity) => {
        const screenPosition = this.entityScreenPosition(entity, viewport);
        return `${entity.id}:${entity.alive ? 1 : 0}:${Math.round(screenPosition.x)}:${Math.round(
          screenPosition.y
        )}:${Math.round(screenPosition.radius)}:${Math.ceil(entity.health ?? 0)}:${Math.ceil(entity.shield ?? 0)}`;
      })
      .join("|");

    return [
      showStartNotice ? 1 : 0,
      state.phase,
      stormSeconds,
      Math.round(state.storm.radius),
      viewport ? `${Math.round(viewport.left)}:${Math.round(viewport.top)}:${Math.round(viewport.width)}:${Math.round(viewport.height)}` : "no-viewport",
      state.inventory.selectedSlot,
      state.inventory.pistolAmmo,
      state.inventory.shotgunAmmo,
      state.inventory.rifleAmmo,
      state.inventory.shieldPotions,
      state.inventory.medkits,
      state.inventory.coins,
      state.progression.level,
      state.progression.xp,
      state.progression.xpToNextLevel,
      state.progression.damageMultiplier.toFixed(2),
      state.progression.speedMultiplier.toFixed(2),
      state.scoreboard.aliveFighters,
      state.scoreboard.kills,
      state.scoreboard.pveKills,
      entitySnapshot
    ].join(";");
  }

  private getHudOcclusion(allEntities: EntityState[], viewport?: ViewportBounds) {
    const elements = {
      left: this.root.querySelector<HTMLElement>(".hud-left"),
      topRight: this.root.querySelector<HTMLElement>(".hud-top-right"),
      miniMap: this.root.querySelector<HTMLElement>(".mini-map"),
      progression: this.root.querySelector<HTMLElement>(".progression-panel"),
      inventory: this.root.querySelector<HTMLElement>(".inventory")
    };
    const entities = allEntities.filter(
      (entity) => entity.alive && (entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve")
    );
    const hasEntityTouching = (element: HTMLElement | null) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return entities.some((entity) => this.circleIntersectsRect(this.entityScreenPosition(entity, viewport), rect));
    };

    return {
      left: hasEntityTouching(elements.left),
      topRight: hasEntityTouching(elements.topRight),
      miniMap: hasEntityTouching(elements.miniMap),
      progression: hasEntityTouching(elements.progression),
      inventory: hasEntityTouching(elements.inventory)
    };
  }

  private entityScreenPosition(entity: EntityState, viewport?: ViewportBounds) {
    const fallbackRect = this.root.getBoundingClientRect();
    const gameLeft = viewport?.left ?? fallbackRect.left;
    const gameTop = viewport?.top ?? fallbackRect.top;
    const gameWidth = viewport?.width ?? fallbackRect.width;
    const gameHeight = viewport?.height ?? fallbackRect.height;
    const scale = Math.min(gameWidth / WORLD_WIDTH, gameHeight / WORLD_HEIGHT);

    return {
      x: gameLeft + (entity.x / WORLD_WIDTH) * gameWidth,
      y: gameTop + (entity.y / WORLD_HEIGHT) * gameHeight,
      radius: Math.max(6, entity.radius * scale)
    };
  }

  private circleIntersectsRect(circle: { x: number; y: number; radius: number }, rect: DOMRect) {
    const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
    const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }
}
