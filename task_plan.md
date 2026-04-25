# Task Plan: Monster Progression, Loot, and Gameplay Expansion

## Goal
Add a gameplay loop where killing monsters can grant progression rewards such as player upgrades, equipment drops, and richer monster variety, while preserving the existing game feel and avoiding unnecessary architecture churn.

## Current Status
- Team created: `monster-progression-team`.
- User requested a concrete implementation plan before coding.
- Implementation is not started yet; first phase is codebase exploration and proposal.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Project exploration | complete | Understand current Phaser scene, monster/enemy logic, player stats, UI, tests, and build setup. | Findings in `findings.md`. |
| 2. Gameplay design | complete | Define kill rewards, level-up curve, equipment drops, monster roster, and balance. | Concrete feature spec for user approval. |
| 3. Implementation plan | complete | Map gameplay design to exact files and implementation steps. | Step-by-step plan with validation steps. |
| 4. User approval | complete | Wait for user confirmation before editing gameplay code. | User said “继续”, treated as approval for recommended V1. |
| 5. Implementation | complete | Build approved feature. | Progression, loot, monster variants, HUD, and tests implemented. |
| 6. Validation | complete | Run build/tests and manually verify UI/gameplay in browser if possible. | `npm run typecheck`, `npm run test`, `npm run build`, and browser HUD smoke test passed. |

## Decisions
- Do not implement code until after presenting the plan and getting user confirmation.
- Prefer a focused Phaser-side implementation first; avoid backend/server changes unless exploration proves they are needed.
- Add only gameplay-facing complexity that improves replayability: progression, loot, monster variety, and clear UI feedback.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| No-op edit attempted on `state.ts` | 1 | Tool rejected because old and new strings were identical; no file changed. Continue with targeted edits. |
| New simulation tests failed because projectile kill setup was not stable | 1 | Adjusted test positions to short range, but PVE movement still kept targets alive. |
| New simulation tests still failed after short-range setup | 2 | Froze target PVE speed in tests, but failures continued. |
| New simulation tests still failed after freezing PVE | 3 | Root cause: tests killed all bots, so `resolvePhase` ended the match before projectile travel completed. Keep one passive bot alive far away. |

---

# Task Plan: Full Chinese Localization

## Goal
Localize the current battle royale game into Simplified Chinese across all player-visible UI, Phaser scene feedback, page metadata, and relevant tests while preserving existing uncommitted gameplay changes.

## Current Status
- Team created: `localization-team`.
- Existing planning files belong to the previous monster progression task, so this section is appended instead of overwriting history.
- Repository already has uncommitted changes in gameplay/HUD files; localization must avoid reverting those changes.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Text audit | complete | Find all player-visible English strings and test expectations. | Inventory in `findings.md`. |
| 2. Implementation | complete | Replace visible English with clear Simplified Chinese. | Code/UI/test edits only where needed. |
| 3. Validation | complete | Run typecheck/tests/build and browser smoke test when possible. | Results in `progress.md`. |
| 4. Review | complete | Re-scan for remaining player-facing English. | Only expected key label `E` remains as a control hint. |

