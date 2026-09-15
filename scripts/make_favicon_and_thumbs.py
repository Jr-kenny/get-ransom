#!/usr/bin/env python3
"""Generate JPEG favicon + branded thumbnails for Get Ransom."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
THUMBS = ROOT / "thumbnails"
PUBLIC.mkdir(exist_ok=True)
THUMBS.mkdir(exist_ok=True)

# Brand tokens from src/index.css
SKY0 = (5, 10, 20)
SKY1 = (11, 26, 48)
SKY2 = (18, 49, 74)
SEA0 = (10, 42, 58)
SEA1 = (4, 21, 33)
LAMP = (255, 217, 138)
LAMP2 = (255, 179, 71)
TEXT = (217, 228, 234)
MUTED = (111, 135, 148)
INK = (3, 7, 16)
FOAM = (223, 243, 247)

SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SERIF_IT = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
MONO = "/System/Library/Fonts/Courier.ttc"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size=size, index=index)
    except OSError:
        return ImageFont.load_default(size=size)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(c1, c2, t):
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def sky_gradient(w: int, h: int, horizon: float = 0.72) -> Image.Image:
    """Night sky → sea gradient matching .scene."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    hy = int(h * horizon)
    for y in range(h):
        if y < hy:
            t = y / max(hy - 1, 1)
            if t < 0.45:
                c = lerp_rgb(SKY0, SKY1, t / 0.45)
            else:
                c = lerp_rgb(SKY1, SKY2, (t - 0.45) / 0.55)
        else:
            t = (y - hy) / max(h - hy - 1, 1)
            c = lerp_rgb(SEA0, SEA1, t)
        for x in range(w):
            px[x, y] = c
    return img


def draw_lighthouse_mark(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int, glow: bool = True):
    """Draw the favicon lighthouse mark centered at (cx,cy), unit size s (=64 art)."""
    # scale helpers
    def X(v: float) -> float:
        return cx + (v - 32) * (s / 64)

    def Y(v: float) -> float:
        return cy + (v - 32) * (s / 64)

    def W(v: float) -> float:
        return v * (s / 64)

    # base hills / water line
    draw.arc(
        [X(12) - W(2), Y(48) - W(8), X(52) + W(2), Y(48) + W(10)],
        start=180,
        end=360,
        fill=SEA0,
        width=max(2, int(W(2.5))),
    )
    # tower body
    draw.rounded_rectangle(
        [X(26), Y(18), X(38), Y(40)],
        radius=max(2, int(W(2))),
        fill=SKY1,
        outline=LAMP,
        width=max(1, int(W(1.6))),
    )
    # gallery trapezoid (no outline — outline drew fake beams)
    draw.polygon(
        [(X(28), Y(40)), (X(36), Y(40)), (X(38), Y(48)), (X(26), Y(48))],
        fill=SKY2,
    )
    draw.line([(X(24), Y(48)), (X(40), Y(48))], fill=LAMP, width=max(2, int(W(2))))
    # lamp
    r = W(4.5)
    draw.ellipse(
        [X(32) - r, Y(29) - r, X(32) + r, Y(29) + r],
        fill=LAMP,
    )
    # stem
    draw.line([(X(32), Y(14)), (X(32), Y(18))], fill=LAMP, width=max(2, int(W(2.5))))
    # rays
    for x1, y1, x2, y2 in (
        (18, 29, 22, 29),
        (42, 29, 46, 29),
        (20.5, 20.5, 23.3, 23.3),
        (40.7, 23.3, 43.5, 20.5),
    ):
        draw.line([(X(x1), Y(y1)), (X(x2), Y(y2))], fill=LAMP2, width=max(1, int(W(1.8))))


def add_glow_layer(base: Image.Image, cx: int, cy: int, radius: int, color=LAMP, alpha=90):
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(12, 0, -1):
        rr = int(radius * i / 6)
        a = int(alpha * (1 - i / 12) ** 2)
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(*color, a))
    glow = glow.filter(ImageFilter.GaussianBlur(radius / 3))
    base = base.convert("RGBA")
    return Image.alpha_composite(base, glow).convert("RGB")


def stars(draw: ImageDraw.ImageDraw, w: int, h: int, n: int = 80, seed: int = 7):
    rng = seed
    for i in range(n):
        rng = (rng * 16807) % 2147483647
        x = rng % w
        rng = (rng * 16807) % 2147483647
        y = rng % max(int(h * 0.55), 1)
        rng = (rng * 16807) % 2147483647
        s = 1 + (rng % 3)
        draw.ellipse([x, y, x + s, y + s], fill=(180, 200, 220))


