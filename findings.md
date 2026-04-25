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

---

# Findings: Asset Art Redesign

## Current Discoveries
- Team `asset-redesign-team` has been created for this task.
- The game uses Phaser + Vite and loads art through `src/game/assets/manifest.ts`.
- Existing PNG art is generated by `tools/generate_pixel_assets.py`, then stored under `public/assets`.
- The safest path is to improve the generator and regenerate PNGs while preserving file names, dimensions, transparency, and spritesheet frame counts.

## Asset Pipeline Notes
- Character sheets: `public/assets/characters/{role}/{idle,walk,shoot,hurt}.png`, 96px frame height, multiple 96x96 frames.
- Enemy sheets: `public/assets/enemies/bat/*` and `public/assets/enemies/slime/*`, 96x96 frames.
- Pickups: static 48x48 icons plus 48x48 glow sheets.
- Props/buildings: `props/crate.png`, `props/chest.png`, `props/barrel.png`; ruins use `tiles/ruins-tiles.png`.
- Map background: `maps/arena-ground.png`, opaque RGB 1920x1080; tests require it to stay opaque.
- Phaser render points: map/props in `BattleScene.createMap`, entities in `BattleScene.createEntityView`, PVE styling in `BattleScene.stylePveSprite`.

## Visual Direction
- Keep top-down readable pixel art, but add semi-realistic lighting, material gradients, rim highlights, cast shadows, surface noise, and clearer silhouettes.
- Player variants should feel tactical/fantasy-survival: layered clothing, heads/helmets/hats, weapons with metallic highlights, animated bob/recoil/hurt feedback.
- Monsters should be more distinct through wings, eyes, slime glow, teeth/spikes, and stronger shadows.
- Props/buildings should look more physical: planks, metal bands, stone cracks, highlights, moss, and depth.

---

# Findings: PLAN.md Full Runtime Asset Redesign

## Current Discoveries
- Team `plan-md-asset-implementation` has been created for this task.
- User requested implementation of `PLAN.md` with an agent team.
- `PLAN.md` requires regenerating the 84 runtime PNG assets actually loaded by `src/game/assets/manifest.ts` and excludes `public/assets/fx/storm-overlay.png` unless manifest usage changes.
- Required style direction: match `game.png` with top-down premium pixel-art battle royale, rounded hand-painted pixel clusters, readable small-scale silhouettes, no text, no watermark.

## Audit Results
- Manifest loads exactly 84 runtime PNGs: 13 image assets, 50 spritesheets, and 21 UI assets.
- `public/assets/fx/storm-overlay.png` exists but is not manifest-loaded and stays outside the required set.
- Required fixed sizes include: arena-ground 1920x1080 RGB, storm-sea 512x512 RGB, character/enemy frames 96x96, pickup frames 48x48, FX frames 64x64 except storm-edge 128x96, UI icons 96x96, portraits 56x56, rank badges 34x34.
- Asset manifest tests require every spritesheet PNG to have alpha, even grass/water tiles; `requiresAlpha` images and UI also need alpha.
- Current `tools/build_imagegen_assets.py` already crops, trims alpha, resizes, packs strips, composes the map, and writes `public/assets`; it uses Pillow only.
- Newly generated player/enemy source atlases are RGB-like images with chroma green backgrounds, so `load_source` or a downstream stage must remove green before `trim_alpha`; otherwise whole cells will be treated as opaque sprites.
- Source QA confirmed no obvious watermark/text, source-01 is usable as a 3x2 material grid, and source-02/source-03 are usable 4x5 grids.
- Source QA confirmed source-04/source-05 are 1024x1024, so old crop coordinates above y=1024 for storm-edge, storm-arc, HUD icons, and portraits will create empty or wrong crops unless replaced with normalized/proportional crop boxes.
- Existing script inputs are `output/imagegen-sources/source-01.png`, `source-02-alpha.png`, `source-03-alpha.png`, `source-04-alpha.png`, and `source-05-alpha.png`; `source-06.png` exists but is unused.
- No `tools/remove_chroma_key.py` exists, so chroma-key removal should be added inside `tools/build_imagegen_assets.py` instead of depending on a missing script.
- Map alignment must use all `WATER_ZONES`, `STRUCTURE_ZONES`, `FOLIAGE_ZONES`, `PROP_SOLID_ZONES`, and the west barrel from `src/game/content/map.ts`.
- PLAN mismatch: “5 backpack icons” means the manifest’s 5 HUD item icons: pistol, shotgun, rifle, shield, medkit.

