#!/usr/bin/env python3
"""Generate miniBill fpk icons (64x64 and 256x256 PNG, no dependencies)."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def _chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, size: int, bg: tuple[int, int, int], fg: tuple[int, int, int]) -> None:
    rows = []
    cx = cy = size // 2
    radius = int(size * 0.36)
    inner = int(size * 0.22)

    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                row.extend(fg)
            elif abs(dx) <= inner and abs(dy) <= inner // 3:
                row.extend((255, 255, 255))
            elif abs(dy - cy // 3) <= inner // 5 and abs(dx) <= inner:
                row.extend((255, 255, 255))
            else:
                row.extend(bg)
        rows.append(bytes(row))

    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr)
    png += _chunk(b"IDAT", compressed)
    png += _chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    root = Path(__file__).resolve().parent
    bg = (236, 253, 245)
    fg = (5, 150, 105)
    write_png(root / "ICON.PNG", 64, bg, fg)
    write_png(root / "ICON_256.PNG", 256, bg, fg)
    images = root / "app" / "ui" / "images"
    images.mkdir(parents=True, exist_ok=True)
    write_png(images / "icon_64.png", 64, bg, fg)
    write_png(images / "icon_256.png", 256, bg, fg)
    print(f"Wrote icons under {root}")


if __name__ == "__main__":
    main()
