import { WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import type { EntityState, GameState } from "../../game/simulation/state";

export class HudController {
  private root: HTMLElement;
  private lastHtml = "";
  private lastSnapshot = "";

  constructor(root: HTMLElement | null) {
    if (!root) {
      throw new Error("HUD root is missing");
    }
    this.root = root;
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
        ${this.renderSlot(1, "weapon-pistol", state.inventory.pistolAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(2, "weapon-shotgun", state.inventory.shotgunAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(3, "weapon-rifle", state.inventory.rifleAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(4, "item-shield", state.inventory.shieldPotions, state.inventory.selectedSlot)}
        ${this.renderSlot(5, "item-medkit", state.inventory.medkits, state.inventory.selectedSlot)}
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

  private renderSlot(index: number, slotClass: string, count: number, selectedSlot: number) {
    return `
      <div class="inventory-slot ${slotClass} ${selectedSlot === index ? "active" : ""}">
        <span class="slot-key">${index}</span>
        <span class="slot-icon"></span>
        <strong>${count}</strong>
      </div>
    `;
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