---

# Findings: Minimap and Water Visual Fix

## Current Discoveries
- Team `minimap-water-fix` has been created for this task.
- Screenshot issue 1: the minimap/safe-zone ring is visually too dominant; the large circular frame, dark storm fill, and grid background make the top-right HUD feel like it is covering the playfield.
- Screenshot issue 2: water appears as large blurred blue pools with hard rectangular/stepped silhouettes and limited shoreline blending, especially near land bridges and islands.
- Minimap HTML is rendered in `src/ui/hud/HudController.ts`; CSS is in `src/styles.css`.
- Current minimap CSS uses `width: clamp(170px, 13vw, 190px)`, circular clipping, a strong `minimap-frame.png`, radial fake water, grid lines, and 0.86 opacity.
- `HudController.stormMiniStyle` maps storm circle into the minimap based on world dimensions; this is a HUD-only issue and should not change gameplay storm state.
- Root cause for water: `public/assets/maps/arena-ground.png` already includes pond art, then `BattleScene.createWaterPatch` tiled `TextureKey.WaterTiles` over the same rectangular water features, creating blocky doubled-blue ponds.
- Final fix keeps water collision zones unchanged, stops runtime water tile overlays, and improves `tools/build_imagegen_assets.py` so regenerated `arena-ground.png` has organic water masks, shoreline darkening, and small water highlights.
- Final fix changes `.mini-map` from a large circular generated-grid UI to a smaller 16:9 thumbnail using the real arena-ground image, with a subtler storm circle and smaller dots.

---

# Findings: Monster Sprite Crop and Animation Fix

## Current Discoveries
- Team `monster-asset-fix` has been created for this task.
- Source atlas `output/imagegen-sources/source-03-alpha.png` is visually a 5-row x 4-column enemy sheet: row 1 bat, row 2 purple slime, row 3 dark wolf, row 4 green spitter, row 5 stone golem.
- Current generator extracts each row as four separate poses, then uses different columns as animation bases. This can make one enemy animation cycle through different silhouettes if the generated row columns are not consistent animation frames.
- Current runtime maps `wolf` normal animation to `wolf/dash`, `spitter` to `spitter/hop`, `golem` to `golem/hop`, `slime` to `slime/hop`, and bats to `bat/fly` in `BattleScene.animationForPve`.
- Current runtime hurt mappings use `spitter/squash`, `golem/squash`, and `slime/squash`; those are generated from different atlas columns and may visually look like different creatures rather than hurt frames.
- Generated audit sheet `output/enemy-sprite-audit.png` confirmed the old output had cross-pose/cross-silhouette issues: wolf hurt used a mound-like pose, spitter hop included a long purple projectile/overlay shape, and golem squash became rubble rather than a damaged golem.
- Fixed generator now uses each enemy row's primary pose for all animations, applying bob/shift/tint variations instead of swapping to different atlas columns. This keeps every animation visually the same creature.
- Fixed runtime PVE flip logic now follows horizontal movement direction instead of a time-based sine wave, so monsters no longer randomly flip while moving/attacking.
- Generated audit sheet `output/enemy-sprite-audit-fixed.png` confirms bat, slime, wolf, spitter, and golem animations now keep consistent silhouettes across normal and hurt/squash frames.
- Late crop-auditor report independently confirmed the same root cause: `source-03-alpha.png` was treated as an implicit row/type + column/action atlas even though those columns were not safe animation frames; some public outputs also contained older mismatched generated PNGs.
- Late animation-auditor report independently confirmed manifest frame sizes were correct, so the fix should stay at resource generation/mapping level rather than changing spritesheet frame dimensions.

---

# Findings: Baked Background Color Fix

