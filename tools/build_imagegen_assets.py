from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "output" / "imagegen-sources"
ASSET_ROOT = ROOT / "public" / "assets"

Color = tuple[int, int, int, int]
Box = tuple[int, int, int, int]


def rgba(hex_value: str, alpha: int = 255) -> Color:
    value = hex_value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def load_source(name: str) -> Image.Image:
    path = SOURCE_ROOT / name
    if not path.exists():
        raise FileNotFoundError(f"Missing imagegen source: {path}")
    return Image.open(path).convert("RGBA")


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
) -> Image.Image:
    subject = trim_alpha(image)
    max_w = max(1, int(size[0] * scale))
    max_h = max(1, int(size[1] * scale))
    ratio = min(max_w / max(1, subject.width), max_h / max(1, subject.height))
    resized = subject.resize(
        (max(1, round(subject.width * ratio)), max(1, round(subject.height * ratio))),
        resample,
    )
    frame = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = round(size[1] * anchor_y - resized.height)
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


def make_sprite_frame(
    subject: Image.Image,
    frame_size: tuple[int, int],
    *,
    scale: float,
    anchor_y: float,
    dx: int = 0,
    dy: int = 0,
    tint: Color | None = None,
) -> Image.Image:
    frame = resize_contain(subject, frame_size, scale=scale, anchor_y=anchor_y)
    if tint:
        overlay = Image.new("RGBA", frame.size, tint)
        alpha = frame.getchannel("A")
        overlay.putalpha(alpha.point(lambda value: int(value * (tint[3] / 255))))
        frame = Image.alpha_composite(frame, overlay)
    if dx or dy:
        shifted = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        shifted.alpha_composite(frame, (dx, dy))
        return shifted
    return frame


