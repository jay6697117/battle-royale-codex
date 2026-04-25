from __future__ import annotations

import math
import random
import re
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "output" / "imagegen-sources"
ASSET_ROOT = ROOT / "public" / "assets"

Color = tuple[int, int, int, int]
Box = tuple[int, int, int, int]
NormBox = tuple[float, float, float, float]
Zone = tuple[int, int, int, int]

TILE_SIZE = 32

WATER_ZONES: list[Zone] = [
    (275, 640, 310, 56),
    (270, 696, 168, 139),
    (270, 835, 245, 130),
    (1165, 92, 90, 33),
    (1105, 125, 253, 120),
    (1105, 245, 175, 75),
]


def map_zones(name: str) -> list[Zone]:
    map_path = ROOT / "src" / "game" / "content" / "map.ts"
    source = map_path.read_text()
    match = re.search(rf"export const {name}: RectZone\[] = \[(.*?)\];", source, re.S)
    if match is None:
        raise RuntimeError(f"{name} not found in {map_path}")
    return [
        (int(x), int(y), int(width), int(height))
        for x, y, width, height in re.findall(
            r"x: (\d+), y: (\d+), width: (\d+), height: (\d+)",
            match.group(1),
        )
    ]


def map_structure_zones() -> list[Zone]:
    return map_zones("STRUCTURE_ZONES")


def rgba(hex_value: str, alpha: int = 255) -> Color:
    value = hex_value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def load_source(name: str, *, remove_green: bool = False) -> Image.Image:
    path = SOURCE_ROOT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing imagegen source: {path}")
    image = Image.open(path).convert("RGBA")
    if remove_green:
        return remove_chroma_green(image)
    return image


def is_chroma_green(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return g >= 115 and g - r >= 45 and g - b >= 45 and g >= int(max(r, b) * 1.35)


def remove_chroma_green(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size
    visited: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []

    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in visited or not is_chroma_green(pixels[x, y]):
            continue
        visited.add((x, y))
        if x > 0:
            stack.append((x - 1, y))
        if x < width - 1:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y < height - 1:
            stack.append((x, y + 1))

    alpha = source.getchannel("A")
    mask = Image.new("L", source.size, 0)
    mask_pixels = mask.load()
    for x, y in visited:
        mask_pixels[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.55))
    source.putalpha(ImageChops.subtract(alpha, mask).point(lambda value: 0 if value < 12 else value))
    return source


def save_rgba(image: Image.Image, relative_path: str) -> None:
    output = ASSET_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGBA").save(output)


def save_rgb(image: Image.Image, relative_path: str) -> None:
    output = ASSET_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output)


def resize_cover(image: Image.Image, size: tuple[int, int], resample: Image.Resampling = Image.Resampling.BICUBIC) -> Image.Image:
    source = image.convert("RGBA")
    target_w, target_h = size
    scale = max(target_w / source.width, target_h / source.height)
    scaled = source.resize((math.ceil(source.width * scale), math.ceil(source.height * scale)), resample)
    left = (scaled.width - target_w) // 2
    top = (scaled.height - target_h) // 2
    return scaled.crop((left, top, left + target_w, top + target_h))


def resize_contain(
    image: Image.Image,
    size: tuple[int, int],
    *,
    scale: float = 0.88,
    anchor_y: float = 0.72,
    resample: Image.Resampling = Image.Resampling.NEAREST,
    min_margin: int = 0,
    trim_padding: int = 4,
) -> Image.Image:
    subject = trim_alpha(image, padding=trim_padding)
    max_w = max(1, min(int(size[0] * scale), size[0] - min_margin * 2))
    max_h = max(1, min(int(size[1] * scale), size[1] - min_margin * 2))
    ratio = min(max_w / max(1, subject.width), max_h / max(1, subject.height))
    resized = subject.resize(
        (max(1, round(subject.width * ratio)), max(1, round(subject.height * ratio))),
        resample,
    )
    frame = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = round(size[1] * anchor_y - resized.height)
    if min_margin > 0 and resized.width <= size[0] - min_margin * 2:
        x = max(min_margin, min(size[0] - resized.width - min_margin, x))
    else:
        x = max(0, min(size[0] - resized.width, x))
    if min_margin > 0 and resized.height <= size[1] - min_margin * 2:
        y = max(min_margin, min(size[1] - resized.height - min_margin, y))
    else:
        y = max(0, min(size[1] - resized.height, y))
    frame.alpha_composite(resized, (x, y))
    return frame


def trim_alpha(image: Image.Image, padding: int = 4) -> Image.Image:
    source = image.convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 10 else 0).getbbox()
    if bbox is None:
        return source
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(source.width, right + padding)
    bottom = min(source.height, bottom + padding)
    return source.crop((left, top, right, bottom))


