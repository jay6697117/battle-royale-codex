from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


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
        "ui/items",
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
        rgba("#75a758"),
        rgba("#82b660"),
        rgba("#6d9a50"),
        rgba("#91bd69"),
        rgba("#668f4b"),
        rgba("#9ac66f"),
        rgba("#aec77d"),
        rgba("#5f8648"),
    ]

    def draw_frame(draw: ImageDraw.ImageDraw, index: int) -> None:
        rng = random.Random(4_100 + index)
        base = palette[index % len(palette)]
        draw.rectangle((0, 0, 31, 31), fill=base)
        for _ in range(9):
            x = rng.randint(-7, 27)
            y = rng.randint(-5, 28)
            w = rng.randint(7, 18)
            h = rng.randint(4, 13)
            tint = palette[rng.randrange(len(palette))]
            draw.rounded_rectangle((x, y, x + w, y + h), radius=2, fill=(tint[0], tint[1], tint[2], rng.randint(56, 120)))
        for _ in range(10):
            x = rng.randint(0, 31)
            y = rng.randint(0, 31)
            if rng.random() < 0.15:
                draw_pixel_plus(draw, x, y, rgba("#e6d675", rng.randint(115, 180)))
            else:
                blade = rgba("#477f38", rng.randint(95, 150)) if rng.random() < 0.6 else rgba("#c2ce88", rng.randint(70, 120))
                draw.line((x, y + rng.randint(2, 7), x + rng.randint(-1, 2), y), fill=blade, width=1)

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
    elif kind == "pistol":
        draw.rectangle((11, 23, 29, 30), fill=rgba("#3d342a"), outline=rgba("#171412"))
        draw.rectangle((24, 18, 39, 24), fill=rgba("#272727"), outline=rgba("#111111"))
        draw.rectangle((29, 16, 39, 19), fill=rgba("#8e9290"))
        draw.rectangle((13, 28, 21, 38), fill=rgba("#8b5631"), outline=rgba("#3b2415"))
        draw.rectangle((21, 26, 27, 31), fill=rgba("#171412"))
    elif kind == "shotgun":
        draw.rectangle((7, 24, 35, 29), fill=rgba("#7a4b28"), outline=rgba("#2b1b12"))
        draw.rectangle((27, 20, 43, 24), fill=rgba("#242424"), outline=rgba("#101010"))
        draw.rectangle((10, 30, 18, 37), fill=rgba("#9a6538"), outline=rgba("#3b2415"))
        draw.line((31, 29, 43, 35), fill=rgba("#1a1a1a"), width=2)
    elif kind == "rifle":
        draw.rectangle((8, 25, 33, 30), fill=rgba("#6d4124"), outline=rgba("#26160f"))
        draw.rectangle((28, 20, 44, 24), fill=rgba("#202020"), outline=rgba("#0d0d0d"))
        draw.rectangle((38, 19, 47, 22), fill=rgba("#2b2b2b"))
        draw.rectangle((11, 30, 19, 38), fill=rgba("#8b5631"), outline=rgba("#3b2415"))
        draw.line((28, 30, 38, 38), fill=rgba("#171717"), width=2)
    else:
        draw.rectangle((11, 23, 35, 29), fill=rgba("#2b241d"))
        draw.rectangle((23, 18, 40, 23), fill=rgba("#171717"))
        draw.rectangle((10, 27, 18, 35), fill=rgba("#8b5631"))
    return image


