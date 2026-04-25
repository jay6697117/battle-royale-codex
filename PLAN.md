# 参考 `game.png` 重做全量游戏美术资产

## Summary

目标是重新生成 `src/game/assets/manifest.ts` 实际加载的 84 个运行时 PNG，并让整体观感贴近 `game.png`：高质俯视像素风、圆润手绘感、清晰轮廓、低噪声草地、水体边缘自然、石墙/灌木/角色/怪物统一。

保持现有 Phaser 业务逻辑、manifest 路径、帧宽高、帧数、实体类型不变。`public/assets/fx/storm-overlay.png` 未被 manifest 加载，不纳入必需资产。`dist/assets` 只通过 `npm run build` 重新生成。

## Asset Set

按业务逻辑生成这些资产：

- 地图与环境：`arena-ground.png`、`storm-sea.png`、grass/water/ruins/foliage tiles。
- 玩家角色：`rogue`、`samurai`、`ninja`、`cowboy`、`mage`，每个生成 `idle`、`walk`、`shoot`、`hurt` spritesheet。
- PVE 敌人：`bat`、`slime`、`wolf`、`spitter`、`golem`，按 manifest 现有动画生成。
- 拾取物：`ammo`、`medkit`、`shield`、`pistol`、`rifle`、`shotgun`、`coin`，包含静态图和 4-frame glow sheet。
- 道具与特效：`crate`、`chest`、`barrel`、projectile、muzzle flash、hit spark、pickup ring、storm arc、storm edge。
- HUD/UI：team panel、inventory slots、stat pill、action button、minimap frame、5 个 rank badge、5 个角色头像、5 个背包图标。

## Implementation Changes

- 使用 `codex-gateway-imagegen` skill 通过 Codex gateway 生成新的源 atlas，不走内置 `image_gen`，也不走 CLI fallback。
- 用 `game.png` 作为风格参考图；提示词锁定为“top-down premium pixel-art battle royale, rounded hand-painted pixel clusters, readable at small scale, no text, no watermark”。
- 生成策略改为 7 组源图，而不是 84 次独立生成：
  - terrain/material atlas
  - full arena map reference
  - player class sprite atlas
  - enemy sprite atlas
  - pickup/prop/fx atlas
  - HUD/UI atlas
  - optional refinement atlas for weak outputs
- 更新 `tools/build_imagegen_assets.py`，让它从 `codex-gateway-imagegen` skill 输出的源图裁剪、抠 alpha、归一化、打包到 `public/assets/...`。
- 精灵表保持现有尺寸：角色/敌人 96x96 frame，pickup glow 48x48 frame，FX 按 manifest 现有 frame size。
- 透明资源使用 chroma-key + `remove_chroma_key.py`，并做 alpha 验证；`arena-ground.png` 与 `storm-sea.png` 保持 RGB opaque。
- 地图生成要按 `src/game/content/map.ts` 的 water、ruin、bush、crate/chest/barrel 坐标重新组合，避免只用一张随机贴图导致碰撞区和视觉区错位。

## Quality Bar

- `arena-ground.png` 必须接近 `game.png`：草地分区清楚但不花，水塘位置与业务水区一致，石墙/灌木不遮挡核心读数。
- 玩家和敌人在当前缩放下必须比上一版更大、更圆润、更接近 `game.png` 的轮廓比例。
- HUD 图标、头像、rank badge 不能含任何生成文字或伪文字。
- FX 以读数优先：子弹、枪口火光、命中火花、拾取光圈、风暴边缘必须小尺寸可辨。
- 不修改 `manifest.ts`，除非验证发现 manifest 与真实业务逻辑冲突。

## Test Plan

执行后必须验证：

- `npm test -- src/game/assets/asset-manifest.test.ts`
- `npm run typecheck`
- `npm run build`
- 浏览器截图检查：
  - 开始弹窗画面
  - 进入战斗后的无遮挡画面
  - 至少一张包含水区、石墙、灌木、拾取物、PVE 敌人的画面
- 人工验收对照 `game.png`：
  - 整体色彩、地图层次、角色比例、HUD 密度接近参考图
  - 没有 alpha 毛边、magenta/green 残留、空白帧、错帧、裁切头脚

## Assumptions

- 本轮实施会覆盖当前已有的 `public/assets/...` imagegen 资产。
- `tools/build_imagegen_assets.py` 可以继续作为生成管线，但要按 `game.png` 重新调整源 atlas、裁剪坐标和地图合成逻辑。
- `dist/assets` 和 `dist/index.html` 只作为构建产物更新，不手工编辑。
- 由于当前处于 Plan Mode，本回复只给出可执行计划；实际 `codex-gateway-imagegen` skill 调用和文件覆盖应在切回执行模式后进行。
