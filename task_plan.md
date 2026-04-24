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
