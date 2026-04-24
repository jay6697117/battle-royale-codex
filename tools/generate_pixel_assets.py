from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "assets"


Color = tuple[int, int, int, int]


def rgba(hex_value: str, alpha: int = 255) -> Color:
    value = hex_value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def ensure_dirs() -> None:
    for path in [
        "maps",
        "tiles",
        "characters/rogue",
        "characters/samurai",
        "characters/ninja",
        "characters/cowboy",
        "characters/mage",
        "enemies/bat",
        "enemies/slime",
        "pickups",
        "props",
        "fx",
        "ui",
    ]:
        (ASSET_ROOT / path).mkdir(parents=True, exist_ok=True)


def save(image: Image.Image, relative_path: str) -> None:
    output = ASSET_ROOT / relative_path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)


def draw_pixel_plus(draw: ImageDraw.ImageDraw, x: int, y: int, color: Color) -> None:
    draw.rectangle((x + 3, y, x + 5, y + 8), fill=color)
    draw.rectangle((x, y + 3, x + 8, y + 5), fill=color)


def make_tilesheet(frame_count: int, draw_frame, frame_size: int = 32) -> Image.Image:
    sheet = Image.new("RGBA", (frame_size * frame_count, frame_size), (0, 0, 0, 0))
    for index in range(frame_count):
        frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        draw_frame(draw, index)
        sheet.alpha_composite(frame, (index * frame_size, 0))
    return sheet