def make_hud_item_icon(kind: str) -> Image.Image:
    image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((15, 66, 82, 82), fill=rgba("#000000", 80))

    def line(points: Iterable[tuple[int, int]], fill: Color, width: int, outline: int = 0) -> None:
        points_list = list(points)
        if outline:
            draw.line(points_list, fill=rgba("#08090b"), width=width + outline * 2, joint="curve")
        draw.line(points_list, fill=fill, width=width, joint="curve")

    if kind == "pistol":
        draw.rectangle((21, 40, 63, 55), fill=rgba("#08090b"))
        draw.rectangle((25, 36, 68, 48), fill=rgba("#d1d5cf"), outline=rgba("#101216"), width=4)
        draw.rectangle((62, 39, 79, 45), fill=rgba("#8a918b"), outline=rgba("#101216"), width=3)
        draw.rectangle((27, 49, 52, 61), fill=rgba("#33281f"), outline=rgba("#101216"), width=3)
        draw.polygon([(29, 58), (47, 58), (42, 79), (25, 79)], fill=rgba("#9a5e32"), outline=rgba("#24150d"))
        draw.rectangle((32, 61, 43, 67), fill=rgba("#c68545"))
        draw.rectangle((51, 48, 58, 56), fill=rgba("#17181a"))
        draw.rectangle((35, 39, 54, 42), fill=rgba("#f2f3e9"))
    elif kind == "shotgun":
        line([(18, 52), (76, 40)], rgba("#101114"), 12, 3)
        line([(31, 47), (82, 36)], rgba("#c0c5bb"), 5, 3)
        line([(18, 56), (52, 48)], rgba("#8f542b"), 11, 3)
        draw.polygon([(14, 54), (31, 50), (28, 65), (12, 71)], fill=rgba("#a76937"), outline=rgba("#21130c"))
        draw.rectangle((38, 52, 56, 60), fill=rgba("#c27b3c"), outline=rgba("#21130c"), width=3)
        draw.rectangle((75, 34, 87, 40), fill=rgba("#e3e7dc"), outline=rgba("#101114"), width=2)
    elif kind == "rifle":
        line([(16, 58), (78, 35)], rgba("#101114"), 12, 3)
        line([(34, 47), (88, 28)], rgba("#bcc2bb"), 5, 3)
        line([(17, 62), (57, 47)], rgba("#8b542e"), 12, 3)
        draw.polygon([(14, 58), (31, 52), (29, 70), (12, 77)], fill=rgba("#a86a38"), outline=rgba("#21130c"))
        draw.polygon([(52, 52), (66, 48), (69, 66), (57, 70)], fill=rgba("#25272a"), outline=rgba("#0b0c0d"))
        draw.rectangle((43, 41, 61, 48), fill=rgba("#bf793c"), outline=rgba("#21130c"), width=3)
        draw.rectangle((79, 25, 93, 31), fill=rgba("#e3e7dc"), outline=rgba("#101114"), width=2)
    elif kind == "shield":
        draw.polygon(
            [(48, 10), (76, 22), (70, 62), (48, 82), (26, 62), (20, 22)],
            fill=rgba("#101216"),
        )
        draw.polygon(
            [(48, 14), (72, 24), (67, 59), (48, 77), (29, 59), (24, 24)],
            fill=rgba("#4aa8ff"),
            outline=rgba("#e9f7ff"),
        )
        draw.polygon([(48, 18), (66, 26), (62, 56), (48, 70)], fill=rgba("#2f89e6"))
        draw.line((48, 20, 48, 70), fill=rgba("#dff4ff"), width=4)
    elif kind == "medkit":
        draw.rounded_rectangle((21, 22, 76, 71), radius=7, fill=rgba("#111216"))
        draw.rounded_rectangle((25, 18, 72, 66), radius=7, fill=rgba("#f4f3ea"), outline=rgba("#15171c"), width=5)
        draw.rectangle((43, 25, 55, 60), fill=rgba("#d92d2d"))
        draw.rectangle((31, 37, 67, 49), fill=rgba("#d92d2d"))
        draw.rectangle((38, 13, 59, 21), fill=rgba("#f4f3ea"), outline=rgba("#15171c"), width=4)
    else:
        return make_icon(kind, size=96)

    return image


