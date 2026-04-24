# Findings: Monster Progression, Loot, and Gameplay Expansion

## Current Discoveries
- Team `monster-progression-team` has been created for this task.
- Repository root contains Phaser/Vite-style files: `src`, `index.html`, `vite.config.ts`, `package.json`, and existing visual assets/screenshots.
- Existing `progress.md` was from a previous storm/boundary visual task, so this task will append a new section rather than overwrite it.

## Codebase Notes
- Source files are organized under `src/game`, `src/phaser`, and `src/ui`.
- Main Phaser scene is `src/phaser/scenes/BattleScene.ts`; it owns Phaser rendering, input, event FX, and calls `stepSimulation` every frame.
- Core gameplay state and logic are in `src/game/simulation/state.ts`.
- Existing entity types already include `player`, `bot`, `pve`, `projectile`, and `pickup`.
- Existing PVE types are `bat` and `slime`; initial PVE spawns are created in `createInitialGameState` via `createPve`.
- `damageEntity` already detects eliminations and increments `scoreboard.pveKills` when the player kills PVE.
- `collectPickups` already supports ammo, medkit, shield, rifle, shotgun, and coin pickups.
- HUD is `src/ui/hud/HudController.ts`; it already displays alive fighters and total kills (`kills + pveKills`), inventory, minimap dots, and vitals.
- Build/test scripts from `package.json`: `npm run build`, `npm run test`, `npm run typecheck`.
- Existing tests include asset manifest, map content, simulation, and storm visuals.

## Gameplay Notes
- Best insertion point for kill rewards is inside `damageEntity` when `entity.health <= 0` and `sourceId === state.playerId`.
- Best insertion point for random loot is a helper called from player-caused elimination, creating pickup entities near the killed monster.
- Best insertion point for player levels is `GameState`, likely a small `progression` object to avoid bloating inventory.
- Existing `events` can be extended with `levelup`/`loot` feedback or reused through value-bearing pickup/elimination events.
- Proposed player progression: level 1 starts at 0 XP; PVE grants XP; thresholds can be 0/40/95/165/250/350. Level up grants maxHealth, damageMultiplier, speedMultiplier, and maybe ammo bonus.
- Proposed loot: weak monsters mostly drop coins/ammo; tougher monsters can drop medkit/shield/weapon ammo. Use deterministic-ish helper based on entity id and kill count if tests need stable results, or controlled Math.random if current code style stays simple.
- Proposed monster expansion without new art: extend `PveType` from `bat | slime` to variants such as `bat`, `slime`, `wolf`, `golem`, `spitter`; render wolf/spitter with bat sprites and golem with slime sprites, changing stats/behavior/tint/scale in Phaser.
- Proposed UI: add a compact XP/Level panel near player vitals and include coins/equipment bonuses in HUD snapshot so changes re-render correctly.

## Testing Notes
- Test runner is Vitest via `npm run test`.
- Type checking is `npm run typecheck`; production build is `npm run build`.
- Existing simulation tests can cover PVE kill rewards and pickup collection without browser automation.

## Team Reports
- `code-explorer` confirmed key insertion points: kill reward in `damageEntity`, loot via `createPickup`, PVE expansion via `PveType/createPve/updatePve`, HUD refresh via `HudController.createSnapshot`.
- `game-designer` recommended implementing a controlled first version: experience/leveling, visible UI feedback, basic loot, and monster variety before complex equipment trees or bosses.
- Best implementation scope remains the recommended V1/B-style version: progression + loot + several monster variants + HUD + Vitest validation.

---

# Findings: Full Chinese Localization

## Current Discoveries
- Team `localization-team` has been created for this task.
- Existing uncommitted gameplay changes touch `src/game/simulation/state.ts`, `src/phaser/scenes/BattleScene.ts`, `src/ui/hud/HudController.ts`, `src/styles.css`, and `src/game/simulation/simulation.test.ts`; localization work must preserve them.
- Initial validation of planning catchup found no previous planning-file updates for this localization task.

## Audit Notes
- `index.html` still uses `lang="en"` and title `Battle Royale Codex`; both are player/browser-visible and should be Chinese.
- `src/ui/hud/HudController.ts` has already localized inventory tooltips and progression bonuses, but end-state text remains `VICTORY`, `ELIMINATED`, and `Press R to restart`.
- `src/game/simulation/state.ts` initializes visible fighter labels as `Rogue99`, `PixelSamurai`, `WildNinja`, `Cowboy`, and `MageDude`; these render above characters and in the HUD roster.
- `src/phaser/scenes/BattleScene.ts` renders entity labels and event feedback; current effects are mostly visual rings/sparks, so adding localized floating event text would improve full Chinese feedback.
- `src/game/content/weapons.ts` had weapon labels `Pistol`, `Shotgun`, and `Rifle`; they were localized to `手枪`、`霰弹枪`、`步枪`.
- Final visible English marker scan found no old player-facing English; the only remaining visible Latin letter is `E`, used as a keyboard control hint.