## Current Discoveries
- User screenshots show wrong colored blocks around barrels, crates, bushes, ruins, and water-edge props.
- Direct image inspection confirmed `public/assets/props/barrel.png`, `crate.png`, `chest.png`, `tiles/foliage-tiles.png`, and `tiles/ruins-tiles.png` all have transparent alpha where expected.
- `public/assets/maps/arena-ground.png` is intentionally opaque RGB, but it currently contains baked dark/gray/green placeholder patches for structures, props, foliage, and barrel zones.
- `BattleScene.createPropLayer` then draws runtime props, foliage clusters, and ruin tiles over the baked ground. This double layering creates the screenshot-visible colored background blocks.
- Water is no longer duplicated at runtime because water features are skipped in `createPropLayer`; water should remain baked into the map ground.
- The minimal fix is in `tools/build_imagegen_assets.py`: keep water and terrain details baked into `arena-ground.png`, but stop pasting structure, foliage, prop, and barrel material masks into the ground because those are rendered separately by Phaser.
- After regeneration, `public/assets/maps/arena-ground.png` is terrain/water only at those locations; runtime crates, barrels, foliage clusters, and ruins now sit directly on grass/water surroundings without the old dark/gray/green blocks.

---

# Findings: Character and Enemy Frame Crop Fix

## Current Discoveries
- Automated alpha-bound scanning of `public/assets/characters/**/*.png` and `public/assets/enemies/**/*.png` initially flagged 65 frames with margins <= 5 px against their 96x96 frame edge.
- Character issues were mostly top-edge clipping/tightness: rogue, samurai, and ninja idle/walk/hurt frames had heads, hats, or upper silhouettes at y=0-3; cowboy/mage/ninja shoot frames were tight on the left because weapon poses were shifted.
- Enemy issues were mostly side-edge tightness: bat fly/dash/hurt and wolf dash/hurt touched or nearly touched the right edge; golem hop/squash had only about 4-5 px side margins.
- Root cause was in `tools/build_imagegen_assets.py`: character/enemy source cells were cropped with `crop_grid(..., margin=18)`, then fitted large into 96x96 frames, and animation `dx/dy` shifts were applied after fitting without rechecking frame margins.
- The fix keeps manifest paths, frame sizes, and frame counts unchanged while adding generator-level safety: larger trim padding, smaller fit scale, higher in-frame margins, safer anchor positioning, and clamped animation shifts.
- Regenerated audit results now flag 0 tight frames. Review outputs: `output/sprite-crop-tight-audit-fixed.png`, `output/sprite-crop-tight-audit-fixed.txt`, and `output/sprite-crop-full-review-fixed.png`.

---

# Findings: Water Visual Reference Fix

## Current Discoveries
- Reference `game.png` water has muted medium/deep blue fill, compact pond shapes, pixelated but thin dark shoreline, short sparse white ripples, a few lily pads, and small aquatic plants.
- Current `arena-ground.png` water is too saturated/bright cyan, has too many long white highlight strokes, and has a thick dark green/black halo that makes ponds look like raised blobs instead of recessed water.
- `output/imagegen-sources/source-01.png` already contains a useful water material, but directly tiling it across large masks makes the whole pond look noisy and glossy.
- Current code in `tools/build_imagegen_assets.py` creates water through `organic_water_mask`, `shore_mask`, `water_surface`, `water_edge`, and random detail strokes. The fix should tune these exact steps rather than changing runtime Phaser code.
- Accurate comparison montage saved at `output/water-reference-current-audit.png`.
- First tuning pass made the water less glossy but too dark/flat, so a second pass restored muted blue contrast, shallow edge tint, sparse short ripples, fixed lily pads, and small aquatic plants.
- Fixed comparison montage saved at `output/water-reference-fixed-audit.png`; current water is now closer to `game.png` with darker muted fill, thinner edges, and fewer highlights.

---

# Findings: Game.png-style Arena Ground Regeneration

