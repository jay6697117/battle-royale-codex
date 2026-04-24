import Phaser from "phaser";
import "./styles.css";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./game/content/map";
import { BattleScene } from "./phaser/scenes/BattleScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: "#0b0b12",
  pixelArt: true,
  roundPixels: true,
  scene: [BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: false,
    pixelArt: true
  }
};

new Phaser.Game(config);