## Decisions
- Keep code identifiers in English unless they are rendered to players.
- Do not overwrite or revert existing monster progression and storm visual changes.
- Prefer direct string localization over introducing a full i18n framework unless the audit proves repeated structured localization is needed.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` was empty for planning catchup script | 1 | Re-ran catchup using explicit skill path `/Users/zhangjinhui/.claude/skills/planning-with-files/scripts/session-catchup.py`. |
| Bash regex for all string literals broke shell quoting | 1 | Switch to a Python scanner so quotes are handled safely. |
| `npm run typecheck` failed because `ControlKeys` added `weaponCycle`/`start` but `createInput` did not initialize them | 1 | Inspect existing key usage, then initialize the missing keys without reverting current scene changes. |

---

# Task Plan: Asset Art Redesign

## Goal
Redesign and regenerate the game's player, monster, item, building/prop, and ground art so the game looks richer and more polished while keeping all existing asset paths, dimensions, frame counts, and gameplay behavior compatible.

## Current Status
- Team created: `asset-redesign-team`.
- Current assets are generated by `tools/generate_pixel_assets.py` into `public/assets`.
- Phaser loads assets through `src/game/assets/manifest.ts`; replacing the PNG outputs is the safest implementation path.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Asset audit | complete | Locate render/load paths and existing asset pipeline. | Findings in `findings.md`. |
| 2. Style direction | in_progress | Define a more realistic/polished top-down pixel-art look. | Implemented in generator primitives. |
| 3. Asset regeneration | pending | Update generator and regenerate compatible PNG files. | New PNGs under `public/assets`. |
| 4. Validation | pending | Run manifest/type/test/build checks and browser smoke test. | Results in `progress.md`. |

## Decisions
- Keep the existing pixel-art-compatible pipeline because Phaser config uses `pixelArt: true`.
- Do not change asset paths or manifest metadata unless absolutely necessary.
- Improve realism through richer shading, highlights, material texture, silhouettes, and environmental details rather than introducing incompatible high-resolution photo assets.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|

---

# Task Plan: PLAN.md Full Runtime Asset Redesign

## Goal
Implement `/Users/zhangjinhui/Desktop/battle-royale-codex/PLAN.md`: regenerate all 84 runtime PNG assets loaded by `src/game/assets/manifest.ts` to match `game.png` style, while preserving manifest paths, frame dimensions, frame counts, entity logic, and Phaser gameplay behavior.

## Current Status
- Team created: `plan-md-asset-implementation`.
- User explicitly requested agent team execution.
- `PLAN.md` is the source of truth for this task.
- Existing planning files had older task sections, so this section is appended instead of deleting prior context.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Manifest and asset audit | complete | Confirm exact loaded PNGs, dimensions, frames, alpha/opaque requirements, and tests. | Agent report and `findings.md` update. |
| 2. Imagegen pipeline audit | complete | Inspect current scripts and decide safest route for Codex gateway atlas generation + packing. | Agent report and `findings.md` update. |
| 3. Source atlas generation | complete | Use `codex-gateway-imagegen` skill for the planned atlas set, using `game.png` style reference where possible. | 6 source atlases saved under `output/imagegen-sources`. |
| 4. Packing and asset regeneration | complete | Update/run `tools/build_imagegen_assets.py` or related scripts to crop/normalize/pack PNGs into `public/assets/...`. | Updated runtime PNGs, no manifest path changes. |
| 5. Validation | complete | Run asset manifest test, typecheck, build, and browser screenshot checks. | Tests/build passed; screenshots saved under `output/`. |

## Decisions
- Keep `src/game/assets/manifest.ts` unchanged unless validation proves a true conflict.
- Do not hand-edit `dist/assets`; regenerate via `npm run build` only.
- Treat `public/assets/fx/storm-overlay.png` as non-required unless manifest changes.
- Prefer existing file edits over new files, but generated source atlas outputs are expected artifacts for this task.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` was empty for planning catchup script | 1 | Re-ran catchup using explicit skill path `/Users/zhangjinhui/.claude/skills/planning-with-files/scripts/session-catchup.py`. |

---

# Task Plan: Minimap and Water Visual Fix

## Goal
Fix the screenshot-visible issues where the minimap/safe-zone overlay is too dominant and hard to read, and where water bodies look like large blurry blue blocks with harsh edges instead of integrated top-down pixel-art terrain.

## Current Status
- Team created: `minimap-water-fix`.
- User explicitly requested agent team execution.
- Existing uncommitted changes are present from prior asset work; this task must avoid reverting unrelated changes.
- Visual references are the three user-provided screenshots in this conversation.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Minimap audit | complete | Locate HUD/minimap/safe-zone overlay code and root cause. | Findings updated. |
| 2. Water audit | complete | Locate terrain/water generation and rendering root cause. | Findings updated. |
| 3. Implementation | complete | Apply minimal code/script/asset fixes without changing gameplay behavior. | Updated HUD CSS, scene water rendering, and generated arena art. |
| 4. Validation | complete | Run tests/build and browser screenshot verification. | `typecheck`, tests, build, and browser screenshots passed. |

## Decisions
- Preserve gameplay state, collision zones, map dimensions, asset manifest paths, and frame metadata.
- Prefer fixing generator/rendering code before generating brand-new art.
- Use `codex-gateway-imagegen` only if current source atlases cannot produce acceptable water/minimap visuals.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Duplicate old planning error row prevented a targeted append edit | 1 | Rewrote `task_plan.md` from the already-read full content and appended the new section. |

---

# Task Plan: Monster Sprite Crop and Animation Fix

## Goal
Audit and fix screenshot-visible monster issues where some monsters are cropped incorrectly, show wrong source art, or play mismatched animations.