## Current Discoveries
- `game.png` is a full gameplay screenshot; it should be used only as a style/layout reference because it includes HUD, characters, monsters, pickups, projectiles, storm edge, labels, and minimap.
- `public/assets/maps/arena-ground.png` must remain 1920x1080 opaque RGB and is reused by both the Phaser ground layer and CSS minimap.
- Current runtime already blocks grounded movement on `WATER_ZONES`, blocks movement/projectiles on `SOLID_ZONES`, and lets bullets cross water/foliage.
- The generator should keep water and terrain baked into `arena-ground.png`, but not bake runtime-rendered ruins, props, barrels, or foliage patches.
- Collision is code-driven from `src/game/content/map.ts`, not pixel-driven from the PNG. Visual water/stone changes must be kept aligned with `WATER_ZONES` and `STRUCTURE_ZONES`.
- The accepted candidate contains terrain only: grass, water, subtle paths, small stones/flowers/grass detail, and no visible HUD/characters/monsters/pickups/walls/crates/barrels/chests.
- The 1920x1080 gateway request failed because image dimensions must be divisible by 16, so the successful workflow is 1920x1088 generation followed by centered crop to 1920x1080.
- Collision overlay review showed no `map.ts` adjustment was needed for the terrain-only version: water boxes still covered the ponds, and solid boxes were grass-only where runtime ruins/walls drew.
- New user decision on 2026-04-25: switch to Scheme C, bake stone walls/ruins directly into `arena-ground.png`, disable runtime wall/ruin drawing, and keep `map.ts` collision unchanged.
- The Scheme C implementation also bakes large bush/tree `FOLIAGE_ZONES` into the background and disables runtime bush rendering, because the user explicitly included 大草丛 / 树丛 in the background list.
- Crates, barrels, and chests are still runtime-rendered and still participate in `SOLID_ZONES`, so pickup/prop visuals remain above the background and do not get baked into the minimap image.
- The first baked-wall procedural result looked too much like regular copied tiles and did not satisfy the `game.png` reference requirement; the accepted direction is a gateway-generated natural battlefield background with hand-placed-looking walls, organic foliage clusters, darker painterly grass, and softer water edges.

---

# Findings: Water Collision and Player Visibility Fix

## Current Discoveries
- User screenshot shows the player inside the southwest pond after the regenerated background, so visible water is larger/differently shaped than the old `WATER_ZONES` collision rectangles.
- Existing `collidesForMovement` semantics already block player/bot/non-bat PvE on `WATER_ZONES`; the bug was visual/collision mismatch, not missing movement collision calls.
- Automatic color-bound audit of the current v2 `arena-ground.png` found visible water around southwest pond `x=289..617, y=642..976` and north pond `x=1146..1392, y=126..323`, both outside parts of the old `WATER_ZONES`.
- `WATER_ZONES` were expanded into several rectangles that cover the generated ponds while keeping nearby dry land walkable.
- `map.test.ts` now checks player, bot, slime, wolf, spitter, and golem are blocked by visible water, while bat-type PvE can still cross and projectiles still ignore water.
- Player visibility is fixed in `BattleScene.ts` with a player-only gold pulse ring, a `▼ 你` marker above the player, and brighter own label styling.

---

# Findings: Mobile Touch Controls

## Current Discoveries
- Team `mobile-controls` has been created for this task.
- Existing input is centralized in `src/phaser/scenes/BattleScene.ts`.
- `createInput` registers WASD, arrow keys, number slots, `E` weapon cycle, space item use, Enter start, and `R` restart.
- `collectInput` creates `InputFrame` values for `moveX`, `moveY`, `aimX`, `aimY`, `shooting`, `selectedSlot`, and `useItem`.
- Mouse left button shoots only when selected slot is 1-3; right button and space queue item use.
- `src/game/input/actions.ts` has no dash or interact field.
- `src/game/simulation/state.ts` auto-collects pickups when the player overlaps a pickup, so a separate pickup button is unnecessary.
- Final mobile mapping after user correction: left virtual joystick drives `moveX/moveY`; `切换` cycles slots 1-5; `开火` shoots weapon slots 1-3 or uses the currently selected item slot 4/5.
- Quick fire taps must be queued until the next `collectInput` call, otherwise pointerdown/pointerup can both occur between simulation frames and the shot is lost.
