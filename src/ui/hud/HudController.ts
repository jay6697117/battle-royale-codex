import { WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import type { EntityState, GameState } from "../../game/simulation/state";

export class HudController {
  private activeTooltipSlot: number | null = null;
  private root: HTMLElement;
  private lastHtml = "";
  private lastSnapshot = "";

  constructor(root: HTMLElement | null) {
    if (!root) {
      throw new Error("HUD root is missing");
    }
    this.root = root;
    this.root.addEventListener("pointerdown", (event) => this.handleSlotPointerDown(event));
    this.root.addEventListener("click", (event) => this.handleSlotClick(event));
    document.addEventListener("pointerdown", (event) => this.handleOutsidePointerDown(event));
    document.addEventListener("pointermove", (event) => this.handlePointerMove(event));
  }

  update(state: GameState, entities: EntityState[] = Object.values(state.entities)) {
    const snapshot = this.createSnapshot(state, entities);
    if (snapshot === this.lastSnapshot) {
      return;
    }
    this.lastSnapshot = snapshot;

    const html = this.render(state, entities);
    if (html !== this.lastHtml) {
      this.root.innerHTML = html;
      this.lastHtml = html;
    }
  }

  private render(state: GameState, entities: EntityState[]) {
    const fighters = entities.filter(
      (entity) => entity.kind === "player" || entity.kind === "bot"
    );
    const player = state.entities[state.playerId];
    const hudOcclusion = this.getHudOcclusion(entities);
    const stormSeconds = Math.max(
      0,
      Math.ceil((state.storm.shrinkStartMs + state.storm.shrinkDurationMs - state.storm.elapsedMs) / 1_000)
    );

    return `
      <div class="hud-left ${hudOcclusion.left ? "is-occluding" : ""}">
        ${fighters.map((fighter) => this.renderFighterRow(fighter)).join("")}
      </div>
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
      <div class="hud-actions">
        <button type="button">◈</button>
        <button type="button">☺</button>
      </div>
      <div class="inventory ${hudOcclusion.inventory ? "is-occluding" : ""}">
        ${this.renderSlot(1, "weapon-pistol", state.inventory.pistolAmmo, state.inventory.selectedSlot, {
          title: "手枪",
          purpose: "稳定的基础武器，适合中近距离持续输出。",
          usage: "按 1 选择，瞄准敌人后按住左键射击。"
        })}
        ${this.renderSlot(2, "weapon-shotgun", state.inventory.shotgunAmmo, state.inventory.selectedSlot, {
          title: "霰弹枪",
          purpose: "近距离爆发伤害高，贴近敌人时更有效。",
          usage: "按 2 选择，靠近目标后按住左键射击。"
        })}
        ${this.renderSlot(3, "weapon-rifle", state.inventory.rifleAmmo, state.inventory.selectedSlot, {
          title: "步枪",
          purpose: "射程更远、单发伤害更高，适合远距离压制。",
          usage: "按 3 选择，瞄准目标后按住左键射击。"
        })}
        ${this.renderSlot(4, "item-shield", state.inventory.shieldPotions, state.inventory.selectedSlot, {
          title: "护盾药水",
          purpose: "恢复 35 点护盾，护盾最多 60 点。",
          usage: "按 4 选择，再按空格或右键使用。"
        })}
        ${this.renderSlot(5, "item-medkit", state.inventory.medkits, state.inventory.selectedSlot, {
          title: "医疗包",
          purpose: "恢复 38 点生命值，生命值不会超过上限。",
          usage: "按 5 选择，再按空格或右键使用。"
        })}
      </div>
      ${state.phase !== "playing" ? this.renderEndState(state.phase) : ""}
      <div class="player-vitals ${hudOcclusion.playerVitals ? "is-occluding" : ""}">
        <div class="vital-health" style="width:${this.percent(player?.health, player?.maxHealth)}%"></div>
        <div class="vital-shield" style="width:${this.percent(player?.shield, 60)}%"></div>
      </div>
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
          <div class="fighter-name">${fighter.label ?? fighter.id}</div>
          <div class="fighter-bars">
            <i class="health" style="width:${health}%"></i>
            <i class="shield" style="width:${shield}%"></i>
          </div>
          <div class="fighter-value">${Math.ceil(fighter.health ?? 0)}/100</div>
        </div>
      </div>
    `;
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

  private handleSlotClick(event: MouseEvent) {
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

  private renderEndState(phase: "won" | "lost") {
    return `
      <div class="end-state ${phase}">
        <strong>${phase === "won" ? "VICTORY" : "ELIMINATED"}</strong>
        <span>Press R to restart</span>
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

  private createSnapshot(state: GameState, entities: EntityState[]) {
    const stormSeconds = Math.max(
      0,
      Math.ceil((state.storm.shrinkStartMs + state.storm.shrinkDurationMs - state.storm.elapsedMs) / 1_000)
    );
    const entitySnapshot = entities
      .filter((entity) => entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve")
      .map(
        (entity) =>
          `${entity.id}:${entity.alive ? 1 : 0}:${Math.round(entity.x)}:${Math.round(entity.y)}:${Math.ceil(
            entity.health ?? 0
          )}:${Math.ceil(entity.shield ?? 0)}`
      )
      .join("|");

    return [
      state.phase,
      stormSeconds,
      Math.round(state.storm.radius),
      state.inventory.selectedSlot,
      state.inventory.pistolAmmo,
      state.inventory.shotgunAmmo,
      state.inventory.rifleAmmo,
      state.inventory.shieldPotions,
      state.inventory.medkits,
      state.scoreboard.aliveFighters,
      state.scoreboard.kills,
      state.scoreboard.pveKills,
      entitySnapshot
    ].join(";");
  }

  private getHudOcclusion(allEntities: EntityState[]) {
    const entities = allEntities.filter(
      (entity) => entity.alive && (entity.kind === "player" || entity.kind === "bot" || entity.kind === "pve")
    );
    const hasEntityInRegion = (left: number, top: number, right: number, bottom: number) =>
      entities.some((entity) => {
        const x = (entity.x / WORLD_WIDTH) * 100;
        const y = (entity.y / WORLD_HEIGHT) * 100;
        return x >= left && x <= right && y >= top && y <= bottom;
      });

    return {
      left: hasEntityInRegion(0, 0, 27, 67),
      topRight: hasEntityInRegion(76, 0, 100, 12),
      miniMap: hasEntityInRegion(71, 5, 100, 45),
      playerVitals: hasEntityInRegion(38, 72, 62, 86),
      inventory: hasEntityInRegion(31, 78, 69, 100)
    };
  }
}