## Current Status
- Team created: `monster-asset-fix`.
- User explicitly requested agent team execution.
- Existing asset and water/minimap changes are intentionally present and must not be reverted.
- Visual references are Image #4 and Image #5 in this conversation.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Sprite crop audit | complete | Inspect source atlases, enemy crop boxes, and generated enemy PNGs. | Findings updated; audit sheets generated. |
| 2. Animation mapping audit | complete | Inspect PVE type to spritesheet/animation selection in Phaser. | Findings updated; movement flip bug fixed. |
| 3. Implementation | complete | Apply minimal generator/render mapping fixes and regenerate affected assets. | Updated enemy PNGs and runtime flip logic. |
| 4. Validation | complete | Run tests/build and browser screenshot verification. | Typecheck/tests/build passed; browser screenshot saved. |

## Decisions
- Preserve enemy asset paths, frame dimensions, frame counts, and manifest keys unless validation proves a mismatch.
- Prefer fixing crop/mapping logic before requesting new image generation.
- Do not change gameplay stats or collision behavior.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Browser click on start button timed out | 1 | Used Enter key to start the game instead of repeating the same click action. |
| Generic errors-table edit matched older sections too | 1 | Re-read the current monster section and retried with full section context. |
| Team cleanup failed because one teammate was still active | 1 | Sent another shutdown request to the remaining active `enemy-crop-auditor`. |

---

# Task Plan: Baked Background Color Fix

## Goal
Fix screenshot-visible wrong background color blocks behind barrels, crates, bushes, and ruin/water-edge objects without changing gameplay collision, asset paths, or entity rendering behavior.

## Current Status
- User provided four screenshots showing dark/gray/green rectangular or rounded blocks around rendered map objects.
- Existing generated asset and scene changes are present and must not be reverted.
- Root cause investigation confirmed duplicated map layering.
- Fix and validation are complete.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Visual and alpha audit | complete | Check suspicious prop/tile/map PNGs and scene layering. | Findings updated. |
| 2. Generator fix | complete | Stop baking object/foliage/ruin placeholder materials into the opaque arena ground. | Updated `tools/build_imagegen_assets.py` and regenerated `arena-ground.png`. |
| 3. Validation | complete | Verify asset dimensions/tests/build and browser screenshots. | Typecheck/tests/build passed; screenshots saved. |

## Decisions
- Keep runtime prop, foliage, ruin, water collision, and manifest paths unchanged.
- Preserve the opaque `maps/arena-ground.png` requirement, but make it a terrain-only base instead of a terrain-plus-object-placeholder composite.
- Do not request new image generation; this is a post-processing/layering issue.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Browser MCP could not attach because an existing Chrome profile was locked | 1 | Used Playwright against the local Vite server instead of retrying the same MCP action. |

---

# Task Plan: Character and Enemy Frame Crop Fix

## Goal
Audit and fix clipped character and enemy spritesheets under `public/assets/characters` and `public/assets/enemies`, especially heads, weapons, wings, and bodies touching or crossing 96x96 frame boundaries.

## Current Status
- Team created: `sprite-crop-frame-fix`.
- User specifically named `/public/assets/characters` and `/public/assets/enemies`.
- Existing minimap, water, background, HUD, and monster animation changes are present and must not be reverted.
- Fix is complete: generated character/enemy sheets now keep all detected alpha bounds away from 96x96 frame edges.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Character crop audit | complete | Find character frames that touch frame borders or are visually clipped. | Initial audit flagged top-edge character head/hat frames. |
| 2. Enemy crop audit | complete | Find enemy frames that touch frame borders or are visually clipped. | Initial audit flagged bat/wolf right edges and golem side edges. |
| 3. Implementation | complete | Adjust generator sizing/anchors/crop padding and regenerate affected assets. | Updated `tools/build_imagegen_assets.py` and regenerated character/enemy PNGs. |
| 4. Validation | complete | Run tests/build and visual/browser verification. | Border audit now flags 0 frames; typecheck/tests/build and browser smoke passed. |

## Decisions
- Preserve asset paths, manifest keys, frame dimensions, and frame counts.
- Fix generator fitting/cropping and generated PNGs only; do not change runtime entity scale or gameplay behavior.
- Keep the previous enemy primary-pose animation fix; this task only adds frame safety margins around those generated poses.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| DevTools screenshot timed out after browser smoke started | 1 | Avoided repeating the same screenshot action and used Playwright for screenshot validation. |
| Playwright screenshot produced WebGL ReadPixels performance warnings | 1 | Treated them as screenshot-capture noise, filtered those warnings, and confirmed app console issues were 0. |