def remove_detached_lower_artifacts(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 255 if value > 10 else 0)
    pixels = alpha.load()
    width, height = source.size
    visited: set[tuple[int, int]] = set()
    components: list[tuple[int, Box, set[tuple[int, int]]]] = []

    for start_y in range(height):
        for start_x in range(width):
            if pixels[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            stack = [(start_x, start_y)]
            points: set[tuple[int, int]] = set()
            left = right = start_x
            top = bottom = start_y
            while stack:
                x, y = stack.pop()
                if (x, y) in visited or pixels[x, y] == 0:
                    continue
                visited.add((x, y))
                points.add((x, y))
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= next_x < width and 0 <= next_y < height and (next_x, next_y) not in visited:
                        stack.append((next_x, next_y))
            components.append((len(points), (left, top, right + 1, bottom + 1), points))

    if len(components) < 2:
        return source

    main_area, main_box, _ = max(components, key=lambda item: item[0])
    _, _, _, main_bottom = main_box
    cleaned_alpha = source.getchannel("A")
    cleaned_pixels = cleaned_alpha.load()
    for area, box, points in components:
        _, top, _, _ = box
        if top > main_bottom + 4 and area < main_area * 0.5:
            for x, y in points:
                cleaned_pixels[x, y] = 0
    source.putalpha(cleaned_alpha)
    return source


def crop_box(image: Image.Image, box: Box, padding: int = 8) -> Image.Image:
    left, top, right, bottom = box
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def scale_box(box: NormBox, image: Image.Image) -> Box:
    left, top, right, bottom = box
    return (
        round(left * image.width),
        round(top * image.height),
        round(right * image.width),
        round(bottom * image.height),
    )


def crop_norm_box(image: Image.Image, box: NormBox, padding: int = 8) -> Image.Image:
    return crop_box(image, scale_box(box, image), padding)


def rect_box(zone: Zone) -> Box:
    x, y, width, height = zone
    return (x, y, x + width, y + height)


def crop_grid(image: Image.Image, cols: int, rows: int, col: int, row: int, margin: int = 0) -> Image.Image:
    cell_w = image.width / cols
    cell_h = image.height / rows
    left = int(col * cell_w) + margin
    top = int(row * cell_h) + margin
    right = int((col + 1) * cell_w) - margin
    bottom = int((row + 1) * cell_h) - margin
    return image.crop((left, top, right, bottom))


def tile_material(material: Image.Image, size: tuple[int, int], seed: int) -> Image.Image:
    rng = random.Random(seed)
    base = Image.new("RGBA", size, (0, 0, 0, 0))
    material = ImageEnhance.Color(material.convert("RGBA")).enhance(1.06)
    patch = resize_cover(material, (192, 192), Image.Resampling.NEAREST)
    for y in range(0, size[1], 192):
        for x in range(0, size[0], 192):
            tile = patch.copy()
            if rng.random() < 0.5:
                tile = ImageOps.mirror(tile)
            if rng.random() < 0.5:
                tile = ImageOps.flip(tile)
            base.alpha_composite(tile, (x, y))
    return base.crop((0, 0, size[0], size[1]))


def tile_frames(material: Image.Image, count: int, rng: random.Random, transparent: bool = False) -> Image.Image:
    frames: list[Image.Image] = []
    source = resize_cover(material, (320, 320), Image.Resampling.NEAREST)
    for index in range(count):
        x = rng.randint(0, source.width - TILE_SIZE * 2)
        y = rng.randint(0, source.height - TILE_SIZE * 2)
        frame = source.crop((x, y, x + TILE_SIZE * 2, y + TILE_SIZE * 2)).resize((TILE_SIZE, TILE_SIZE), Image.Resampling.NEAREST)
        if transparent:
            mask = Image.new("L", (TILE_SIZE, TILE_SIZE), 0)
            mask_draw = ImageDraw.Draw(mask)
            if index % 3 == 0:
                mask_draw.rounded_rectangle((2, 2, 30, 29), radius=2, fill=255)
            elif index % 3 == 1:
                mask_draw.polygon([(2, 3), (31, 1), (28, 24), (4, 31)], fill=255)
            else:
                mask_draw.ellipse((-1, 2, 33, 31), fill=255)
            frame.putalpha(mask)
        else:
            frame.putalpha(255)
        frames.append(frame)
    return make_strip(frames)


def make_runtime_ruin_tiles(materials: dict[str, Image.Image]) -> Image.Image:
    rng = random.Random(7100)
    tile_frames(materials["grass"], 24, rng)
    tile_frames(materials["water"], 8, rng)
    return tile_frames(materials["ruin"], 12, rng, True)


def bake_structure_zones(target: Image.Image, materials: dict[str, Image.Image]) -> None:
    tiles = make_runtime_ruin_tiles(materials)
    for x, y, width, height in map_structure_zones():
        cols = max(1, math.ceil(width / TILE_SIZE))
        rows = max(1, math.ceil(height / TILE_SIZE))
        for row in range(rows):
            for col in range(cols):
                tile_width = min(TILE_SIZE, width - col * TILE_SIZE)
                tile_height = min(TILE_SIZE, height - row * TILE_SIZE)
                frame = (col + row) % 4 if row == 0 or col == 0 or row == rows - 1 or col == cols - 1 else 4 + ((col + row) % 4)
                tile = tiles.crop((frame * TILE_SIZE, 0, frame * TILE_SIZE + tile_width, tile_height))
                target.alpha_composite(tile, (x + col * TILE_SIZE, y + row * TILE_SIZE))


def make_runtime_foliage_tiles(materials: dict[str, Image.Image]) -> Image.Image:
    foliage_frames: list[Image.Image] = []
    foliage_source = resize_cover(materials["foliage"], (256, 256), Image.Resampling.NEAREST)
    for index in range(8):
        crop = foliage_source.crop((index * 19 % 180, index * 31 % 180, index * 19 % 180 + 72, index * 31 % 180 + 72))
        frame = crop.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.NEAREST)
        mask = Image.new("L", (TILE_SIZE, TILE_SIZE), 0)
        draw = ImageDraw.Draw(mask)
        if index < 5:
            draw.ellipse((2, 3, 30, 29), fill=255)
            draw.ellipse((8, 0, 26, 23), fill=220)
        else:
            draw.line((16, 31, 14, 8), fill=255, width=3)
            draw.line((16, 25, 25, 13), fill=220, width=3)
            draw.line((15, 25, 7, 14), fill=220, width=3)
        frame.putalpha(mask.filter(ImageFilter.GaussianBlur(0.25)))
        foliage_frames.append(frame)
    return make_strip(foliage_frames)