def generate_grass_tiles() -> None:
    palette = [
        rgba("#78a858"),
        rgba("#84b660"),
        rgba("#6f9e51"),
        rgba("#8dbc68"),
        rgba("#739f56"),
        rgba("#98c270"),
    ]

    def draw_frame(draw: ImageDraw.ImageDraw, index: int) -> None:
        base = palette[index % len(palette)]
        draw.rectangle((0, 0, 31, 31), fill=base)
        for y in range(0, 32, 8):
            for x in range(0, 32, 8):
                tint = palette[(index + x // 8 + y // 8) % len(palette)]
                draw.rectangle((x, y, x + 7, y + 7), fill=(tint[0], tint[1], tint[2], 140))
        if index % 4 == 1:
            for point in [(6, 8), (22, 7), (15, 23)]:
                draw_pixel_plus(draw, point[0], point[1], rgba("#d8d97a", 185))
        if index % 4 == 2:
            draw.line((2, 20, 30, 10), fill=rgba("#b8ca86", 120), width=2)
            draw.line((0, 28, 25, 24), fill=rgba("#e4ead1", 110), width=1)
        if index % 4 == 3:
            draw.rectangle((3, 4, 29, 15), fill=rgba("#5e8d49", 120))
            draw.rectangle((9, 16, 24, 29), fill=rgba("#9abc68", 130))
        if index in {6, 7, 14, 15, 22, 23}:
            draw.rectangle((0, 0, 31, 31), outline=rgba("#668d4f", 120))

    save(make_tilesheet(24, draw_frame), "tiles/grass-tiles.png")


def generate_water_tiles() -> None:
    def draw_frame(draw: ImageDraw.ImageDraw, index: int) -> None:
        draw.rectangle((0, 0, 31, 31), fill=rgba("#20658e"))
        draw.rectangle((0, 0, 31, 5), fill=rgba("#5c8b4a"))
        draw.rectangle((0, 26, 31, 31), fill=rgba("#254e77"))
        phase = index % 4
        for y in [9, 17, 25]:
            draw.line((4, y + phase % 2, 26, y + ((phase + y) % 3) - 1), fill=rgba("#8bd4e6", 135), width=1)
        if index in {4, 5}:
            draw.ellipse((13, 10, 23, 18), fill=rgba("#86c85d"))
            draw.line((17, 11, 23, 13), fill=rgba("#4e983f"), width=1)
        if index in {6, 7}:
            draw.rectangle((0, 0, 7, 31), fill=rgba("#6b914d"))
            draw.rectangle((24, 0, 31, 31), fill=rgba("#6b914d"))

    save(make_tilesheet(8, draw_frame), "tiles/water-tiles.png")


def generate_ruin_tiles() -> None:
    colors = [rgba("#aab1a6"), rgba("#8b938b"), rgba("#c3c8bc"), rgba("#6c756f")]

    def draw_frame(draw: ImageDraw.ImageDraw, index: int) -> None:
        draw.rectangle((2, 3, 29, 29), fill=colors[index % 4])
        draw.rectangle((2, 24, 29, 29), fill=rgba("#4d554f", 150))
        draw.rectangle((2, 3, 29, 29), outline=rgba("#424a45"))
        if index % 3 == 0:
            draw.line((2, 15, 29, 15), fill=rgba("#5d665f"), width=2)
        if index % 3 == 1:
            draw.line((15, 3, 15, 29), fill=rgba("#5d665f"), width=2)
        if index % 3 == 2:
            draw.rectangle((19, 4, 28, 12), fill=rgba("#747d75"))
            draw.rectangle((3, 20, 12, 28), fill=rgba("#d3d5c9"))
        if index >= 8:
            draw.rectangle((20, 3, 29, 9), fill=(0, 0, 0, 0))
            draw.rectangle((2, 21, 9, 29), fill=(0, 0, 0, 0))

    save(make_tilesheet(12, draw_frame), "tiles/ruins-tiles.png")


def generate_foliage_tiles() -> None:
    def draw_frame(draw: ImageDraw.ImageDraw, index: int) -> None:
        if index < 4:
            for i in range(9):
                x = 6 + (i * 7 + index * 3) % 21
                y = 7 + (i * 5 + index * 2) % 19
                draw.ellipse((x - 7, y - 6, x + 8, y + 8), fill=rgba("#2f6d3d"))
                draw.ellipse((x - 4, y - 4, x + 5, y + 5), fill=rgba("#3f8b4e", 220))
        elif index < 6:
            for x in [6, 13, 20, 27]:
                draw.line((x, 28, x - 2, 13), fill=rgba("#396b34"), width=2)
                draw.line((x, 24, x + 5, 16), fill=rgba("#6fb45a"), width=2)
        else:
            draw.ellipse((8, 18, 15, 24), fill=rgba("#c7c0a6"))
            draw.ellipse((20, 9, 27, 15), fill=rgba("#d8d1b8"))
            draw_pixel_plus(draw, 12, 6, rgba("#f0cf6a"))
            draw_pixel_plus(draw, 22, 22, rgba("#e78c77"))

    save(make_tilesheet(8, draw_frame), "tiles/foliage-tiles.png")


def draw_character_frame(
    draw: ImageDraw.ImageDraw,
    role: str,
    body: Color,
    accent: Color,
    dark: Color,
    frame: int,
    animation: str,
) -> None:
    cx = 48
    bob = int(math.sin(frame * 1.4) * 2) if animation in {"idle", "walk"} else 0
    step = int(math.sin(frame * 2.0) * 4) if animation == "walk" else 0
    recoil = 5 if animation == "shoot" and frame in {1, 2} else 0
    hurt_shift = 3 if animation == "hurt" and frame % 2 else 0
    y = 50 + bob

    draw.ellipse((25, 70, 71, 82), fill=rgba("#0b0c0d", 90))
    draw.rectangle((35 + hurt_shift, y - 24, 61 + hurt_shift, y + 10), fill=dark)
    draw.rectangle((37 + hurt_shift, y - 27, 59 + hurt_shift, y + 6), fill=body)
    draw.rectangle((31 + hurt_shift, y + 1 + step, 43 + hurt_shift, y + 24 + step), fill=dark)
    draw.rectangle((53 + hurt_shift, y + 1 - step, 65 + hurt_shift, y + 24 - step), fill=dark)
    draw.rectangle((39 + hurt_shift, y - 20, 57 + hurt_shift, y - 7), fill=rgba("#e1b783"))
    draw.rectangle((41 + hurt_shift, y - 15, 45 + hurt_shift, y - 11), fill=rgba("#111111"))
    draw.rectangle((52 + hurt_shift, y - 15, 56 + hurt_shift, y - 11), fill=rgba("#111111"))
    draw.rectangle((34 + hurt_shift, y + 8, 45 + hurt_shift, y + 28), fill=body)
    draw.rectangle((51 + hurt_shift, y + 8, 62 + hurt_shift, y + 28), fill=body)

    if role in {"rogue", "ninja"}:
        draw.polygon([(31 + hurt_shift, y - 28), (48 + hurt_shift, y - 42), (66 + hurt_shift, y - 28)], fill=dark)
        draw.rectangle((35 + hurt_shift, y - 29, 61 + hurt_shift, y - 21), fill=dark)
        draw.rectangle((40 + hurt_shift, y - 21, 56 + hurt_shift, y - 17), fill=accent)
    elif role == "samurai":
        draw.rectangle((31 + hurt_shift, y - 35, 65 + hurt_shift, y - 24), fill=accent)
        draw.rectangle((36 + hurt_shift, y - 42, 60 + hurt_shift, y - 35), fill=rgba("#d8b75d"))
        draw.rectangle((28 + hurt_shift, y - 30, 34 + hurt_shift, y - 18), fill=rgba("#d8b75d"))
        draw.rectangle((62 + hurt_shift, y - 30, 68 + hurt_shift, y - 18), fill=rgba("#d8b75d"))
    elif role == "cowboy":
        draw.rectangle((25 + hurt_shift, y - 34, 71 + hurt_shift, y - 28), fill=accent)
        draw.rectangle((35 + hurt_shift, y - 44, 61 + hurt_shift, y - 32), fill=accent)
        draw.rectangle((32 + hurt_shift, y - 33, 64 + hurt_shift, y - 29), fill=rgba("#3a2314"))
    elif role == "mage":
        draw.polygon([(29 + hurt_shift, y - 27), (48 + hurt_shift, y - 52), (67 + hurt_shift, y - 27)], fill=accent)
        draw.rectangle((34 + hurt_shift, y - 30, 62 + hurt_shift, y - 23), fill=body)
        draw.rectangle((48 + hurt_shift, y - 49, 52 + hurt_shift, y - 43), fill=rgba("#f4e08a"))

    weapon_y = y - 2
    muzzle_x = 72 - recoil
    draw.rectangle((55 + hurt_shift - recoil, weapon_y, 76 + hurt_shift - recoil, weapon_y + 5), fill=rgba("#30231b"))
    draw.rectangle((65 + hurt_shift - recoil, weapon_y - 2, 82 + hurt_shift - recoil, weapon_y + 3), fill=rgba("#151515"))
    if animation == "shoot" and frame in {1, 2}:
        draw.polygon([(muzzle_x + 8, weapon_y - 5), (muzzle_x + 24, weapon_y + 1), (muzzle_x + 8, weapon_y + 9)], fill=rgba("#ffd35c"))
        draw.polygon([(muzzle_x + 12, weapon_y - 2), (muzzle_x + 29, weapon_y + 2), (muzzle_x + 12, weapon_y + 6)], fill=rgba("#ff7332"))

    if animation == "hurt":
        draw.line((29, 27, 70, 62), fill=rgba("#ff564a", 180), width=3)


def make_character_sheet(role: str, animation: str, frames: int, body: Color, accent: Color, dark: Color) -> Image.Image:
    sheet = Image.new("RGBA", (96 * frames, 96), (0, 0, 0, 0))
    for frame in range(frames):
        image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        draw_character_frame(ImageDraw.Draw(image), role, body, accent, dark, frame, animation)
        sheet.alpha_composite(image, (frame * 96, 0))
    return sheet


def generate_characters() -> None:
    specs = {
        "rogue": (rgba("#1c2522"), rgba("#6cc9ff"), rgba("#111817")),
        "samurai": (rgba("#b42b26"), rgba("#ffd35c"), rgba("#2f1715")),
        "ninja": (rgba("#202829"), rgba("#90d65f"), rgba("#0f1414")),
        "cowboy": (rgba("#6a3d21"), rgba("#c1843e"), rgba("#342012")),
        "mage": (rgba("#2468d5"), rgba("#7fb5ff"), rgba("#172a68")),
    }
    animations = {"idle": 4, "walk": 6, "shoot": 4, "hurt": 3}
    for role, colors in specs.items():
        for animation, frames in animations.items():
            save(make_character_sheet(role, animation, frames, *colors), f"characters/{role}/{animation}.png")


def generate_enemies() -> None:
    for animation, frames in {"fly": 6, "dash": 4, "hurt": 3}.items():
        sheet = Image.new("RGBA", (96 * frames, 96), (0, 0, 0, 0))
        for frame in range(frames):
            image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            wing = int(math.sin(frame * 1.6) * 8)
            draw.ellipse((27, 65, 69, 78), fill=rgba("#0b0c0d", 80))
            draw.polygon([(45, 45), (10, 26 + wing), (24, 60)], fill=rgba("#21173d"))
            draw.polygon([(51, 45), (86, 26 - wing), (72, 60)], fill=rgba("#21173d"))
            draw.polygon([(46, 48), (17, 34 + wing), (28, 55)], fill=rgba("#7f3fa4"))
            draw.polygon([(50, 48), (79, 34 - wing), (68, 55)], fill=rgba("#7f3fa4"))
            draw.ellipse((34, 32, 62, 60), fill=rgba("#3b265f"))
            draw.rectangle((39, 39, 44, 44), fill=rgba("#ff6ec7"))
            draw.rectangle((52, 39, 57, 44), fill=rgba("#ff6ec7"))
            if animation == "hurt":
                draw.line((27, 28, 66, 62), fill=rgba("#ff564a", 190), width=3)
            sheet.alpha_composite(image, (frame * 96, 0))
        save(sheet, f"enemies/bat/{animation}.png")

    for animation, frames in {"idle": 4, "hop": 6, "squash": 3}.items():
        sheet = Image.new("RGBA", (96 * frames, 96), (0, 0, 0, 0))
        for frame in range(frames):
            image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            hop = int(abs(math.sin(frame * 1.1)) * 8) if animation == "hop" else 0
            squash = 7 if animation == "squash" and frame == 1 else 0
            draw.ellipse((25, 70, 71, 81), fill=rgba("#0b0c0d", 80))
            draw.rounded_rectangle((23, 38 + hop + squash, 73, 72 + hop), radius=17, fill=rgba("#8239d5"))
            draw.rounded_rectangle((29, 31 + hop + squash, 67, 61 + hop), radius=18, fill=rgba("#9d57f0"))
            draw.rectangle((36, 45 + hop, 42, 51 + hop), fill=rgba("#160e25"))
            draw.rectangle((54, 45 + hop, 60, 51 + hop), fill=rgba("#160e25"))
            draw.rectangle((41, 60 + hop, 56, 64 + hop), fill=rgba("#512296"))
            sheet.alpha_composite(image, (frame * 96, 0))
        save(sheet, f"enemies/slime/{animation}.png")


def make_icon(kind: str, size: int = 48, glow: int = 0) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if glow:
        draw.ellipse((4 - glow, 4 - glow, size - 4 + glow, size - 4 + glow), fill=rgba("#ffe66d", 40))
    draw.ellipse((10, 34, 38, 42), fill=rgba("#0b0c0d", 80))
    if kind == "medkit":
        draw.rounded_rectangle((13, 10, 35, 35), radius=4, fill=rgba("#f3f3e9"), outline=rgba("#14151a"), width=3)
        draw.rectangle((21, 15, 27, 31), fill=rgba("#d83232"))
        draw.rectangle((16, 20, 32, 26), fill=rgba("#d83232"))
    elif kind == "shield":
        draw.polygon([(24, 7), (37, 13), (34, 34), (24, 41), (14, 34), (11, 13)], fill=rgba("#4ba8ff"), outline=rgba("#f0f8ff"))
        draw.line((24, 12, 24, 36), fill=rgba("#dff4ff"), width=2)
    elif kind == "coin":
        draw.ellipse((14, 12, 34, 34), fill=rgba("#ffd45a"), outline=rgba("#b86e1d"), width=3)
        draw.rectangle((22, 16, 26, 30), fill=rgba("#fff1a5"))
    elif kind == "ammo":
        for x in [14, 21, 28]:
            draw.rectangle((x, 13, x + 5, 34), fill=rgba("#d98b3a"), outline=rgba("#4a2c17"))
            draw.polygon([(x, 13), (x + 2, 8), (x + 5, 13)], fill=rgba("#f2d48a"))
    else:
        draw.rectangle((11, 23, 35, 29), fill=rgba("#2b241d"))
        draw.rectangle((23, 18, 40, 23), fill=rgba("#171717"))
        draw.rectangle((10, 27, 18, 35), fill=rgba("#8b5631"))
    return image


def generate_pickups_and_props() -> None:
    for kind in ["ammo", "medkit", "shield", "rifle", "shotgun", "coin"]:
        save(make_icon(kind), f"pickups/{kind}.png")
        sheet = Image.new("RGBA", (48 * 4, 48), (0, 0, 0, 0))
        for frame in range(4):
            sheet.alpha_composite(make_icon(kind, glow=frame + 1), (48 * frame, 0))
        save(sheet, f"pickups/{kind}-glow.png")

    for name in ["crate", "chest"]:
        image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse((12, 48, 54, 59), fill=rgba("#0b0c0d", 80))
        draw.rectangle((14, 14, 50, 50), fill=rgba("#8a5728"), outline=rgba("#2f1f14"), width=4)
        draw.line((18, 18, 46, 46), fill=rgba("#3e2918"), width=4)
        draw.line((46, 18, 18, 46), fill=rgba("#3e2918"), width=4)
        if name == "chest":
            draw.rectangle((14, 12, 50, 25), fill=rgba("#a66732"), outline=rgba("#2f1f14"), width=4)
            draw.rectangle((29, 25, 36, 34), fill=rgba("#f0c95a"))
        save(image, f"props/{name}.png")

    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((14, 46, 52, 56), fill=rgba("#0b0c0d", 90))
    draw.ellipse((18, 14, 48, 52), fill=rgba("#654021"), outline=rgba("#2c2119"), width=4)
    draw.line((20, 32, 46, 32), fill=rgba("#2c2119"), width=3)
    draw.rectangle((22, 16, 44, 21), fill=rgba("#8d673c"))
    save(image, "props/barrel.png")


def generate_fx() -> None:
    bullet = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bullet)
    draw.rectangle((4, 6, 25, 10), fill=rgba("#ffef8a"))
    draw.rectangle((0, 7, 10, 9), fill=rgba("#ff7d36"))
    draw.polygon([(25, 5), (31, 8), (25, 11)], fill=rgba("#fff7c7"))
    save(bullet, "fx/projectile-bullet.png")

    for name, frames, color in [
        ("muzzle-flash", 4, rgba("#ffd35c")),
        ("hit-spark", 5, rgba("#ff684d")),
        ("pickup-ring", 6, rgba("#9ef07d")),
        ("storm-arc", 8, rgba("#f4ecff")),
    ]:
        sheet = Image.new("RGBA", (64 * frames, 64), (0, 0, 0, 0))
        for frame in range(frames):
            image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            if name == "storm-arc":
                points = [(4, 30), (18, 18 + frame % 4), (31, 34), (44, 13), (60, 32)]
                draw.line(points, fill=color, width=4)
                draw.line([(x, y + 7) for x, y in points], fill=rgba("#9e5cff", 170), width=3)
            elif name == "pickup-ring":
                radius = 10 + frame * 4
                draw.ellipse((32 - radius, 32 - radius, 32 + radius, 32 + radius), outline=color, width=3)
            else:
                for i in range(8):
                    angle = i * math.pi / 4 + frame * 0.3
                    length = 12 + frame * 5
                    draw.line((32, 32, 32 + math.cos(angle) * length, 32 + math.sin(angle) * length), fill=color, width=3)
            sheet.alpha_composite(image, (64 * frame, 0))
        save(sheet, f"fx/{name}.png")

    overlay = Image.new("RGBA", (64, 64), rgba("#5728a8", 82))
    draw = ImageDraw.Draw(overlay)
    for offset in range(-64, 64, 16):
        draw.line((offset, 64, offset + 64, 0), fill=rgba("#b57dff", 45), width=5)
    save(overlay, "fx/storm-overlay.png")


def generate_ui() -> None:
    def panel(width: int, height: int, fill: Color, border: Color) -> Image.Image:
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=8, fill=fill, outline=border, width=3)
        draw.rounded_rectangle((5, 5, width - 6, height - 8), radius=5, outline=rgba("#ffffff", 42), width=2)
        draw.rectangle((3, height - 7, width - 4, height - 4), fill=rgba("#000000", 65))
        return image

    save(panel(310, 68, rgba("#1f1439", 190), rgba("#9387c7", 130)), "ui/team-panel.png")
    save(panel(92, 92, rgba("#191b22", 235), rgba("#343644", 255)), "ui/inventory-slot.png")
    save(panel(92, 92, rgba("#202026", 240), rgba("#ffd45a", 255)), "ui/inventory-slot-active.png")
    save(panel(126, 44, rgba("#120c1c", 210), rgba("#7b6aa4", 120)), "ui/stat-pill.png")
    save(panel(64, 64, rgba("#161822", 230), rgba("#3a3d4a", 255)), "ui/action-button.png")

    frame = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    draw.ellipse((6, 6, 254, 254), outline=rgba("#ffffff", 235), width=8)
    draw.ellipse((16, 16, 244, 244), outline=rgba("#ffffff", 60), width=2)
    save(frame, "ui/minimap-frame.png")

    for index, color in enumerate(["#3c94d8", "#e04438", "#83c84f", "#8b52df", "#eda33d"], start=1):
        badge = Image.new("RGBA", (34, 34), (0, 0, 0, 0))
        draw = ImageDraw.Draw(badge)
        draw.rounded_rectangle((2, 2, 31, 31), radius=6, fill=rgba(color), outline=rgba("#ffffff", 170), width=3)
        save(badge, f"ui/rank-{index}.png")

    for role, color in {
        "rogue": "#1c2522",
        "samurai": "#b42b26",
        "ninja": "#202829",
        "cowboy": "#6a3d21",
        "mage": "#2468d5",
    }.items():
        portrait = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
        draw = ImageDraw.Draw(portrait)
        draw.rounded_rectangle((2, 2, 53, 53), radius=8, fill=rgba("#11131a"), outline=rgba("#2d2f39"), width=3)
        draw.ellipse((12, 10, 44, 45), fill=rgba(color))
        draw.rectangle((18, 18, 38, 30), fill=rgba("#e1b783"))
        draw.rectangle((21, 22, 25, 26), fill=rgba("#111111"))
        draw.rectangle((32, 22, 36, 26), fill=rgba("#111111"))
        save(portrait, f"ui/portrait-{role}.png")


