#!/usr/bin/env python3
"""Generate fnOS fpk icons from web/public/icon.png (#f5f8fd fill, transparent rounded corners)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BG_RGB = (0xF5, 0xF8, 0xFD)


def ensure_pillow() -> None:
    try:
        import PIL  # noqa: F401
    except ImportError:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "pillow", "-q"],
            check=True,
        )


def flatten_opaque(src_path: Path):
    from PIL import Image

    img = Image.open(src_path).convert("RGBA")
    out = Image.new("RGB", img.size, BG_RGB)
    out.paste(img, mask=img.split()[3])
    return out


def with_rounded_corners(img):
    from PIL import Image, ImageDraw

    rgb = img.convert("RGB")
    w, h = rgb.size
    radius = max(1, int(min(w, h) * 0.223))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (w, h))
    out.paste(rgb, mask=mask)
    out.putalpha(mask)
    return out


def write_icon(src_path: Path, dst: Path, size: int) -> None:
    ensure_pillow()
    from PIL import Image

    dst.parent.mkdir(parents=True, exist_ok=True)
    img = with_rounded_corners(flatten_opaque(src_path))
    if img.size != (size, size):
        img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(dst, format="PNG")


def main() -> None:
    root = Path(__file__).resolve().parent
    repo = root.parent
    src = repo / "web" / "public" / "icon.png"

    if not src.is_file():
        raise SystemExit(f"Missing icon source: {src}")

    ensure_pillow()
    fixed = with_rounded_corners(flatten_opaque(src))
    fixed.save(src, format="PNG")
    print(f"Updated {src} (RGBA, rounded corners, transparent outside)")

    targets = [
        (root / "ICON.PNG", 256),
        (root / "ICON_256.PNG", 256),
        (root / "app" / "ui" / "images" / "icon_64.png", 64),
        (root / "app" / "ui" / "images" / "icon_256.png", 256),
    ]
    for dst, size in targets:
        write_icon(src, dst, size)
        print(f"Wrote {dst} ({size}x{size})")


if __name__ == "__main__":
    main()