def generate_pickups_and_props() -> None:
    for kind in ["ammo", "medkit", "shield", "pistol", "rifle", "shotgun", "coin"]:
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
                rng = random.Random(6_200 + frame)
                points = [
                    (4, 31 + rng.randint(-4, 4)),
                    (16, 18 + rng.randint(-5, 5)),
                    (29, 36 + rng.randint(-4, 4)),
                    (42, 13 + rng.randint(-5, 5)),
                    (60, 32 + rng.randint(-4, 4)),
                ]
                draw.line([(x, y + 8) for x, y in points], fill=rgba("#7b38e8", 120), width=7)
                draw.line(points, fill=rgba("#b77dff", 210), width=5)
                draw.line(points, fill=color, width=2)
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

    edge = Image.new("RGBA", (128 * 8, 96), (0, 0, 0, 0))
    for frame in range(8):
        image = Image.new("RGBA", (128, 96), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        rng = random.Random(7_300 + frame)
        y = 48 + rng.randint(-8, 8)
        points = [(0, y)]
        for x in range(14, 129, 14):
            y += rng.randint(-18, 18)
            y = max(14, min(82, y))
            points.append((x, y))
        draw.line([(x, y + 8) for x, y in points], fill=rgba("#4c159d", 95), width=14)
        draw.line([(x, y + 4) for x, y in points], fill=rgba("#8d43ff", 170), width=9)
        draw.line(points, fill=rgba("#f8efff", 245), width=4)
        draw.line(points, fill=rgba("#ffffff", 255), width=2)
        for x, y in points[1:-1:2]:
            branch = [(x, y), (x + rng.randint(-8, 10), y + rng.choice([-1, 1]) * rng.randint(10, 25))]
            draw.line(branch, fill=rgba("#d9b9ff", 190), width=2)
        edge.alpha_composite(image, (128 * frame, 0))
    save(edge, "fx/storm-edge.png")

    sea = Image.new("RGBA", (512, 512), rgba("#3a2465"))
    draw = ImageDraw.Draw(sea)
    rng = random.Random(8_200)
    for _ in range(120):
        x = rng.randint(-80, 512)
        y = rng.randint(-40, 512)
        w = rng.randint(70, 220)
        h = rng.randint(14, 54)
        color = rng.choice([rgba("#4f2c84", 72), rgba("#2f1d55", 92), rgba("#5b3792", 56), rgba("#241943", 80)])
        draw.rounded_rectangle((x, y, x + w, y + h), radius=12, fill=color)
    for _ in range(34):
        x = rng.randint(0, 511)
        y = rng.randint(0, 511)
        length = rng.randint(30, 100)
        draw.arc((x - length, y - 8, x + length, y + 30), 200, 332, fill=rgba("#a77bdf", rng.randint(18, 42)), width=1)
    for _ in range(24):
        x = rng.randint(0, 511)
        y = rng.randint(0, 511)
        draw.line((x, y, x + rng.randint(-10, 14), y + rng.randint(18, 44)), fill=rgba("#8a65c8", rng.randint(18, 38)), width=1)
    save(sea.convert("RGB"), "fx/storm-sea.png")

    overlay = Image.new("RGBA", (64, 64), rgba("#5728a8", 44))
    draw = ImageDraw.Draw(overlay)
    for offset in range(-64, 96, 24):
        draw.arc((offset - 26, 6, offset + 42, 54), 190, 330, fill=rgba("#b57dff", 34), width=3)
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

    for kind in ["pistol", "shotgun", "rifle", "shield", "medkit"]:
        save(make_hud_item_icon(kind), f"ui/items/{kind}.png")

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
    rng = random.Random(9_100)
    ground = Image.new("RGBA", (width, height), rgba("#78a858"))

    patch_palette = [
        rgba("#6f9f52", 76),
        rgba("#89b962", 78),
        rgba("#5f8c4a", 68),
        rgba("#9fbd68", 56),
        rgba("#6b8f4f", 54),
        rgba("#b4c477", 48),
    ]
    patch_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    patch_draw = ImageDraw.Draw(patch_layer)
    for _ in range(130):
        x = rng.randint(-180, width - 40)
        y = rng.randint(-150, height - 30)
        w = rng.randint(120, 430)
        h = rng.randint(70, 250)
        color = rng.choice(patch_palette)
        patch_draw.ellipse((x, y, x + w, y + h), fill=color)
    ground.alpha_composite(patch_layer)

    draw = ImageDraw.Draw(ground)

    def draw_path(points: list[tuple[int, int]], width_px: int) -> None:
        draw.line(points, fill=rgba("#d6dfb6", 34), width=width_px)
        draw.line(points, fill=rgba("#8da65c", 36), width=max(2, width_px // 3))
        for start, end in zip(points, points[1:]):
            dx = end[0] - start[0]
            dy = end[1] - start[1]
            length = max(1.0, math.hypot(dx, dy))
            step = 42
            dash = 21
            progress = 0.0
            while progress < length:
                dash_end = min(length, progress + dash)
                x1 = start[0] + dx * progress / length
                y1 = start[1] + dy * progress / length
                x2 = start[0] + dx * dash_end / length
                y2 = start[1] + dy * dash_end / length
                draw.line((x1, y1, x2, y2), fill=rgba("#eef4dc", 135), width=3)
                progress += step

    draw_path([(235, 145), (450, 190), (620, 320), (725, 520), (820, 820)], 10)
    draw_path([(1375, 95), (1558, 245), (1645, 480), (1548, 730)], 9)
    draw_path([(390, 690), (610, 700), (790, 760), (925, 900)], 8)

    water_mask = Image.new("L", (width, height), 0)
    water_draw = ImageDraw.Draw(water_mask)
    water_draw.rounded_rectangle((275, 640, 585, 835), radius=34, fill=255)
    water_draw.rounded_rectangle((270, 775, 515, 965), radius=34, fill=255)
    water_draw.rounded_rectangle((438, 696, 610, 830), radius=26, fill=0)
    water_draw.rounded_rectangle((1105, 125, 1358, 320), radius=32, fill=255)
    water_draw.rounded_rectangle((1165, 92, 1255, 188), radius=28, fill=255)
    water_draw.rounded_rectangle((1280, 245, 1380, 326), radius=22, fill=0)

    def apply_mask_color(mask: Image.Image, color: Color) -> None:
        nonlocal ground
        fill = Image.new("RGBA", ground.size, color)
        ground = Image.composite(fill, ground, mask)

    shore_mask = water_mask.filter(ImageFilter.MaxFilter(19))
    apply_mask_color(shore_mask, rgba("#557044"))
    apply_mask_color(water_mask, rgba("#23678e"))
    draw = ImageDraw.Draw(ground)

    for _ in range(96):
        x = rng.randint(260, 1380)
        y = rng.randint(90, 965)
        if water_mask.getpixel((x, y)) == 0:
            continue
        length = rng.randint(18, 62)
        draw.arc((x - length, y - 7, x + length, y + 20), 200, 340, fill=rgba("#8bd7e8", rng.randint(70, 135)), width=2)
    for _ in range(14):
        x = rng.randint(300, 1320)
        y = rng.randint(145, 915)
        if water_mask.getpixel((x, y)) == 0:
            continue
        draw.ellipse((x - 8, y - 5, x + 9, y + 6), fill=rgba("#84c55e", 185))
        draw.line((x - 1, y - 4, x + 8, y), fill=rgba("#4d8c3e", 160), width=1)

    for _ in range(260):
        x = rng.randint(20, width - 30)
        y = rng.randint(20, height - 30)
        if water_mask.getpixel((x, y)) > 0:
            continue
        if rng.random() < 0.22:
            draw.ellipse((x, y, x + rng.randint(5, 12), y + rng.randint(3, 8)), fill=rgba("#c9c2a5", rng.randint(120, 175)))
        elif rng.random() < 0.15:
            draw_pixel_plus(draw, x, y, rng.choice([rgba("#efcf6c", 165), rgba("#e48977", 160), rgba("#f2e5d2", 150)]))
        else:
            blade_color = rng.choice([rgba("#457d38", 130), rgba("#5f963f", 120), rgba("#bdd084", 92)])
            draw.line((x, y + rng.randint(4, 10), x + rng.randint(-2, 3), y), fill=blade_color, width=2)

    for points in [
        [(820, 330), (850, 355), (790, 390), (855, 425), (805, 450)],
        [(880, 500), (930, 505), (910, 545), (965, 568)],
        [(1005, 210), (1050, 225), (1030, 260)],
    ]:
        draw.line(points, fill=rgba("#c9c2a5", 118), width=8)
        draw.line(points, fill=rgba("#6f8f57", 80), width=3)

    for _ in range(90):
        x = rng.randint(40, width - 40)
        y = rng.randint(40, height - 40)
        if water_mask.getpixel((x, y)) > 0:
            continue
        draw.rectangle((x, y, x + rng.randint(2, 5), y + rng.randint(1, 4)), fill=rgba("#2f6f35", rng.randint(60, 115)))

    save(ground.convert("RGB"), "maps/arena-ground.png")


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
