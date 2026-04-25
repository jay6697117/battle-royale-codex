import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { IMAGE_ASSETS, SPRITESHEET_ASSETS, TextureKey, UI_ASSETS } from "./manifest";

interface PngInfo {
  width: number;
  height: number;
  colorType: number;
}

interface RgbaPng extends PngInfo {
  data: Uint8Array;
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

const paethPredictor = (left: number, up: number, upperLeft: number) => {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  if (upDistance <= upperLeftDistance) {
    return up;
  }
  return upperLeft;
};

const readRgbaPng = (publicPath: string): RgbaPng => {
  const relativePath = publicPath.replace(/^\//, "");
  const bytes = readFileSync(resolve(process.cwd(), "public", relativePath));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24] ?? 0;
  const colorType = bytes[25] ?? 0;

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Expected 8-bit RGBA PNG for ${publicPath}`);
  }

  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (type === "IDAT") {
      idatChunks.push(bytes.subarray(start, end));
    }
    offset = end + 4;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const data = new Uint8Array(width * height * bytesPerPixel);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset] ?? 0;
    rawOffset += 1;
    const rowStart = y * stride;
    const prevRowStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset + x] ?? 0;
      const left = x >= bytesPerPixel ? data[rowStart + x - bytesPerPixel] ?? 0 : 0;
      const up = y > 0 ? data[prevRowStart + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? data[prevRowStart + x - bytesPerPixel] ?? 0 : 0;
      const reconstructed =
        filter === 0
          ? value
          : filter === 1
            ? value + left
            : filter === 2
              ? value + up
              : filter === 3
                ? value + Math.floor((left + up) / 2)
                : value + paethPredictor(left, up, upperLeft);
      data[rowStart + x] = reconstructed & 0xff;
    }
    rawOffset += stride;
  }

  return { width, height, colorType, data };
};

const hasDetachedLowerArtifact = (
  png: RgbaPng,
  frameIndex: number,
  frameWidth: number,
  frameHeight: number
) => {
  const cols = png.width / frameWidth;
  const frameX = (frameIndex % cols) * frameWidth;
  const frameY = Math.floor(frameIndex / cols) * frameHeight;
  const alphaAt = (x: number, y: number) => {
    const absoluteX = frameX + x;
    const absoluteY = frameY + y;
    return png.data[(absoluteY * png.width + absoluteX) * 4 + 3] ?? 0;
  };
  const visited = new Set<number>();
  const components: Array<{ area: number; top: number; bottom: number }> = [];

  for (let startY = 0; startY < frameHeight; startY += 1) {
    for (let startX = 0; startX < frameWidth; startX += 1) {
      const startKey = startY * frameWidth + startX;
      if (visited.has(startKey) || alphaAt(startX, startY) <= 10) {
        continue;
      }

      const stack: Array<[number, number]> = [[startX, startY]];
      let area = 0;
      let top = startY;
      let bottom = startY;
      while (stack.length > 0) {
        const next = stack.pop();
        if (!next) {
          continue;
        }
        const [x, y] = next;
        const key = y * frameWidth + x;
        if (x < 0 || x >= frameWidth || y < 0 || y >= frameHeight || visited.has(key) || alphaAt(x, y) <= 10) {
          continue;
        }

        visited.add(key);
        area += 1;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
      }

      components.push({ area, top, bottom });
    }
  }

  if (components.length < 2) {
    return false;
  }

  const main = components.reduce((best, item) => (item.area > best.area ? item : best), components[0]!);
  return components.some((item) => item !== main && item.top > main.bottom + 4 && item.area < main.area * 0.5);
};

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

  it("uses large transparent HUD inventory icons", () => {
    const hudIconKeys = [
      TextureKey.HudPistolIcon,
      TextureKey.HudShotgunIcon,
      TextureKey.HudRifleIcon,
      TextureKey.HudShieldIcon,
      TextureKey.HudMedkitIcon
    ];

    for (const key of hudIconKeys) {
      const asset = UI_ASSETS.find((item) => item.key === key);
      expect(asset, key).toBeDefined();
      if (!asset) {
        throw new Error(`Missing HUD icon asset ${key}`);
      }
      const info = readPngInfo(asset.path);
      expect(info.width, key).toBe(96);
      expect(info.height, key).toBe(96);
      expect(hasAlpha(info), key).toBe(true);
    }
  });

  it("keeps character and enemy frames free of detached lower artifacts", () => {
    const animatedEntities = SPRITESHEET_ASSETS.filter(
      (asset) => asset.path.startsWith("/assets/characters/") || asset.path.startsWith("/assets/enemies/")
    );
    const offenders: string[] = [];

    for (const asset of animatedEntities) {
      const png = readRgbaPng(asset.path);
      for (let frame = 0; frame < asset.frames; frame += 1) {
        if (hasDetachedLowerArtifact(png, frame, asset.frameWidth, asset.frameHeight)) {
          offenders.push(`${asset.path}#${frame}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