def paste_material(target: Image.Image, material: Image.Image, mask: Image.Image, tint: tuple[float, float, float] = (1, 1, 1)) -> None:
    patch = resize_cover(material, target.size, Image.Resampling.NEAREST)
    if tint != (1, 1, 1):
        r, g, b, a = patch.split()
        patch = Image.merge(
            "RGBA",
            (
                r.point(lambda value: int(max(0, min(255, value * tint[0])))),
                g.point(lambda value: int(max(0, min(255, value * tint[1])))),
                b.point(lambda value: int(max(0, min(255, value * tint[2])))),
                a,
            ),
        )
    target.alpha_composite(Image.composite(patch, Image.new("RGBA", target.size, (0, 0, 0, 0)), mask))


def shift_with_margin(image: Image.Image, dx: int, dy: int, min_margin: int) -> Image.Image:
    if not dx and not dy:
        return image
    alpha = image.getchannel("A").point(lambda value: 255 if value > 10 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    dx = max(min_margin - left, min(image.width - min_margin - right, dx))
    dy = max(min_margin - top, min(image.height - min_margin - bottom, dy))
    shifted = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shifted.alpha_composite(image, (dx, dy))
    return shifted


def make_sprite_frame(
    subject: Image.Image,
    frame_size: tuple[int, int],
    *,
    scale: float,
    anchor_y: float,
    dx: int = 0,
    dy: int = 0,
    tint: Color | None = None,
    min_margin: int = 0,
    trim_padding: int = 4,
) -> Image.Image:
    subject = remove_detached_lower_artifacts(subject)
    frame = resize_contain(subject, frame_size, scale=scale, anchor_y=anchor_y, min_margin=min_margin, trim_padding=trim_padding)
    if tint:
        overlay = Image.new("RGBA", frame.size, tint)
        alpha = frame.getchannel("A")
        overlay.putalpha(alpha.point(lambda value: int(value * (tint[3] / 255))))
        frame = Image.alpha_composite(frame, overlay)
    return shift_with_margin(frame, dx, dy, min_margin)


def make_strip(frames: Iterable[Image.Image]) -> Image.Image:
    items = list(frames)
    sheet = Image.new("RGBA", (sum(item.width for item in items), items[0].height), (0, 0, 0, 0))
    offset = 0
    for frame in items:
        sheet.alpha_composite(frame, (offset, 0))
        offset += frame.width
    return sheet


def remove_warm_muzzle_flash(subject: Image.Image) -> Image.Image:
    source = subject.convert("RGBA")
    pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            if a > 10 and x > source.width * 0.5 and r > 150 and g > 105 and b < 120 and r - b > 70:
                pixels[x, y] = (r, g, b, 0)
    return source


def add_cowboy_muzzle_flash(frame: Image.Image, index: int) -> Image.Image:
    result = frame.copy().convert("RGBA")
    draw = ImageDraw.Draw(result, "RGBA")
    length = 14 + (index % 2) * 5
    offset = (index % 3) - 1
    draw.polygon(
        [(72, 43 + offset), (72 + length, 38 + offset), (91, 45 + offset), (72 + length, 51 + offset)],
        fill=rgba("#ffd84a", 210),
    )
    draw.polygon(
        [(75, 44 + offset), (86, 42 + offset), (92, 45 + offset), (86, 48 + offset)],
        fill=rgba("#fff6b0", 235),
    )
    draw.line((70, 45 + offset, 92, 45 + offset), fill=rgba("#ff9f2d", 190), width=2)
    return result


def add_soft_glow(subject: Image.Image, color: Color, radius: int, strength: int) -> Image.Image:
    alpha = subject.getchannel("A")
    glow_alpha = alpha.filter(ImageFilter.GaussianBlur(radius)).point(lambda value: min(255, int(value * strength / 100)))
    glow = Image.new("RGBA", subject.size, color)
    glow.putalpha(glow_alpha)
    return Image.alpha_composite(glow, subject)


def make_pickup_glow_frame(subject: Image.Image, frame: int) -> Image.Image:
    canvas = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = 15 + frame * 2
    alpha = 90 - frame * 10
    draw.ellipse((24 - radius, 24 - radius, 24 + radius, 24 + radius), outline=rgba("#fff174", alpha), width=3)
    draw.ellipse((24 - radius + 4, 24 - radius + 4, 24 + radius - 4, 24 + radius - 4), fill=rgba("#ffe66d", 20 + frame * 8))
    canvas.alpha_composite(subject)
    return canvas


def generate_environment() -> dict[str, Image.Image]:
    atlas = load_source("source-01.png")
    materials = {
        "grass": crop_grid(atlas, 3, 2, 0, 0, 10),
        "dark_grass": crop_grid(atlas, 3, 2, 1, 0, 10),
        "water": crop_grid(atlas, 3, 2, 2, 0, 10),
        "ruin": crop_grid(atlas, 3, 2, 0, 1, 10),
        "foliage": crop_grid(atlas, 3, 2, 1, 1, 10),
        "storm": crop_grid(atlas, 3, 2, 2, 1, 10),
    }

    ground = tile_material(materials["grass"], (1920, 1080), 9100)

    rng = random.Random(42)
    patch_layer = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    patch_draw = ImageDraw.Draw(patch_layer, "RGBA")
    for _ in range(140):
        x = rng.randint(-80, 1900)
        y = rng.randint(-70, 1060)
        w = rng.randint(48, 180)
        h = rng.randint(28, 95)
        color = rng.choice([rgba("#5f8b48", 15), rgba("#9cc66b", 13), rgba("#3e6f3b", 12)])
        patch_draw.ellipse((x, y, x + w, y + h), fill=color)
    ground.alpha_composite(patch_layer)

    def organic_water_mask(boxes: list[Box]) -> Image.Image:
        mask = Image.new("L", ground.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        water_rng = random.Random(7317)
        for box in boxes:
            left, top, right, bottom = box
            mask_draw.rounded_rectangle((left + 3, top + 3, right - 3, bottom - 3), radius=26, fill=255)
            for _ in range(max(2, (right - left) // 110)):
                width = water_rng.randint(34, 86)
                height = water_rng.randint(24, 68)
                x = water_rng.randint(left - 10, max(left - 9, right - width + 10))
                y = water_rng.randint(top - 8, max(top - 7, bottom - height + 8))
                mask_draw.ellipse((x, y, x + width, y + height), fill=255)
            for _ in range(max(1, (right - left) // 150)):
                width = water_rng.randint(24, 58)
                height = water_rng.randint(20, 52)
                side = water_rng.choice(["left", "right", "top", "bottom"])
                if side == "left":
                    x = left - width // 2
                    y = water_rng.randint(top, max(top, bottom - height))
                elif side == "right":
                    x = right - width // 2
                    y = water_rng.randint(top, max(top, bottom - height))
                elif side == "top":
                    x = water_rng.randint(left, max(left, right - width))
                    y = top - height // 2
                else:
                    x = water_rng.randint(left, max(left, right - width))
                    y = bottom - height // 2
                mask_draw.ellipse((x, y, x + width, y + height), fill=0)
        return mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2)).point(lambda value: 255 if value > 96 else 0)

    water_mask = organic_water_mask([rect_box(zone) for zone in WATER_ZONES])
    shore_mask = ImageChops.subtract(water_mask.filter(ImageFilter.MaxFilter(19)), water_mask).filter(ImageFilter.GaussianBlur(1.0))
    paste_material(ground, materials["dark_grass"], shore_mask, (0.78, 0.88, 0.72))

    water_surface = tile_material(materials["water"], ground.size, 7318)
    water_surface = ImageEnhance.Color(water_surface).enhance(0.45)
    water_surface = ImageEnhance.Contrast(water_surface).enhance(0.88)
    water_surface = ImageEnhance.Brightness(water_surface).enhance(0.82)
    r, g, b, a = water_surface.split()
    water_surface = Image.merge(
        "RGBA",
        (
            r.point(lambda value: int(value * 0.68)),
            g.point(lambda value: int(value * 0.86)),
            b.point(lambda value: int(value * 0.98)),
            a,
        ),
    )
    water_fill = Image.blend(Image.new("RGBA", ground.size, rgba("#2b7190", 255)), water_surface, 0.34)
    water_fill.putalpha(water_mask)
    ground.alpha_composite(water_fill)

    shallow_edge = ImageChops.subtract(water_mask, water_mask.filter(ImageFilter.MinFilter(17))).filter(ImageFilter.GaussianBlur(1.0))
    shallow_layer = Image.new("RGBA", ground.size, rgba("#4f94a8", 62))
    shallow_layer.putalpha(shallow_edge.point(lambda value: int(value * 0.38)))
    ground.alpha_composite(shallow_layer)

    water_edge = ImageChops.subtract(water_mask, water_mask.filter(ImageFilter.MinFilter(7))).filter(ImageFilter.GaussianBlur(0.45))
    edge_layer = Image.new("RGBA", ground.size, rgba("#0a2d42", 95))
    edge_layer.putalpha(water_edge.point(lambda value: int(value * 0.52)))
    ground.alpha_composite(edge_layer)

    water_detail_layer = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    water_detail_draw = ImageDraw.Draw(water_detail_layer, "RGBA")
    water_rng = random.Random(8221)

    def water_point_in_box(box: Box) -> tuple[int, int] | None:
        left, top, right, bottom = box
        for _ in range(80):
            x = water_rng.randint(left, right - 1)
            y = water_rng.randint(top, bottom - 1)
            if water_mask.getpixel((x, y)) > 0:
                return x, y
        return None

    for box in [rect_box(zone) for zone in WATER_ZONES]:
        left, top, right, bottom = box
        area = (right - left) * (bottom - top)
        for _ in range(max(2, area // 7_000)):
            point = water_point_in_box(box)
            if point is None:
                continue
            x, y = point
            if water_rng.random() < 0.62:
                length = water_rng.randint(9, 26)
                water_detail_draw.line((x, y, x + length, y + water_rng.randint(-1, 1)), fill=rgba("#d8f3f6", water_rng.randint(58, 108)), width=1)
            else:
                width = water_rng.randint(16, 34)
                height = water_rng.randint(5, 12)
                water_detail_draw.arc((x, y, x + width, y + height), 185, 350, fill=rgba("#d8f3f6", water_rng.randint(48, 92)), width=2)
        for _ in range(max(3, area // 5_500)):
            point = water_point_in_box(box)
            if point is None:
                continue
            x, y = point
            water_detail_draw.point((x, y), fill=rgba("#c7edf2", water_rng.randint(60, 120)))
            water_detail_draw.point((x + 2, y + water_rng.randint(-1, 1)), fill=rgba("#c7edf2", water_rng.randint(35, 75)))

    def draw_lily(cx: int, cy: int, width: int, height: int) -> None:
        if water_mask.getpixel((cx, cy)) == 0:
            return
        water_detail_draw.ellipse((cx - width // 2, cy - height // 2, cx + width // 2, cy + height // 2), fill=rgba("#78a63a", 210), outline=rgba("#c2dc62", 150), width=1)
        water_detail_draw.line((cx, cy, cx + width // 2 - 2, cy - height // 2 + 2), fill=rgba("#315c24", 165), width=1)
        water_detail_draw.arc((cx - width // 2 + 2, cy - height // 2 + 2, cx + width // 2 - 2, cy + height // 2 - 2), 210, 330, fill=rgba("#d8ef7a", 90), width=1)

    for lily in [(354, 742, 22, 14), (420, 880, 18, 12), (500, 920, 21, 14), (1188, 154, 23, 15), (1298, 280, 18, 12), (1230, 292, 17, 11)]:
        draw_lily(*lily)

    for box in [rect_box(zone) for zone in WATER_ZONES]:
        for _ in range(2):
            point = water_point_in_box(box)
            if point is None:
                continue
            x, y = point
            for blade in range(4):
                offset = blade * 3
                water_detail_draw.line((x + offset, y + 11, x + offset + water_rng.randint(-4, 4), y), fill=rgba("#4d8c39", 155), width=1)

    water_detail_alpha = ImageChops.multiply(water_detail_layer.getchannel("A"), water_mask)
    water_detail_layer.putalpha(water_detail_alpha)
    ground.alpha_composite(water_detail_layer)

    path_sets = [
        [(235, 145), (450, 190), (620, 320), (725, 520), (820, 820)],
        [(1375, 95), (1558, 245), (1645, 480), (1548, 730)],
        [(390, 690), (610, 700), (790, 760), (925, 900)],
        [(820, 330), (850, 355), (790, 390), (855, 425), (805, 450)],
        [(880, 500), (930, 505), (910, 545), (965, 568)],
    ]
    path_layer = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    path_draw = ImageDraw.Draw(path_layer, "RGBA")
    for points in path_sets:
        path_draw.line(points, fill=rgba("#eef1cf", 138), width=7, joint="curve")
        path_draw.line(points, fill=rgba("#5d7f4d", 60), width=2, joint="curve")
    ground.alpha_composite(path_layer)

    detail_layer = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    detail_draw = ImageDraw.Draw(detail_layer, "RGBA")
    for _ in range(180):
        x = rng.randint(20, 1900)
        y = rng.randint(20, 1060)
        if water_mask.getpixel((x, y)) > 0:
            continue
        if rng.random() < 0.2:
            detail_draw.ellipse((x, y, x + rng.randint(3, 8), y + rng.randint(2, 6)), fill=rgba("#f0d66e", rng.randint(90, 150)))
        else:
            detail_draw.line((x, y + rng.randint(4, 9), x + rng.randint(-2, 2), y), fill=rgba("#e7efc0", rng.randint(55, 100)), width=1)
    ground.alpha_composite(detail_layer)
    bake_structure_zones(ground, materials)

    save_rgb(ground, "maps/arena-ground.png")
    save_rgb(resize_cover(materials["storm"], (512, 512), Image.Resampling.NEAREST), "fx/storm-sea.png")
    return materials


def generate_tiles(materials: dict[str, Image.Image]) -> None:
    rng = random.Random(7100)

    save_rgba(tile_frames(materials["grass"], 24, rng), "tiles/grass-tiles.png")
    save_rgba(tile_frames(materials["water"], 8, rng), "tiles/water-tiles.png")
    save_rgba(tile_frames(materials["ruin"], 12, rng, True), "tiles/ruins-tiles.png")

    save_rgba(make_runtime_foliage_tiles(materials), "tiles/foliage-tiles.png")


def extract_character_poses() -> dict[str, dict[str, Image.Image]]:
    source = load_source("source-02-alpha.png", remove_green=True)
    roles = ["rogue", "samurai", "ninja", "cowboy", "mage"]
    poses = ["idle", "walk", "shoot", "hurt"]
    result: dict[str, dict[str, Image.Image]] = {}
    for row, role in enumerate(roles):
        result[role] = {}
        for col, pose in enumerate(poses):
            result[role][pose] = crop_grid(source, 4, 5, col, row, 8)
    return result


def generate_characters() -> None:
    poses = extract_character_poses()
    animation_specs = {
        "idle": (4, [0, -1, 0, 1], [0, 0, 0, 0], None),
        "walk": (6, [0, -2, 0, 1, 0, -1], [-2, 0, 2, 0, -1, 1], None),
        "shoot": (4, [0, -1, 0, 1], [2, -2, 0, 1], None),
        "hurt": (3, [0, 1, 0], [-2, 2, 0], rgba("#ff5a5a", 70)),
    }
    for role, role_poses in poses.items():
        for animation, (count, bobs, shifts, tint) in animation_specs.items():
            base = role_poses[animation]
            trim_padding = 10
            scale = 0.8
            if role == "cowboy" and animation == "shoot":
                base = remove_warm_muzzle_flash(base)
                trim_padding = 5
                scale = 0.86
            frames = [
                make_sprite_frame(base, (96, 96), scale=scale, anchor_y=0.78, dx=shifts[index], dy=bobs[index], tint=tint, min_margin=8, trim_padding=trim_padding)
                for index in range(count)
            ]
            if role == "cowboy" and animation == "shoot":
                frames = [add_cowboy_muzzle_flash(frame, index) for index, frame in enumerate(frames)]
            save_rgba(make_strip(frames), f"characters/{role}/{animation}.png")


def extract_enemy_poses() -> dict[str, list[Image.Image]]:
    source = load_source("source-03-alpha.png", remove_green=True)
    rows = ["bat", "slime", "wolf", "spitter", "golem"]
    result: dict[str, list[Image.Image]] = {}
    for row, enemy in enumerate(rows):
        result[enemy] = [crop_grid(source, 4, 5, col, row, 8) for col in range(4)]
    return result


def enemy_frame(subject: Image.Image, dx: int, dy: int, scale: float, tint: Color | None = None) -> Image.Image:
    return make_sprite_frame(subject, (96, 96), scale=scale, anchor_y=0.78, dx=dx, dy=dy, tint=tint, min_margin=8, trim_padding=10)


def generate_enemies() -> None:
    poses = extract_enemy_poses()
    primary_pose = {
        "bat": poses["bat"][0],
        "slime": poses["slime"][0],
        "wolf": poses["wolf"][0],
        "spitter": poses["spitter"][0],
        "golem": poses["golem"][0],
    }
    enemy_specs = {
        "bat": {
            "fly": (primary_pose["bat"], 6, [0, -4, -2, 2, 4, 1], [0, 0, 0, 0, 0, 0], 0.9, None),
            "dash": (primary_pose["bat"], 4, [0, -1, 1, 0], [0, 4, 8, 3], 0.9, None),
            "hurt": (primary_pose["bat"], 3, [0, 1, 0], [-3, 3, 0], 0.9, rgba("#ff5a5a", 65)),
        },
        "slime": {
            "idle": (primary_pose["slime"], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.72, None),
            "hop": (primary_pose["slime"], 6, [0, -4, -7, -4, 0, 1], [0, 0, 1, 0, 0, 0], 0.78, None),
            "squash": (primary_pose["slime"], 3, [2, 0, 1], [0, 0, 0], 0.78, rgba("#ff5a5a", 55)),
        },
        "wolf": {
            "dash": (primary_pose["wolf"], 4, [0, -1, 0, 1], [0, 5, 9, 2], 0.88, None),
            "hurt": (primary_pose["wolf"], 3, [0, 1, 0], [-3, 3, 0], 0.88, rgba("#ff5a5a", 65)),
        },
        "spitter": {
            "idle": (primary_pose["spitter"], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.8, None),
            "hop": (primary_pose["spitter"], 6, [0, -4, -7, -4, 0, 1], [0, 0, 1, 0, 0, 0], 0.82, None),
            "squash": (primary_pose["spitter"], 3, [2, 0, 1], [0, 0, 0], 0.82, rgba("#ff5a5a", 55)),
        },
        "golem": {
            "idle": (primary_pose["golem"], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.92, None),
            "hop": (primary_pose["golem"], 6, [0, -3, -5, -3, 0, 1], [0, 0, 1, 0, 0, 0], 0.94, None),
            "squash": (primary_pose["golem"], 3, [2, 0, 1], [0, 0, 0], 0.94, rgba("#ff5a5a", 55)),
        },
    }
    for enemy, animations in enemy_specs.items():
        for animation, (subject, count, bobs, shifts, scale, tint) in animations.items():
            frames = [enemy_frame(subject, shifts[index], bobs[index], scale, tint) for index in range(count)]
            save_rgba(make_strip(frames), f"enemies/{enemy}/{animation}.png")


SOURCE_04_BOXES: dict[str, NormBox] = {
    "ammo": (0.045, 0.045, 0.135, 0.155),
    "medkit": (0.17, 0.05, 0.267, 0.15),
    "shield": (0.3, 0.04, 0.38, 0.15),
    "pistol": (0.427, 0.045, 0.525, 0.155),
    "rifle": (0.543, 0.03, 0.685, 0.155),
    "shotgun": (0.699, 0.033, 0.817, 0.155),
    "coin": (0.842, 0.057, 0.953, 0.153),
    "crate": (0.064, 0.199, 0.194, 0.32),
    "chest": (0.256, 0.196, 0.397, 0.323),
    "barrel": (0.461, 0.2, 0.555, 0.323),
    "projectile": (0.604, 0.238, 0.749, 0.286),
}


def generate_pickups_props_fx() -> None:
    source = load_source("source-04-alpha.png", remove_green=True)
    pickup_types = ["ammo", "medkit", "shield", "pistol", "rifle", "shotgun", "coin"]
    pickup_subjects: dict[str, Image.Image] = {}
    for kind in pickup_types:
        subject = resize_contain(crop_norm_box(source, SOURCE_04_BOXES[kind], 10), (48, 48), scale=0.82, anchor_y=0.74)
        pickup_subjects[kind] = subject
        save_rgba(subject, f"pickups/{kind}.png")
        save_rgba(make_strip(make_pickup_glow_frame(subject, frame) for frame in range(4)), f"pickups/{kind}-glow.png")

    for kind in ["crate", "chest", "barrel"]:
        subject = resize_contain(crop_norm_box(source, SOURCE_04_BOXES[kind], 10), (64, 64), scale=0.9, anchor_y=0.82)
        save_rgba(subject, f"props/{kind}.png")

    projectile = resize_contain(crop_norm_box(source, SOURCE_04_BOXES["projectile"], 10), (32, 16), scale=1.0, anchor_y=0.76)
    save_rgba(projectile, "fx/projectile-bullet.png")

    muzzle_boxes: list[NormBox] = [
        (0.075, 0.355, 0.22, 0.455),
        (0.26, 0.355, 0.435, 0.455),
        (0.475, 0.34, 0.68, 0.465),
        (0.72, 0.34, 0.95, 0.465),
    ]
    hit_boxes: list[NormBox] = [
        (0.075, 0.48, 0.16, 0.57),
        (0.225, 0.48, 0.35, 0.58),
        (0.385, 0.47, 0.535, 0.59),
        (0.58, 0.465, 0.705, 0.58),
        (0.775, 0.465, 0.93, 0.59),
    ]
    ring_boxes: list[NormBox] = [
        (0.22, 0.625, 0.35, 0.695),
        (0.395, 0.625, 0.53, 0.695),
        (0.575, 0.61, 0.72, 0.695),
        (0.77, 0.605, 0.94, 0.7),
    ]
    arc_boxes: list[NormBox] = [
        (0.06, 0.728, 0.18, 0.81),
        (0.20, 0.725, 0.34, 0.815),
        (0.36, 0.735, 0.50, 0.815),
        (0.535, 0.72, 0.725, 0.815),
        (0.735, 0.715, 0.95, 0.825),
    ]
    edge_boxes: list[NormBox] = [
        (0.05, 0.84, 0.14, 0.95),
        (0.17, 0.84, 0.275, 0.95),
        (0.29, 0.84, 0.42, 0.95),
        (0.43, 0.84, 0.57, 0.95),
        (0.575, 0.84, 0.76, 0.95),
        (0.76, 0.84, 0.965, 0.955),
    ]

    save_rgba(make_strip(resize_contain(crop_norm_box(source, box, 8), (64, 64), scale=0.94, anchor_y=0.64) for box in muzzle_boxes), "fx/muzzle-flash.png")
    save_rgba(make_strip(resize_contain(crop_norm_box(source, box, 8), (64, 64), scale=0.94, anchor_y=0.64) for box in hit_boxes), "fx/hit-spark.png")

    ring_frames: list[Image.Image] = []
    for index in range(6):
        frame = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame, "RGBA")
        radius_x = 15 + index * 3
        radius_y = 6 + index
        alpha = max(55, 190 - index * 20)
        draw.ellipse((32 - radius_x, 33 - radius_y, 32 + radius_x, 33 + radius_y), outline=rgba("#ffe66d", alpha), width=3)
        draw.ellipse((32 - radius_x + 4, 33 - radius_y + 2, 32 + radius_x - 4, 33 + radius_y - 2), outline=rgba("#fff9c7", alpha // 2), width=1)
        glow = frame.filter(ImageFilter.GaussianBlur(2.2)).point(lambda value: min(255, int(value * 1.25)))
        ring_frames.append(Image.alpha_composite(glow, frame))
    save_rgba(make_strip(ring_frames), "fx/pickup-ring.png")

    arc_frames: list[Image.Image] = []
    for index in range(8):
        box = arc_boxes[index % len(arc_boxes)]
        frame = resize_contain(crop_norm_box(source, box, 8), (64, 64), scale=0.96, anchor_y=0.6)
        if index % 2:
            frame = ImageOps.mirror(frame)
        arc_frames.append(frame)
    save_rgba(make_strip(arc_frames), "fx/storm-arc.png")

    edge_frames: list[Image.Image] = []
    for index in range(8):
        box = edge_boxes[index % len(edge_boxes)]
        frame = resize_contain(crop_norm_box(source, box, 8), (128, 96), scale=1.0, anchor_y=0.72)
        edge_frames.append(add_soft_glow(frame, rgba("#9a5cff", 210), 4, 110))
    save_rgba(make_strip(edge_frames), "fx/storm-edge.png")


SOURCE_05_BOXES: dict[str, NormBox] = {
    "team_panel": (0.035, 0.028, 0.41, 0.51),
    "slot": (0.445, 0.055, 0.57, 0.18),
    "slot_active": (0.59, 0.055, 0.725, 0.185),
    "stat_pill": (0.75, 0.078, 0.957, 0.162),
    "action_button": (0.458, 0.258, 0.612, 0.408),
    "minimap_frame": (0.655, 0.185, 0.95, 0.485),
}


def generate_ui() -> None:
    source = load_source("source-05-alpha.png", remove_green=True)
    save_rgba(resize_cover(crop_norm_box(source, SOURCE_05_BOXES["team_panel"], 6), (310, 68), Image.Resampling.NEAREST), "ui/team-panel.png")
    save_rgba(resize_contain(crop_norm_box(source, SOURCE_05_BOXES["slot"], 8), (92, 92), scale=1.0, anchor_y=0.68), "ui/inventory-slot.png")
    save_rgba(resize_contain(crop_norm_box(source, SOURCE_05_BOXES["slot_active"], 8), (92, 92), scale=1.0, anchor_y=0.68), "ui/inventory-slot-active.png")
    save_rgba(resize_cover(crop_norm_box(source, SOURCE_05_BOXES["stat_pill"], 6), (126, 44), Image.Resampling.NEAREST), "ui/stat-pill.png")
    save_rgba(resize_contain(crop_norm_box(source, SOURCE_05_BOXES["action_button"], 6), (64, 64), scale=0.98, anchor_y=0.68), "ui/action-button.png")
    save_rgba(resize_contain(crop_norm_box(source, SOURCE_05_BOXES["minimap_frame"], 12), (260, 260), scale=0.98, anchor_y=0.5), "ui/minimap-frame.png")

    item_boxes: dict[str, NormBox] = {
        "pistol": (0.07, 0.522, 0.188, 0.642),
        "shotgun": (0.23, 0.518, 0.401, 0.644),
        "rifle": (0.43, 0.522, 0.593, 0.644),
        "shield": (0.639, 0.521, 0.746, 0.646),
        "medkit": (0.802, 0.525, 0.922, 0.642),
    }
    for kind, box in item_boxes.items():
        save_rgba(resize_contain(crop_norm_box(source, box, 6), (96, 96), scale=0.88, anchor_y=0.72), f"ui/items/{kind}.png")

    rank_boxes: list[NormBox] = [
        (0.04, 0.66, 0.205, 0.805),
        (0.235, 0.66, 0.392, 0.805),
        (0.43, 0.66, 0.58, 0.805),
        (0.625, 0.657, 0.78, 0.805),
        (0.805, 0.66, 0.96, 0.805),
    ]
    for index, box in enumerate(rank_boxes, start=1):
        save_rgba(resize_contain(crop_norm_box(source, box, 4), (34, 34), scale=0.95, anchor_y=0.6), f"ui/rank-{index}.png")

    portrait_boxes: dict[str, NormBox] = {
        "rogue": (0.225, 0.807, 0.4, 0.978),
        "samurai": (0.42, 0.807, 0.595, 0.978),
        "ninja": (0.03, 0.807, 0.205, 0.978),
        "cowboy": (0.612, 0.808, 0.788, 0.978),
        "mage": (0.802, 0.808, 0.98, 0.978),
    }
    for role, box in portrait_boxes.items():
        save_rgba(resize_contain(crop_norm_box(source, box, 6), (56, 56), scale=0.98, anchor_y=0.72), f"ui/portrait-{role}.png")


def expected_asset_specs() -> dict[str, tuple[tuple[int, int], str]]:
    specs: dict[str, tuple[tuple[int, int], str]] = {
        "maps/arena-ground.png": ((1920, 1080), "RGB"),
        "fx/storm-sea.png": ((512, 512), "RGB"),
        "fx/projectile-bullet.png": ((32, 16), "RGBA"),
        "tiles/grass-tiles.png": ((32 * 24, 32), "RGBA"),
        "tiles/water-tiles.png": ((32 * 8, 32), "RGBA"),
        "tiles/ruins-tiles.png": ((32 * 12, 32), "RGBA"),
        "tiles/foliage-tiles.png": ((32 * 8, 32), "RGBA"),
        "props/crate.png": ((64, 64), "RGBA"),
        "props/chest.png": ((64, 64), "RGBA"),
        "props/barrel.png": ((64, 64), "RGBA"),
        "fx/muzzle-flash.png": ((64 * 4, 64), "RGBA"),
        "fx/hit-spark.png": ((64 * 5, 64), "RGBA"),
        "fx/pickup-ring.png": ((64 * 6, 64), "RGBA"),
        "fx/storm-arc.png": ((64 * 8, 64), "RGBA"),
        "fx/storm-edge.png": ((128 * 8, 96), "RGBA"),
        "ui/team-panel.png": ((310, 68), "RGBA"),
        "ui/inventory-slot.png": ((92, 92), "RGBA"),
        "ui/inventory-slot-active.png": ((92, 92), "RGBA"),
        "ui/stat-pill.png": ((126, 44), "RGBA"),
        "ui/action-button.png": ((64, 64), "RGBA"),
        "ui/minimap-frame.png": ((260, 260), "RGBA"),
    }

    for kind in ["ammo", "medkit", "shield", "pistol", "rifle", "shotgun", "coin"]:
        specs[f"pickups/{kind}.png"] = ((48, 48), "RGBA")
        specs[f"pickups/{kind}-glow.png"] = ((48 * 4, 48), "RGBA")

    for role in ["rogue", "samurai", "ninja", "cowboy", "mage"]:
        specs[f"characters/{role}/idle.png"] = ((96 * 4, 96), "RGBA")
        specs[f"characters/{role}/walk.png"] = ((96 * 6, 96), "RGBA")
        specs[f"characters/{role}/shoot.png"] = ((96 * 4, 96), "RGBA")
        specs[f"characters/{role}/hurt.png"] = ((96 * 3, 96), "RGBA")

    enemy_frames = {
        "bat/fly": 6,
        "bat/dash": 4,
        "bat/hurt": 3,
        "slime/idle": 4,
        "slime/hop": 6,
        "slime/squash": 3,
        "wolf/dash": 4,
        "wolf/hurt": 3,
        "spitter/idle": 4,
        "spitter/hop": 6,
        "spitter/squash": 3,
        "golem/idle": 4,
        "golem/hop": 6,
        "golem/squash": 3,
    }
    for name, frames in enemy_frames.items():
        specs[f"enemies/{name}.png"] = ((96 * frames, 96), "RGBA")

    for kind in ["pistol", "shotgun", "rifle", "shield", "medkit"]:
        specs[f"ui/items/{kind}.png"] = ((96, 96), "RGBA")

    for index in range(1, 6):
        specs[f"ui/rank-{index}.png"] = ((34, 34), "RGBA")

    for role in ["rogue", "samurai", "ninja", "cowboy", "mage"]:
        specs[f"ui/portrait-{role}.png"] = ((56, 56), "RGBA")

    return specs


def validate_outputs() -> None:
    failures: list[str] = []
    for relative_path, (expected_size, expected_mode) in expected_asset_specs().items():
        path = ASSET_ROOT / relative_path
        if not path.exists():
            failures.append(f"{relative_path}: missing")
            continue
        with Image.open(path) as image:
            if image.size != expected_size:
                failures.append(f"{relative_path}: expected {expected_size}, got {image.size}")
            if image.mode != expected_mode:
                failures.append(f"{relative_path}: expected {expected_mode}, got {image.mode}")
    if failures:
        raise RuntimeError("Asset validation failed:\n" + "\n".join(failures))


def main() -> None:
    materials = generate_environment()
    generate_tiles(materials)
    generate_characters()
    generate_enemies()
    generate_pickups_props_fx()
    generate_ui()
    validate_outputs()


if __name__ == "__main__":
    main()
