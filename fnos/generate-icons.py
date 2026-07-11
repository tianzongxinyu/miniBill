#!/usr/bin/env python3
"""Sync fnOS icons from web/public/icon.png (resize only, preserve source artwork)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def ensure_pillow() -> None:
    try:
        import PIL  # noqa: F401
    except ImportError:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "pillow", "-q"],
            check=True,
        )


def load_master(src_path: Path):
    from PIL import Image

    ensure_pillow()
    img = Image.open(src_path).convert("RGBA")
    width, height = img.size
    side = max(width, height)
    if width == height == side:
        return img

    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - width) // 2, (side - height) // 2), img)
    return canvas


def write_icon(src_path: Path, dst: Path, size: int) -> None:
    from PIL import Image

    ensure_pillow()
    dst.parent.mkdir(parents=True, exist_ok=True)
    master = load_master(src_path)
    if master.size != (size, size):
        master = master.resize((size, size), Image.Resampling.LANCZOS)
    master.save(dst, format="PNG")


def main() -> None:
    root = Path(__file__).resolve().parent
    src = root.parent / "web" / "public" / "icon.png"

    if not src.is_file():
        raise SystemExit(f"Missing icon source: {src}")

    master = load_master(src)
    print(f"Using {src} ({master.size[0]}x{master.size[1]}, RGBA)")

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