---

# Task Plan: Water Visual Reference Fix

## Goal
Make the current arena water look closer to `game.png`: muted compact blue ponds with thin pixel-art shorelines, sparse white ripples, and subtle lily/plant details, while preserving map size, water collision zones, asset paths, and runtime behavior.

## Current Status
- User reported current water looks strange after the background-color fix.
- Reference image is `/Users/zhangjinhui/Desktop/battle-royale-codex/game.png`.
- Current generated water was too bright, too glossy, had overly thick dark green/black shore halos, and used too many long white streaks.
- Fix and validation are complete.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Reference audit | complete | Compare `game.png` water against current `arena-ground.png`. | `output/water-reference-current-audit.png`; findings updated. |
| 2. Generator fix | complete | Adjust water shape, shore, palette, ripples, lilies, and plants in `tools/build_imagegen_assets.py`. | Regenerated `arena-ground.png`; fixed montage saved. |
| 3. Validation | complete | Run asset/type/test/build checks and browser screenshot validation. | Typecheck/tests/build passed; browser screenshot saved. |

## Decisions
- Keep water baked into `public/assets/maps/arena-ground.png`; do not re-enable runtime water tile overlays.
- Do not change collision rectangles in `src/game/content/map.ts`.
- Do not regenerate via imagegen; this can be fixed in the packer/post-processing script.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| First water tuning pass became too flat and dark | 1 | Restored muted blue contrast, added shallow edge tint, and placed visible sparse ripples/lilies in water zones. |
| New Vite dev server moved to port 5174 because 5173 was already in use | 1 | Re-ran Playwright validation against `http://127.0.0.1:5174/`. |

---

# Task Plan: Game.png-style Arena Ground Regeneration

## Goal
Regenerate `public/assets/maps/arena-ground.png` as a 1920x1080 terrain-only background closer to `game.png`, keeping grass/water/path detail in the background while leaving walls, crates, barrels, chests, foliage, characters, monsters, pickups, HUD, and storm overlays to runtime rendering. If visual terrain changes require it, synchronize `src/game/content/map.ts` collision rectangles so water blocks movement and stone walls block movement/projectiles consistently.

## Current Status
- User approved the next step after the collision feasibility analysis.
- Existing uncommitted generated asset changes are present and must be preserved unless this task intentionally regenerates the same outputs.
- Previous work established that `arena-ground.png` is opaque RGB and is used both by Phaser background rendering and the HUD minimap.

## Phases

| Phase | Status | Purpose | Output |
|---|---|---|---|
| 1. Planning and audit | complete | Record task context, re-check generator/collision/render constraints, and avoid overwriting unrelated work. | Updated planning files and targeted source reads. |
| 2. Background regeneration | complete | Produce a better `arena-ground.png` using `game.png` style cues while keeping it terrain-only. | Regenerated 1920x1080 RGB map background. |
| 3. Collision alignment | complete | Compare regenerated water/cover layout against `map.ts`; adjust only if visual layout changes. | Overlay confirmed no `map.ts` change is needed. |
| 4. Validation | complete | Run relevant tests/build and browser screenshot check. | Tests/build passed; Playwright screenshots saved. |

## Decisions
- Superseded: the earlier terrain-only decision is replaced by the user's Scheme C request on 2026-04-25.
- Bake stone walls/ruins into `arena-ground.png`, but still do not bake crates, barrels, chests, characters, monsters, pickups, HUD, or storm UI.
- Keep runtime `MAP_FEATURES` responsible for grass/bush props and solid props, but skip runtime wall/ruin drawing to avoid duplicated walls.
- Keep `collidesForMovement`/`collidesForProjectile` as the gameplay source of truth; do not remove `STRUCTURE_ZONES` collision.
- Prefer updating the existing generator pipeline over replacing code with ad hoc image edits, so future regenerations remain reproducible.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` was empty for planning catchup script | 1 | Re-ran catchup using explicit skill path `/Users/zhangjinhui/.claude/skills/planning-with-files/scripts/session-catchup.py`. |
| Image gateway rejected `1920x1080` because 1080 is not divisible by 16 | 1 | Use a divisible candidate size such as `1920x1088`, then crop/post-process to the required 1920x1080 asset size. |
| Chrome DevTools MCP could not open the default profile because another browser instance was already running | 1 | Avoid repeating the same call; use an isolated context or Playwright browser validation instead. |