def generate_arena_ground() -> None:
    width = 1920
    height = 1080
    grass = Image.open(ASSET_ROOT / "tiles/grass-tiles.png").convert("RGBA")
    water = Image.open(ASSET_ROOT / "tiles/water-tiles.png").convert("RGBA")
    ground = Image.new("RGBA", (width, height), rgba("#78a858"))

    for y in range(0, height, 32):
      for x in range(0, width, 32):
        distance = int(math.hypot(x - width / 2, y - height / 2))
        path_bias = abs(x - y * 0.62 - 250) < 45 or abs(x + y * 0.35 - 1700) < 36
        frame = int(2 + ((x / 32 + y / 32) % 2)) if path_bias else abs((x // 32) * 17 + (y // 32) * 31 + distance) % 24
        tile = grass.crop((frame * 32, 0, frame * 32 + 32, 32))
        ground.alpha_composite(tile, (x, y))

    draw = ImageDraw.Draw(ground)
    for points in [
        [(250, 145), (500, 205), (670, 390), (800, 570), (840, 815)],
        [(1450, 110), (1610, 245), (1680, 500), (1560, 730)],
        [(430, 680), (650, 710), (820, 760), (910, 890)],
    ]:
        draw.line(points, fill=rgba("#e5edd3", 105), width=5)
        draw.line(points, fill=rgba("#7aa15c", 80), width=2)

    water_zones = [
        (295, 660, 260, 235),
        (1110, 145, 230, 165),
    ]
    for zone_x, zone_y, zone_w, zone_h in water_zones:
        start_x = (zone_x // 32) * 32
        start_y = (zone_y // 32) * 32
        end_x = math.ceil((zone_x + zone_w) / 32) * 32
        end_y = math.ceil((zone_y + zone_h) / 32) * 32
        for y in range(start_y, end_y, 32):
            for x in range(start_x, end_x, 32):
                edge = 6 if x <= start_x or y <= start_y or x >= end_x - 32 or y >= end_y - 32 else 4 if (x + y) % 7 == 0 else 0
                tile = water.crop((edge * 32, 0, edge * 32 + 32, 32))
                ground.alpha_composite(tile, (x, y))
        draw.rounded_rectangle((zone_x, zone_y, zone_x + zone_w, zone_y + zone_h), radius=16, outline=rgba("#2d6d94", 180), width=5)

    for i in range(160):
        x = (i * 149 + 37) % width
        y = (i * 83 + 91) % height
        if any(zone_x <= x <= zone_x + zone_w and zone_y <= y <= zone_y + zone_h for zone_x, zone_y, zone_w, zone_h in water_zones):
            continue
        if i % 5 == 0:
            draw.ellipse((x, y, x + 8, y + 5), fill=rgba("#c9c2a5", 150))
        elif i % 7 == 0:
            draw_pixel_plus(draw, x, y, rgba("#e78c77", 160))
        else:
            draw.line((x, y + 7, x + 2, y), fill=rgba("#4f8c3f", 135), width=2)

    opaque_ground = Image.new("RGBA", ground.size, rgba("#78a858"))
    opaque_ground.alpha_composite(ground)
    save(opaque_ground, "maps/arena-ground.png")


def main() -> None:
    ensure_dirs()
    generate_grass_tiles()
    generate_water_tiles()
    generate_ruin_tiles()
    generate_foliage_tiles()
    generate_characters()
    generate_enemies()
    generate_pickups_and_props()
    generate_fx()
    generate_ui()
    generate_arena_ground()


if __name__ == "__main__":
    main()