def make_strip(frames: Iterable[Image.Image]) -> Image.Image:
    items = list(frames)
    sheet = Image.new("RGBA", (sum(item.width for item in items), items[0].height), (0, 0, 0, 0))
    offset = 0
    for frame in items:
        sheet.alpha_composite(frame, (offset, 0))
        offset += frame.width
    return sheet


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

    def rounded_mask(boxes: list[tuple[int, int, int, int]], radius: int) -> Image.Image:
        mask = Image.new("L", ground.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        for box in boxes:
            mask_draw.rounded_rectangle(box, radius=radius, fill=255)
        return mask.filter(ImageFilter.GaussianBlur(1.1))

    water_mask = rounded_mask(
        [
            (275, 640, 585, 835),
            (270, 775, 515, 965),
            (1105, 125, 1358, 320),
            (1165, 92, 1255, 188),
        ],
        34,
    )
    shore_mask = water_mask.filter(ImageFilter.MaxFilter(23)).filter(ImageFilter.GaussianBlur(2))
    paste_material(ground, materials["dark_grass"], shore_mask, (0.78, 0.86, 0.72))
    paste_material(ground, materials["water"], water_mask)

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

    ruin_zones = [
        (265, 405, 435, 459),
        (298, 455, 352, 609),
        (680, 365, 860, 413),
        (555, 78, 605, 196),
        (1092, 58, 1262, 120),
        (1455, 135, 1591, 197),
        (1288, 408, 1336, 602),
        (1390, 420, 1462, 470),
        (1482, 688, 1637, 742),
        (1100, 835, 1250, 891),
        (1165, 900, 1219, 1010),
    ]
    for box in ruin_zones:
        mask = Image.new("L", ground.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle(box, radius=4, fill=255)
        paste_material(ground, materials["ruin"], mask)

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

    save_rgb(ground, "maps/arena-ground.png")
    save_rgb(resize_cover(materials["storm"], (512, 512), Image.Resampling.NEAREST), "fx/storm-sea.png")
    return materials


def generate_tiles(materials: dict[str, Image.Image]) -> None:
    rng = random.Random(7100)

    def tile_frames(material: Image.Image, count: int, transparent: bool = False) -> Image.Image:
        frames: list[Image.Image] = []
        source = resize_cover(material, (320, 320), Image.Resampling.NEAREST)
        for index in range(count):
            x = rng.randint(0, source.width - 64)
            y = rng.randint(0, source.height - 64)
            frame = source.crop((x, y, x + 64, y + 64)).resize((32, 32), Image.Resampling.NEAREST)
            if transparent:
                mask = Image.new("L", (32, 32), 0)
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

    save_rgba(tile_frames(materials["grass"], 24), "tiles/grass-tiles.png")
    save_rgba(tile_frames(materials["water"], 8), "tiles/water-tiles.png")
    save_rgba(tile_frames(materials["ruin"], 12, True), "tiles/ruins-tiles.png")

    foliage_frames: list[Image.Image] = []
    foliage_source = resize_cover(materials["foliage"], (256, 256), Image.Resampling.NEAREST)
    for index in range(8):
        crop = foliage_source.crop((index * 19 % 180, index * 31 % 180, index * 19 % 180 + 72, index * 31 % 180 + 72))
        frame = crop.resize((32, 32), Image.Resampling.NEAREST)
        mask = Image.new("L", (32, 32), 0)
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
    save_rgba(make_strip(foliage_frames), "tiles/foliage-tiles.png")


def extract_character_poses() -> dict[str, dict[str, Image.Image]]:
    source = load_source("source-02-alpha.png")
    roles = ["rogue", "samurai", "ninja", "cowboy", "mage"]
    poses = ["idle", "walk", "shoot", "hurt"]
    result: dict[str, dict[str, Image.Image]] = {}
    for row, role in enumerate(roles):
        result[role] = {}
        for col, pose in enumerate(poses):
            result[role][pose] = crop_grid(source, 4, 5, col, row, 18)
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
            frames = [
                make_sprite_frame(base, (96, 96), scale=0.86, anchor_y=0.82, dx=shifts[index], dy=bobs[index], tint=tint)
                for index in range(count)
            ]
            save_rgba(make_strip(frames), f"characters/{role}/{animation}.png")


def extract_enemy_poses() -> dict[str, list[Image.Image]]:
    source = load_source("source-03-alpha.png")
    rows = ["bat", "slime", "wolf", "spitter", "golem"]
    result: dict[str, list[Image.Image]] = {}
    for row, enemy in enumerate(rows):
        result[enemy] = [crop_grid(source, 4, 5, col, row, 18) for col in range(4)]
    return result


def enemy_frame(subject: Image.Image, dx: int, dy: int, scale: float, tint: Color | None = None) -> Image.Image:
    return make_sprite_frame(subject, (96, 96), scale=scale, anchor_y=0.82, dx=dx, dy=dy, tint=tint)


def generate_enemies() -> None:
    poses = extract_enemy_poses()
    enemy_specs = {
        "bat": {
            "fly": (poses["bat"][0], 6, [0, -4, -2, 2, 4, 1], [0, 0, 0, 0, 0, 0], 0.9, None),
            "dash": (poses["bat"][1], 4, [0, -1, 1, 0], [0, 4, 8, 3], 0.9, None),
            "hurt": (poses["bat"][2], 3, [0, 1, 0], [-3, 3, 0], 0.9, rgba("#ff5a5a", 65)),
        },
        "slime": {
            "idle": (poses["slime"][0], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.72, None),
            "hop": (poses["slime"][1], 6, [0, -4, -7, -4, 0, 1], [0, 0, 1, 0, 0, 0], 0.78, None),
            "squash": (poses["slime"][2], 3, [2, 0, 1], [0, 0, 0], 0.78, None),
        },
        "wolf": {
            "dash": (poses["wolf"][0], 4, [0, -1, 0, 1], [0, 5, 9, 2], 0.88, None),
            "hurt": (poses["wolf"][2], 3, [0, 1, 0], [-3, 3, 0], 0.88, rgba("#ff5a5a", 65)),
        },
        "spitter": {
            "idle": (poses["spitter"][0], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.8, None),
            "hop": (poses["spitter"][1], 6, [0, -4, -7, -4, 0, 1], [0, 0, 1, 0, 0, 0], 0.82, None),
            "squash": (poses["spitter"][2], 3, [2, 0, 1], [0, 0, 0], 0.82, None),
        },
        "golem": {
            "idle": (poses["golem"][0], 4, [0, 1, 0, -1], [0, 0, 0, 0], 0.92, None),
            "hop": (poses["golem"][1], 6, [0, -3, -5, -3, 0, 1], [0, 0, 1, 0, 0, 0], 0.94, None),
            "squash": (poses["golem"][2], 3, [2, 0, 1], [0, 0, 0], 0.94, None),
        },
    }
    for enemy, animations in enemy_specs.items():
        for animation, (subject, count, bobs, shifts, scale, tint) in animations.items():
            frames = [enemy_frame(subject, shifts[index], bobs[index], scale, tint) for index in range(count)]
            save_rgba(make_strip(frames), f"enemies/{enemy}/{animation}.png")


SOURCE_04_BOXES: dict[str, Box] = {
    "ammo": (56, 84, 168, 174),
    "medkit": (252, 78, 362, 180),
    "shield": (460, 78, 546, 182),
    "pistol": (624, 94, 714, 180),
    "rifle": (764, 76, 942, 180),
    "shotgun": (946, 86, 1092, 180),
    "coin": (1138, 100, 1202, 170),
    "crate": (120, 260, 264, 402),
    "chest": (368, 268, 524, 402),
    "barrel": (622, 260, 732, 402),
    "projectile": (854, 292, 1052, 382),
}


def generate_pickups_props_fx() -> None:
    source = load_source("source-04-alpha.png")
    pickup_types = ["ammo", "medkit", "shield", "pistol", "rifle", "shotgun", "coin"]
    pickup_subjects: dict[str, Image.Image] = {}
    for kind in pickup_types:
        subject = resize_contain(crop_box(source, SOURCE_04_BOXES[kind], 10), (48, 48), scale=0.82, anchor_y=0.74)
        pickup_subjects[kind] = subject
        save_rgba(subject, f"pickups/{kind}.png")
        save_rgba(make_strip(make_pickup_glow_frame(subject, frame) for frame in range(4)), f"pickups/{kind}-glow.png")

    for kind in ["crate", "chest", "barrel"]:
        subject = resize_contain(crop_box(source, SOURCE_04_BOXES[kind], 10), (64, 64), scale=0.9, anchor_y=0.82)
        save_rgba(subject, f"props/{kind}.png")

    projectile = resize_contain(crop_box(source, SOURCE_04_BOXES["projectile"], 10), (32, 16), scale=1.0, anchor_y=0.76)
    save_rgba(projectile, "fx/projectile-bullet.png")

    muzzle_boxes = [(88, 468, 234, 562), (288, 460, 454, 574), (496, 468, 666, 574), (704, 480, 808, 570)]
    hit_boxes = [(96, 616, 246, 728), (306, 612, 442, 726), (524, 624, 632, 720), (734, 628, 840, 714), (918, 482, 960, 558)]
    ring_boxes = [(88, 802, 242, 880), (300, 816, 464, 882), (514, 826, 664, 882), (722, 834, 864, 882)]
    arc_boxes = [(40, 1118, 134, 1206), (132, 1156, 456, 1204), (458, 1160, 610, 1210), (608, 1176, 766, 1206)]

    save_rgba(make_strip(resize_contain(crop_box(source, box, 8), (64, 64), scale=0.94, anchor_y=0.64) for box in muzzle_boxes), "fx/muzzle-flash.png")
    save_rgba(make_strip(resize_contain(crop_box(source, box, 8), (64, 64), scale=0.94, anchor_y=0.64) for box in hit_boxes), "fx/hit-spark.png")

    ring_frames: list[Image.Image] = []
    for index in range(6):
        box = ring_boxes[min(index, len(ring_boxes) - 1)]
        frame = resize_contain(crop_box(source, box, 8), (64, 64), scale=0.8 + index * 0.04, anchor_y=0.58)
        ring_frames.append(frame)
    save_rgba(make_strip(ring_frames), "fx/pickup-ring.png")

    arc_frames: list[Image.Image] = []
    for index in range(8):
        box = arc_boxes[index % len(arc_boxes)]
        frame = resize_contain(crop_box(source, box, 8), (64, 64), scale=0.96, anchor_y=0.6)
        if index % 2:
            frame = ImageOps.mirror(frame)
        arc_frames.append(frame)
    save_rgba(make_strip(arc_frames), "fx/storm-arc.png")

    edge_crop = source.crop((32, 1084, 1220, 1238))
    edge_frames: list[Image.Image] = []
    for index in range(8):
        segment_left = int(index * edge_crop.width / 8)
        segment_right = int((index + 1) * edge_crop.width / 8)
        segment = edge_crop.crop((segment_left, 0, segment_right, edge_crop.height))
        frame = resize_contain(segment, (128, 96), scale=1.0, anchor_y=0.72)
        edge_frames.append(add_soft_glow(frame, rgba("#9a5cff", 210), 4, 110))
    save_rgba(make_strip(edge_frames), "fx/storm-edge.png")


SOURCE_05_BOXES: dict[str, Box] = {
    "team_panel": (50, 94, 430, 184),
    "slot": (474, 100, 614, 240),
    "slot_active": (666, 100, 802, 236),
    "stat_pill": (470, 280, 622, 354),
    "action_button": (484, 474, 604, 596),
    "minimap_frame": (844, 72, 1212, 440),
}


def generate_ui() -> None:
    source = load_source("source-05-alpha.png")
    save_rgba(resize_cover(crop_box(source, SOURCE_05_BOXES["team_panel"], 6), (310, 68), Image.Resampling.NEAREST), "ui/team-panel.png")
    save_rgba(resize_contain(crop_box(source, SOURCE_05_BOXES["slot"], 8), (92, 92), scale=1.0, anchor_y=0.68), "ui/inventory-slot.png")
    save_rgba(resize_contain(crop_box(source, SOURCE_05_BOXES["slot_active"], 8), (92, 92), scale=1.0, anchor_y=0.68), "ui/inventory-slot-active.png")
    save_rgba(resize_cover(crop_box(source, SOURCE_05_BOXES["stat_pill"], 6), (126, 44), Image.Resampling.NEAREST), "ui/stat-pill.png")
    save_rgba(resize_contain(crop_box(source, SOURCE_05_BOXES["action_button"], 6), (64, 64), scale=0.98, anchor_y=0.68), "ui/action-button.png")
    save_rgba(resize_contain(crop_box(source, SOURCE_05_BOXES["minimap_frame"], 12), (260, 260), scale=0.98, anchor_y=0.5), "ui/minimap-frame.png")

    item_boxes = {
        "pistol": (56, 984, 254, 1178),
        "rifle": (292, 984, 490, 1178),
        "shotgun": (528, 984, 726, 1178),
        "shield": (764, 984, 962, 1178),
        "medkit": (1000, 984, 1196, 1178),
    }
    for kind, box in item_boxes.items():
        save_rgba(resize_contain(crop_box(source, box, 6), (96, 96), scale=0.88, anchor_y=0.72), f"ui/items/{kind}.png")

    rank_boxes = [
        (340, 652, 404, 722),
        (466, 652, 530, 722),
        (592, 652, 656, 722),
        (716, 652, 780, 722),
        (840, 652, 904, 722),
    ]
    for index, box in enumerate(rank_boxes, start=1):
        save_rgba(resize_contain(crop_box(source, box, 4), (34, 34), scale=0.95, anchor_y=0.6), f"ui/rank-{index}.png")

    portrait_boxes = {
        "rogue": (142, 768, 310, 932),
        "samurai": (342, 768, 510, 932),
        "ninja": (542, 768, 710, 932),
        "mage": (742, 768, 910, 932),
        "cowboy": (942, 768, 1110, 932),
    }
    for role, box in portrait_boxes.items():
        save_rgba(resize_contain(crop_box(source, box, 6), (56, 56), scale=0.98, anchor_y=0.72), f"ui/portrait-{role}.png")


def main() -> None:
    materials = generate_environment()
    generate_tiles(materials)
    generate_characters()
    generate_enemies()
    generate_pickups_props_fx()
    generate_ui()


if __name__ == "__main__":
    main()
