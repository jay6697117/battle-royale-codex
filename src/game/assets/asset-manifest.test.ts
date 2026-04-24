import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_ASSETS, SPRITESHEET_ASSETS, TextureKey, UI_ASSETS } from "./manifest";

interface PngInfo {
  width: number;
  height: number;
  colorType: number;
}

const readPngInfo = (publicPath: string): PngInfo => {
  const relativePath = publicPath.replace(/^\//, "");
  const filePath = resolve(process.cwd(), "public", relativePath);
  const bytes = readFileSync(filePath);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25] ?? 0
  };
};

const hasAlpha = (info: PngInfo) => info.colorType === 4 || info.colorType === 6;

describe("asset manifest", () => {
  it("points every image asset at an existing PNG file", () => {
    const assets = [...IMAGE_ASSETS, ...SPRITESHEET_ASSETS, ...UI_ASSETS];

    for (const asset of assets) {
      const relativePath = asset.path.replace(/^\//, "");
      expect(asset.path.endsWith(".png"), asset.key).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", relativePath)), asset.key).toBe(true);
    }
  });

  it("keeps spritesheet dimensions aligned with frame metadata", () => {
    for (const asset of SPRITESHEET_ASSETS) {
      const info = readPngInfo(asset.path);
      expect(info.width, asset.key).toBe(asset.frameWidth * asset.frames);
      expect(info.height, asset.key).toBe(asset.frameHeight);
      expect(hasAlpha(info), asset.key).toBe(true);
    }
  });

  it("marks transparent prop, fx, and ui assets as PNGs with alpha", () => {
    const transparentAssets = [...IMAGE_ASSETS, ...UI_ASSETS].filter((asset) => asset.requiresAlpha);

    for (const asset of transparentAssets) {
      const info = readPngInfo(asset.path);
      expect(hasAlpha(info), asset.key).toBe(true);
    }
  });

  it("keeps the arena ground opaque so the map cannot show grid seams", () => {
    const ground = IMAGE_ASSETS.find((asset) => asset.key === TextureKey.ArenaGround);

    expect(ground).toBeDefined();
    if (!ground) {
      throw new Error("Arena ground asset is missing");
    }
    expect(readPngInfo(ground.path).colorType, TextureKey.ArenaGround).toBe(2);
  });
});
