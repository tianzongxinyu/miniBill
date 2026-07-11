#!/usr/bin/env python3
"""Render a flat fnOS-style MiniBill icon (gradient squircle + white glyph)."""

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


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _load_font(size: int):
    from PIL import ImageFont

    candidates = [
        "arial.ttf",
        "Arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_flat_icon(size: int = 1024):
    from PIL import Image, ImageDraw

    ensure_pillow()

    top = (58, 175, 162)
    bottom = (24, 88, 80)
    white = (255, 255, 255)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGB", (size, size))
    pixels = grad.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        row = (
            _lerp(top[0], bottom[0], t),
            _lerp(top[1], bottom[1], t),
            _lerp(top[2], bottom[2], t),
        )
        for x in range(size):
            pixels[x, y] = row
    img.paste(grad, (0, 0))

    gloss = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse(
        (-int(size * 0.2), -int(size * 0.38), int(size * 1.2), int(size * 0.52)),
        fill=(255, 255, 255, 36),
    )
    img = Image.alpha_composite(img, gloss)

    draw = ImageDraw.Draw(img)
    scale = size / 1024.0

    cx = size // 2
    doc_w = int(620 * scale)
    doc_h = int(800 * scale)
    left = cx - doc_w // 2
    top_y = (size - doc_h) // 2
    right = left + doc_w
    bottom_y = top_y + doc_h
    corner = int(62 * scale)
    stroke = max(2, int(44 * scale))
    inner_pad = int(56 * scale)

    draw.rounded_rectangle(
        (left, top_y, right, bottom_y),
        radius=corner,
        outline=white,
        width=stroke,
    )

    # folded receipt corner
    fold = int(86 * scale)
    fold_inset = stroke // 2 + int(4 * scale)
    draw.polygon(
        [
            (right - fold - fold_inset, top_y + fold_inset),
            (right - fold_inset, top_y + fold_inset),
            (right - fold_inset, top_y + fold + fold_inset),
        ],
        fill=white,
    )
    draw.line(
        [
            (right - fold - fold_inset, top_y + fold_inset),
            (right - fold_inset, top_y + fold + fold_inset),
        ],
        fill=bottom,
        width=max(2, int(8 * scale)),
    )

    ring_rx = int(26 * scale)
    ring_ry = int(14 * scale)
    ring_stroke = max(2, int(18 * scale))
    for frac in (0.12, 0.26, 0.40, 0.54, 0.68, 0.82):
        ry = top_y + int(doc_h * frac)
        rx = left + int(18 * scale)
        draw.ellipse(
            (rx - ring_rx, ry - ring_ry, rx + ring_rx, ry + ring_ry),
            outline=white,
            width=ring_stroke,
        )

    content_left = left + inner_pad
    content_right = right - inner_pad

    header_h = int(54 * scale)
    header_top = top_y + int(42 * scale)
    draw.rounded_rectangle(
        (content_left, header_top, content_right, header_top + header_h),
        radius=int(14 * scale),
        outline=white,
        width=max(2, int(12 * scale)),
    )
    title_dot_r = int(7 * scale)
    for i, frac in enumerate((0.28, 0.5, 0.72)):
        dot_x = content_left + int((content_right - content_left) * frac)
        dot_y = header_top + header_h // 2
        draw.ellipse(
            (
                dot_x - title_dot_r,
                dot_y - title_dot_r,
                dot_x + title_dot_r,
                dot_y + title_dot_r,
            ),
            fill=white,
        )

    font = _load_font(int(320 * scale))
    dollar = "$"
    bbox = draw.textbbox((0, 0), dollar, font=font)
    tx = cx - (bbox[2] - bbox[0]) // 2 - bbox[0]
    ty = header_top + header_h + int(18 * scale) - bbox[1]
    draw.text((tx, ty), dollar, fill=white, font=font)

    divider_y = ty + (bbox[3] - bbox[1]) + int(20 * scale)
    divider_h = max(2, int(8 * scale))
    draw.rounded_rectangle(
        (content_left, divider_y, content_right, divider_y + divider_h),
        radius=int(4 * scale),
        fill=white,
    )

    line_h = max(2, int(26 * scale))
    line_r = max(1, int(13 * scale))
    dot_r = int(8 * scale)
    entries = (
        (0.40, 0.78),
        (0.47, 0.62),
        (0.54, 0.86),
        (0.61, 0.55),
        (0.68, 0.72),
    )
    for frac_y, frac_w in entries:
        line_w = int((content_right - content_left) * frac_w)
        ly = top_y + int(doc_h * frac_y)
        lx = content_left + int(28 * scale)
        draw.ellipse(
            (lx - dot_r, ly + line_h // 2 - dot_r, lx + dot_r, ly + line_h // 2 + dot_r),
            fill=white,
        )
        draw.rounded_rectangle(
            (lx + int(22 * scale), ly, lx + line_w, ly + line_h),
            radius=line_r,
            fill=white,
        )

    chart_left = content_left + int(10 * scale)
    chart_bottom = top_y + int(doc_h * 0.84)
    chart_max_h = int(doc_h * 0.14)
    bar_w = int(24 * scale)
    bar_gap = int(16 * scale)
    for i, h_frac in enumerate((0.45, 0.82, 0.62)):
        bh = int(chart_max_h * h_frac)
        bx = chart_left + i * (bar_w + bar_gap)
        draw.rounded_rectangle(
            (bx, chart_bottom - bh, bx + bar_w, chart_bottom),
            radius=int(8 * scale),
            fill=white,
        )

    total_y = top_y + int(doc_h * 0.76)
    total_h = max(2, int(12 * scale))
    total_left = chart_left + 3 * (bar_w + bar_gap) + int(18 * scale)
    draw.rounded_rectangle(
        (total_left, total_y, content_right, total_y + total_h),
        radius=int(6 * scale),
        fill=white,
    )
    draw.rounded_rectangle(
        (
            total_left,
            total_y + total_h + int(8 * scale),
            content_right - int(40 * scale),
            total_y + total_h + int(8 * scale) + max(2, int(8 * scale)),
        ),
        radius=int(4 * scale),
        fill=white,
    )

    badge_r = int(68 * scale)
    bx = right - int(22 * scale)
    by = bottom_y - int(22 * scale)
    draw.ellipse(
        (bx - badge_r, by - badge_r, bx + badge_r, by + badge_r),
        fill=white,
    )
    plus_len = int(40 * scale)
    plus_w = max(2, int(14 * scale))
    plus_r = max(1, int(5 * scale))
    draw.rounded_rectangle(
        (bx - plus_len, by - plus_w, bx + plus_len, by + plus_w),
        radius=plus_r,
        fill=bottom,
    )
    draw.rounded_rectangle(
        (bx - plus_w, by - plus_len, bx + plus_w, by + plus_len),
        radius=plus_r,
        fill=bottom,
    )

    return img.convert("RGB")


def main() -> None:
    root = Path(__file__).resolve().parent
    out = root.parent / "web" / "public" / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    render_flat_icon(1024).save(out, format="PNG")
    print(f"Wrote flat master icon to {out}")


if __name__ == "__main__":
    main()