def moon(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(200, 215, 228))
    draw.ellipse([cx - r // 3, cy - r // 4, cx + r // 6, cy + r // 5], fill=(170, 190, 205))


def clouds(draw: ImageDraw.ImageDraw, w: int, h: int):
    for ox, oy, sc, col in (
        (int(w * 0.15), int(h * 0.28), 1.0, (20, 40, 60)),
        (int(w * 0.55), int(h * 0.22), 1.3, (16, 34, 52)),
        (int(w * 0.75), int(h * 0.35), 0.9, (22, 45, 65)),
    ):
        bw = int(w * 0.22 * sc)
        bh = int(h * 0.04 * sc)
        for i in range(4):
            x = ox + i * bw // 5
            y = oy + (i % 2) * bh // 2
            draw.ellipse([x, y, x + bw, y + bh * 2], fill=col)


def vignette(img: Image.Image, strength: int = 90) -> Image.Image:
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([-w * 0.15, -h * 0.15, w * 1.15, h * 1.15], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12))
    dark = Image.new("RGB", (w, h), INK)
    return Image.composite(img, dark, mask)


def wrap_text(draw, text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def brand_panel(draw: ImageDraw.ImageDraw, w: int, h: int, title: str, sub: str, tag: str):
    # bottom card
    pad = int(w * 0.04)
    card_h = int(h * 0.28)
    y0 = h - card_h - pad
    draw.rounded_rectangle(
        [pad, y0, w - pad, h - pad],
        radius=int(w * 0.02),
        fill=(5, 12, 24),
        outline=(255, 255, 255, 30),
        width=2,
    )
    # kicker
    fk = font(MONO, int(h * 0.028))
    draw.text((pad + 28, y0 + 22), tag, font=fk, fill=LAMP)
    # title
    ft = font(SERIF, int(h * 0.07))
    draw.text((pad + 28, y0 + 52), title, font=ft, fill=TEXT)
    # sub
    fs = font(SERIF_IT, int(h * 0.032))
    draw.text((pad + 28, y0 + 52 + int(h * 0.085)), sub, font=fs, fill=MUTED)


def make_favicon(size: int = 512) -> Image.Image:
    """JPEG favicon: opaque dark tile with lighthouse mark (JPEG has no alpha)."""
    img = Image.new("RGB", (size, size), SKY0)
    d = ImageDraw.Draw(img)
    # soft radial lamp glow behind mark
    img = add_glow_layer(img, size // 2, int(size * 0.46), int(size * 0.28), LAMP, alpha=70)
    d = ImageDraw.Draw(img)
    # subtle bottom sea band
    sea_y = int(size * 0.78)
    d.rectangle([0, sea_y, size, size], fill=SEA1)
    d.line([(0, sea_y), (size, sea_y)], fill=SEA0, width=max(2, size // 64))
    # mark
    mark_s = int(size * 0.72)
    draw_lighthouse_mark(d, size // 2, size // 2, mark_s, glow=True)
    # outer soft rounded feel via vignette edge
    img = vignette(img, 60)
    return img


def make_og_brand(w=1200, h=630) -> Image.Image:
    img = sky_gradient(w, h, horizon=0.74)
    d = ImageDraw.Draw(img)
    stars(d, w, h, 100, seed=11)
    moon(d, int(w * 0.82), int(h * 0.16), int(h * 0.055))
    clouds(d, w, h)
    # beam
    beam = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(beam)
    lx, ly = int(w * 0.22), int(h * 0.42)
    for ang in (-8, 8):
        pts = [(lx, ly)]
        rad = math.radians(ang)
        length = w * 1.2
        pts.append((lx + length * math.cos(rad - 0.12), ly + length * math.sin(rad - 0.12)))
        pts.append((lx + length * math.cos(rad + 0.12), ly + length * math.sin(rad + 0.12)))
        bd.polygon(pts, fill=(255, 217, 138, 28))
    beam = beam.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img.convert("RGBA"), beam).convert("RGB")
    d = ImageDraw.Draw(img)
    draw_lighthouse_mark(d, int(w * 0.22), int(h * 0.42), int(h * 0.42))
    # right copy
    tx = int(w * 0.42)
    fk = font(MONO, 18)
    d.text((tx, int(h * 0.28)), "NIMIQ PAY  ·  BOUNTY HUB", font=fk, fill=LAMP)
    ft = font(SERIF, 72)
    d.text((tx, int(h * 0.36)), "Keep the light on", font=ft, fill=TEXT)
    d.text((tx, int(h * 0.36) + 78), "for open work.", font=ft, fill=LAMP)
    fs = font(SERIF_IT, 24)
    d.text(
        (tx, int(h * 0.36) + 170),
        "GitHub issue  ·  NIM promise  ·  PR claim  ·  pay on merge",
        font=fs,
        fill=MUTED,
    )
    # bottom brand bar
    d.rectangle([0, h - 8, w, h], fill=LAMP)
    return vignette(img)


def make_og_bounty(w=1200, h=630) -> Image.Image:
    img = sky_gradient(w, h, horizon=0.70)
    d = ImageDraw.Draw(img)
    stars(d, w, h, 70, seed=23)
    # large centered mark + big number
    draw_lighthouse_mark(d, int(w * 0.18), int(h * 0.48), int(h * 0.55))
    tx = int(w * 0.34)
    fk = font(MONO, 18)
    d.text((tx, int(h * 0.28)), "VISIBLE POT", font=fk, fill=LAMP)
    fn = font(SERIF, 120)
    num = "125"
    d.text((tx, int(h * 0.34)), num, font=fn, fill=LAMP)
    num_w = d.textlength(num, font=fn)
    d.text((tx + num_w + 18, int(h * 0.52)), "NIM", font=font(SERIF, 42), fill=TEXT)
    fs = font(SERIF, 28)
    d.text((tx, int(h * 0.62)), "bounty on a hard GitHub issue", font=fs, fill=TEXT)
    fm = font(MONO, 16)
    d.text((tx, int(h * 0.72)), "Promise +N  ·  Claim with a PR  ·  Pay on merge", font=fm, fill=MUTED)
    d.rectangle([0, h - 6, w, h], fill=LAMP)
    return vignette(img)


def make_og_loop(w=1200, h=630) -> Image.Image:
    img = sky_gradient(w, h, horizon=0.78)
    d = ImageDraw.Draw(img)
    stars(d, w, h, 60, seed=31)
    # header
    fk = font(MONO, 16)
    d.text((int(w * 0.08), int(h * 0.12)), "THE LOOP", font=fk, fill=LAMP)
    ft = font(SERIF, 48)
    d.text((int(w * 0.08), int(h * 0.18)), "Issue  ·  Promise  ·  PR  ·  Pay", font=ft, fill=TEXT)

    steps = [
        ("01", "Import", "GitHub issue"),
        ("02", "Promise", "signed NIM"),
        ("03", "Claim", "open a PR"),
        ("04", "Pay", "on merge"),
    ]
    card_w = int(w * 0.19)
    gap = int(w * 0.025)
    x0 = int(w * 0.08)
    y0 = int(h * 0.42)
    for i, (num, title, sub) in enumerate(steps):
        x = x0 + i * (card_w + gap)
        d.rounded_rectangle([x, y0, x + card_w, y0 + int(h * 0.32)], radius=16, fill=(5, 12, 24), outline=(255, 255, 255, 40), width=1)
        d.text((x + 20, y0 + 18), num, font=font(MONO, 16), fill=LAMP)
        d.text((x + 20, y0 + 52), title, font=font(SERIF, 28), fill=TEXT)
        d.text((x + 20, y0 + 95), sub, font=font(SERIF_IT, 18), fill=MUTED)
        if i < len(steps) - 1:
            ax = x + card_w + gap // 2
            d.line([(ax - 8, y0 + int(h * 0.16)), (ax + 8, y0 + int(h * 0.16))], fill=LAMP, width=2)
            d.polygon(
                [(ax + 8, y0 + int(h * 0.16) - 5), (ax + 16, y0 + int(h * 0.16)), (ax + 8, y0 + int(h * 0.16) + 5)],
                fill=LAMP,
            )
    # mark corner
    draw_lighthouse_mark(d, int(w * 0.92), int(h * 0.16), int(h * 0.22))
    d.rectangle([0, h - 6, w, h], fill=LAMP)
    return vignette(img)


def make_video_thumb(w=1280, h=720) -> Image.Image:
    img = sky_gradient(w, h, horizon=0.72)
    d = ImageDraw.Draw(img)
    stars(d, w, h, 110, seed=47)
    moon(d, int(w * 0.86), int(h * 0.14), int(h * 0.06))
    clouds(d, w, h)
    # dramatic beam
    beam = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(beam)
    lx, ly = int(w * 0.18), int(h * 0.45)
    for ang in (-12, -4, 4, 12):
        rad = math.radians(ang)
        length = w * 1.3
        bd.polygon(
            [
                (lx, ly),
                (lx + length * math.cos(rad - 0.08), ly + length * math.sin(rad - 0.08)),
                (lx + length * math.cos(rad + 0.08), ly + length * math.sin(rad + 0.08)),
            ],
            fill=(255, 217, 138, 22),
        )
    beam = beam.filter(ImageFilter.GaussianBlur(22))
    img = Image.alpha_composite(img.convert("RGBA"), beam).convert("RGB")
    d = ImageDraw.Draw(img)
    draw_lighthouse_mark(d, lx, ly, int(h * 0.5))

    # big title stack (YouTube-style, left-heavy)
    fk = font(MONO, 22)
    d.text((int(w * 0.36), int(h * 0.30)), "GET RANSOM", font=fk, fill=LAMP)
    ft = font(SERIF, 64)
    d.text((int(w * 0.36), int(h * 0.38)), "Ship the PR.", font=ft, fill=TEXT)
    d.text((int(w * 0.36), int(h * 0.38) + 72), "Get the NIM.", font=ft, fill=LAMP)
    # accent chip — left-aligned under the title stack
    chip_x = int(w * 0.36)
    chip_y = int(h * 0.68)
    chip_text = "Nimiq Pay mini-app"
    fchip = font(MONO, 20)
    tw = d.textlength(chip_text, font=fchip)
    d.rounded_rectangle(
        [chip_x, chip_y, chip_x + tw + 36, chip_y + 48],
        radius=24,
        fill=LAMP,
    )
    d.text((chip_x + 18, chip_y + 12), chip_text, font=fchip, fill=(35, 22, 2))
    # play affordance (subtle)
    d.ellipse([w - 160, h - 160, w - 80, h - 80], outline=LAMP, width=3)
    d.polygon(
        [(w - 135, h - 145), (w - 135, h - 95), (w - 95, h - 120)],
        fill=LAMP,
    )
    return vignette(img)


def make_app_listing(size=1024) -> Image.Image:
    img = sky_gradient(size, size, horizon=0.82)
    d = ImageDraw.Draw(img)
    stars(d, size, size, 90, seed=59)
    img = add_glow_layer(img, size // 2, int(size * 0.42), int(size * 0.30), LAMP, alpha=85)
    d = ImageDraw.Draw(img)
    draw_lighthouse_mark(d, size // 2, int(size * 0.40), int(size * 0.55))

    # wordmark
    ft = font(SERIF, int(size * 0.095))
    title = "Get Ransom"
    tw = d.textlength(title, font=ft)
    d.text(((size - tw) / 2, int(size * 0.70)), title, font=ft, fill=TEXT)

    fk = font(MONO, int(size * 0.032))
    sub = "BOUNTY HUB · NIMIQ"
    sw = d.textlength(sub, font=fk)
    d.text(((size - sw) / 2, int(size * 0.82)), sub, font=fk, fill=LAMP)

    # ring for app-icon feel
    m = int(size * 0.04)
    d.rounded_rectangle([m, m, size - m, size - m], radius=int(size * 0.18), outline=(255, 255, 255, 40), width=3)
    return vignette(img)


def save_jpg(img: Image.Image, path: Path, quality: int = 92):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"wrote {path} ({path.stat().st_size // 1024} KB, {img.size[0]}x{img.size[1]})")


def main():
    # Favicon is rasterized from public/favicon.svg via Chrome headless
    # (see scripts/export_favicon_jpeg.sh). PIL fallback kept in make_favicon().
    # Five distinct submission thumbnails
    save_jpg(make_og_brand(), THUMBS / "01-og-brand.jpg", quality=92)
    save_jpg(make_og_bounty(), THUMBS / "02-og-bounty.jpg", quality=92)
    save_jpg(make_og_loop(), THUMBS / "03-og-loop.jpg", quality=92)
    save_jpg(make_video_thumb(), THUMBS / "04-video-1280x720.jpg", quality=92)
    save_jpg(make_app_listing(), THUMBS / "05-app-listing-1024.jpg", quality=92)

    # convenience copies into public/ for hosting
    save_jpg(make_og_brand(), PUBLIC / "og-default.jpg", quality=92)
    save_jpg(make_video_thumb(), PUBLIC / "twitter-card.jpg", quality=92)

    print("done — run scripts/export_favicon_jpeg.sh to refresh favicon JPEGs from SVG")


if __name__ == "__main__":
    main()
