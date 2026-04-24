import { WORLD_HEIGHT, WORLD_WIDTH } from "../../game/content/map";
import type { EntityState, GameState } from "../../game/simulation/state";

export class HudController {
  private root: HTMLElement;
  private lastHtml = "";

  constructor(root: HTMLElement | null) {
    if (!root) {
      throw new Error("HUD root is missing");
    }
    this.root = root;
  }

  update(state: GameState) {
    const html = this.render(state);
    if (html !== this.lastHtml) {
      this.root.innerHTML = html;
      this.lastHtml = html;
    }
  }

  private render(state: GameState) {
    const fighters = Object.values(state.entities).filter(
      (entity) => entity.kind === "player" || entity.kind === "bot"
    );
    const player = state.entities[state.playerId];
    const stormSeconds = Math.max(
      0,
      Math.ceil((state.storm.shrinkStartMs + state.storm.shrinkDurationMs - state.storm.elapsedMs) / 1_000)
    );

    return `
      <div class="hud-left">
        ${fighters.map((fighter) => this.renderFighterRow(fighter)).join("")}
      </div>
      <div class="hud-top-right">
        <div class="stat-pill"><span class="stat-icon">●</span>${state.scoreboard.aliveFighters}</div>
        <div class="stat-pill"><span class="stat-icon skull">◆</span>${state.scoreboard.kills + state.scoreboard.pveKills}</div>
      </div>
      <div class="mini-map">
        <div class="mini-storm" style="${this.stormMiniStyle(state)}"></div>
        ${fighters.map((fighter) => this.renderMiniDot(fighter)).join("")}
        ${Object.values(state.entities)
          .filter((entity) => entity.kind === "pve" && entity.alive)
          .map((entity) => this.renderMiniDot(entity))
          .join("")}
      </div>
      <div class="storm-timer"><span></span>${this.formatTime(stormSeconds)}</div>
      <div class="hud-actions">
        <button type="button">◈</button>
        <button type="button">☺</button>
      </div>
      <div class="inventory">
        ${this.renderSlot(1, "Pistol", state.inventory.pistolAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(2, "Shotgun", state.inventory.shotgunAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(3, "Rifle", state.inventory.rifleAmmo, state.inventory.selectedSlot)}
        ${this.renderSlot(4, "Shield", state.inventory.shieldPotions, state.inventory.selectedSlot)}
        ${this.renderSlot(5, "Medkit", state.inventory.medkits, state.inventory.selectedSlot)}
      </div>
      ${state.phase !== "playing" ? this.renderEndState(state.phase) : ""}
      <div class="player-vitals">
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

  private renderSlot(index: number, label: string, count: number, selectedSlot: number) {
    return `
      <div class="inventory-slot ${selectedSlot === index ? "active" : ""}">
        <span class="slot-key">${index}</span>
        <span class="slot-icon ${label.toLowerCase()}"></span>
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
}
