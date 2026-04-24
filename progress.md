Original prompt: /Users/zhangjinhui/Desktop/battle-royale-codex/game.png
对当前游戏的边界和边界外，按照这个图，对比差异，再进行百分百深入复刻

## 进度

- 已读取参考图：核心目标是复刻安全区边界与边界外紫色风暴海。
- 已确认当前项目为 Phaser + Vite，主要实现位置在 `src/phaser/scenes/BattleScene.ts`。
- 初步判断本次应只调整视觉层，保持世界尺寸、碰撞、模拟状态不变。

## 待办

- 生成当前游戏截图，与参考图对比边界外风暴、边缘电弧和安全区裁切差异。
- 修改风暴层绘制：外部紫色风暴海、柔和暗角、厚紫白电弧、多段闪电。
- 运行构建与浏览器截图验证。
