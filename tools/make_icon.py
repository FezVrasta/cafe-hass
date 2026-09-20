#!/usr/bin/env python3
"""Generate the C.A.F.E. brand assets.

    python tools/make_icon.py

Writes `icon.svg`, `logo.svg` and `dark_logo.svg`, renders every PNG size from them,
and drops a copy of the icon into the frontend as its favicon. All of it is build
output — change this script and re-run it, never edit the SVG by hand, or the next run
silently reverts your edit.

The icon is a single coffee bean, cream on a roast-brown tile. The tile is
self-contained, so it reads the same on light and dark themes and there is no
`dark_icon.png` to keep in sync. The logo is the bare bean plus the wordmark, which
*does* need the dark variant: one colour cannot carry a bare glyph across both themes.

The wordmark is drawn here rather than set in a typeface. Four letters and a monoline
that matches the bean's crease is little enough work to be worth not shipping glyph
outlines someone else owns, and not depending on whichever font a machine happens to
have when it regenerates these.
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOMAIN = "cafe"

#: The artboard. Home Assistant only ever serves the 256 and 512 renders, but the source
#: is drawn at 1024 so the maths below is in round numbers.
SIZE = 1024

#: Apple's app-icon corner, as a fraction of the width, with Figma's equivalent
#: corner-smoothing value. These two numbers *are* the iOS icon shape; see squircle().
CORNER_RADIUS_RATIO = 0.2237
CORNER_SMOOTHING = 0.6

#: The bean. Radii of the ellipse, the angle it leans at, and how far the crease runs
#: past the tips — it overshoots, so the two lobes are cleanly separated.
BEAN_RX = 204
BEAN_RY = 266
BEAN_TILT = -30
CREASE_WIDTH = 44
CREASE_OVERSHOOT = 14
CREASE_BOW = 0.42

#: The perceived centre of a frame sits a little above the geometric one, so content
#: centred by measurement alone looks sunken. The bean is symmetric about its own
#: centre, so this lift is the whole of the optical correction it needs.
OPTICAL_LIFT = 16

#: The wordmark. Cap height and stroke are in the same units as the bean, so the two
#: can be laid out against each other without a scale factor in the way.
CAP_HEIGHT = 200
LETTER_STROKE = 34
LETTER_GAP = 36
PERIOD_GAP = 52

#: How tall the bean stands next to the wordmark, and how far it sits from it.
LOGO_BEAN_HEIGHT = 274
LOGO_LOCKUP_GAP = 54
LOGO_PADDING = 22

TILE_TOP = "#6A4026"
TILE_BOTTOM = "#2E1B12"
BEAN = "#F5E7D2"

#: The logo, on a light theme and on a dark one. A bare glyph has no background of its
#: own to hold a contrast against, which is the whole reason `dark_logo.png` exists.
INK = "#3A2218"
INK_DARK = "#F5E7D2"


def squircle(size: float) -> str:
    """Return the iOS app-icon shape as an SVG path, inscribed in a `size` square.

    Not a superellipse. The obvious implementation — `|x|^n + |y|^n = 1` with n
    around 5 — is the shape most people mean by "squircle", but it is not the one
    Apple uses, and the difference is visible: a superellipse curves continuously
    everywhere, so the edges that should be flat bow outward. Side by side against
    a real app icon it reads as pillowed.

    Apple's mask is a *rounded rectangle with continuous curvature*, as produced by
    `UIBezierPath(roundedRect:cornerRadius:)`: genuinely straight edges, with the
    corner easing curvature in over a longer run than a circular arc would. This is
    the construction Figma exposes as "corner smoothing", at the iOS values.
    """
    radius = size * CORNER_RADIUS_RATIO
    budget = size / 2

    # Keep the corner inside the space available to it; without the cap a large
    # radius yields a self-intersecting path rather than a clipped one.
    smoothing = min(CORNER_SMOOTHING, budget / radius - 1)
    p = min((1 + smoothing) * radius, budget)

    arc_measure = math.radians(90 * (1 - smoothing))
    arc = math.sin(arc_measure / 2) * radius * math.sqrt(2)

    angle_alpha = (math.pi / 2 - arc_measure) / 2
    angle_beta = math.radians(45 * smoothing)
    c = radius * math.tan(angle_alpha / 2) * math.cos(angle_beta)
    d = c * math.tan(angle_beta)

    # The straight run into each corner splits 2:1 between the two off-curve
    # control points. That ratio is what ramps curvature smoothly.
    b = (p - arc - c - d) / 3
    a = 2 * b

    def f(value: float) -> str:
        return f"{value:.4f}"

    return " ".join(
        [
            f"M {f(size - p)} 0",
            f"c {f(a)} 0 {f(a + b)} 0 {f(a + b + c)} {f(d)}",
            f"a {f(radius)} {f(radius)} 0 0 1 {f(arc)} {f(arc)}",
            f"c {f(d)} {f(c)} {f(d)} {f(b + c)} {f(d)} {f(a + b + c)}",
            f"L {f(size)} {f(size - p)}",
            f"c 0 {f(a)} 0 {f(a + b)} {f(-d)} {f(a + b + c)}",
            f"a {f(radius)} {f(radius)} 0 0 1 {f(-arc)} {f(arc)}",
            f"c {f(-c)} {f(d)} {f(-(b + c))} {f(d)} {f(-(a + b + c))} {f(d)}",
            f"L {f(p)} {f(size)}",
            f"c {f(-a)} 0 {f(-(a + b))} 0 {f(-(a + b + c))} {f(-d)}",
            f"a {f(radius)} {f(radius)} 0 0 1 {f(-arc)} {f(-arc)}",
            f"c {f(-d)} {f(-c)} {f(-d)} {f(-(b + c))} {f(-d)} {f(-(a + b + c))}",
            f"L 0 {f(p)}",
            f"c 0 {f(-a)} 0 {f(-(a + b))} {f(d)} {f(-(a + b + c))}",
            f"a {f(radius)} {f(radius)} 0 0 1 {f(arc)} {f(-arc)}",
            f"c {f(c)} {f(-d)} {f(b + c)} {f(-d)} {f(a + b + c)} {f(-d)}",
            "Z",
        ]
    )


def crease() -> str:
    """Return the bean's centre crease, an S running the length of the long axis.

    Drawn in the bean's own frame, origin at its centre. Two things make it read as a
    coffee bean rather than a lentil: the split is an S, not a straight line, and it
    leaves both tips along the long axis — the tangent at each end is vertical, so the
    crease slices the tip square instead of shearing a corner off it.
    """
    end = BEAN_RY + CREASE_OVERSHOOT
    bow = BEAN_RX * CREASE_BOW

    def f(value: float) -> str:
        return f"{value:.2f}"

    return " ".join(
        [
            f"M 0 {f(-end)}",
            f"C 0 {f(-end * 0.55)} {f(-bow)} {f(-end * 0.35)} 0 0",
            f"C {f(bow)} {f(end * 0.35)} 0 {f(end * 0.55)} 0 {f(end)}",
        ]
    )


def bean(*, x: float, y: float, scale: float, fill: str, mask_id: str) -> str:
    """Return the bean, centred on (x, y) and scaled about that point.

    The crease is knocked out with a mask rather than stroked on top, so whatever is
    behind the bean shows through it: the tile's gradient on the icon, the page on the
    logo. One shape, both uses.
    """
    return f'''\
  <g transform="translate({x} {y}) rotate({BEAN_TILT}) scale({scale:.4f})">
    <mask id="{mask_id}">
      <ellipse rx="{BEAN_RX}" ry="{BEAN_RY}" fill="#fff"/>
      <path d="{crease()}" fill="none" stroke="#000" \
stroke-width="{CREASE_WIDTH}" stroke-linecap="round"/>
    </mask>
    <ellipse rx="{BEAN_RX}" ry="{BEAN_RY}" fill="{fill}" mask="url(#{mask_id})"/>
  </g>'''


def letters() -> tuple[list[str], float]:
    """Return the wordmark's paths and its width, drawn from the origin rightwards.

    Monoline geometric capitals on a baseline at y=0, cap height upwards. Stroke
    centres are inset by half a stroke so that the round caps land on the intended
    bounds rather than half a stroke outside them — the letters have to measure the
    same as the bean beside them, and a stroke that overhangs its own box does not.
    """
    half = LETTER_STROKE / 2
    top = -CAP_HEIGHT + half
    base = -half
    span = base - top

    paths: list[str] = []
    x = 0.0

    def f(value: float) -> str:
        return f"{value:.2f}"

    def stem(at: float) -> str:
        return f"M {f(at)} {f(top)} V {f(base)}"

    def bar(at: float, y: float, width: float) -> str:
        return f"M {f(at)} {f(y)} H {f(at + width)}"

    # C — a circular arc left open on the right, the same monoline as the crease.
    radius = span / 2
    cut = math.radians(52)
    start = (x + radius * (1 + math.cos(cut)), top + radius * (1 + math.sin(cut)))
    end = (start[0], top + radius * (1 - math.sin(cut)))
    paths.append(
        f"M {f(start[0])} {f(start[1])} "
        f"A {f(radius)} {f(radius)} 0 1 1 {f(end[0])} {f(end[1])}"
    )
    x += 2 * radius + LETTER_GAP
    paths.append(f"M {f(x)} {f(base)} h 0")  # the period after C
    x += PERIOD_GAP

    # A — apex on the centre line, crossbar where the legs are two thirds down.
    width_a = span * 1.02
    apex = x + width_a / 2
    paths.append(f"M {f(x)} {f(base)} L {f(apex)} {f(top)} L {f(x + width_a)} {f(base)}")
    crossbar_y = base - span * 0.33
    inset = (width_a / 2) * ((crossbar_y - top) / span)
    paths.append(bar(x + inset, crossbar_y, width_a - 2 * inset))
    x += width_a + LETTER_GAP
    paths.append(f"M {f(x)} {f(base)} h 0")
    x += PERIOD_GAP

    # F and E — the same stem, differing by one bar.
    arm = span * 0.62
    waist = arm * 0.82
    waist_y = top + span * 0.46
    for letter in ("F", "E"):
        paths.append(stem(x))
        paths.append(bar(x, top, arm))
        paths.append(bar(x, waist_y, waist))
        if letter == "E":
            paths.append(bar(x, base, arm))
        x += arm + LETTER_GAP
        paths.append(f"M {f(x)} {f(base)} h 0")
        x += PERIOD_GAP

    return paths, x - PERIOD_GAP + half


def wordmark(*, x: float, baseline: float, fill: str) -> tuple[str, float]:
    """Return the wordmark placed with its baseline at `baseline`, and its width."""
    paths, width = letters()
    body = "\n".join(f'      <path d="{d}"/>' for d in paths)
    group = f'''\
  <g transform="translate({x} {baseline})">
    <g fill="none" stroke="{fill}" stroke-width="{LETTER_STROKE}" \
stroke-linecap="round" stroke-linejoin="round">
{body}
    </g>
  </g>'''
    return group, width


def build_icon() -> str:
    """Return the icon SVG: the bean on its tile."""
    cx = SIZE / 2
    cy = SIZE / 2 - OPTICAL_LIFT

    return f'''\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" \
width="{SIZE}" height="{SIZE}">
  <title>C.A.F.E.</title>

  <!-- Generated by tools/make_icon.py. Do not edit; re-run the script. -->

  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{TILE_TOP}"/>
      <stop offset="1" stop-color="{TILE_BOTTOM}"/>
    </linearGradient>
  </defs>

  <path d="{squircle(SIZE)}" fill="url(#tile)"/>

{bean(x=cx, y=cy, scale=1, fill=BEAN, mask_id="crease")}
</svg>
'''


def build_logo(fill: str) -> str:
    """Return the logo SVG: the bare bean, then the wordmark, on one baseline."""
    tilt = math.radians(BEAN_TILT)
    # The bean leans, so its extent is the rotated ellipse's, not its radii.
    half_w = math.hypot(BEAN_RX * math.cos(tilt), BEAN_RY * math.sin(tilt))
    half_h = math.hypot(BEAN_RX * math.sin(tilt), BEAN_RY * math.cos(tilt))
    scale = LOGO_BEAN_HEIGHT / (2 * half_h)

    height = LOGO_BEAN_HEIGHT + 2 * LOGO_PADDING
    bean_cx = LOGO_PADDING + half_w * scale
    text_x = bean_cx + half_w * scale + LOGO_LOCKUP_GAP
    text, text_width = wordmark(
        x=text_x, baseline=height / 2 + CAP_HEIGHT / 2, fill=fill
    )
    width = text_x + text_width + LOGO_PADDING

    return f'''\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" \
width="{width:.0f}" height="{height:.0f}">
  <title>C.A.F.E.</title>

  <!-- Generated by tools/make_icon.py. Do not edit; re-run the script. -->

{bean(x=bean_cx, y=height / 2, scale=scale, fill=fill, mask_id="crease")}

{text}
</svg>
'''


def main() -> None:
    """Write every SVG, render the PNGs beside it, and update the frontend favicon."""
    brand = ROOT / "custom_components" / DOMAIN / "brand"
    brand.mkdir(parents=True, exist_ok=True)

    sources = {
        brand / "icon.svg": build_icon(),
        brand / "logo.svg": build_logo(INK),
        brand / "dark_logo.svg": build_logo(INK_DARK),
    }
    for source, markup in sources.items():
        source.write_text(markup)
        print(f"{source}")

    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "render_brand.py"), *map(str, sources)],
        check=True,
    )

    # The panel runs in an iframe, so its favicon is the same artwork at a size nobody
    # looks at closely. Copied rather than imported: Vite serves `public/` verbatim.
    favicon = ROOT / "packages" / "frontend" / "public" / "icon.svg"
    favicon.parent.mkdir(parents=True, exist_ok=True)
    favicon.write_text(sources[brand / "icon.svg"])
    print(f"{favicon}")


if __name__ == "__main__":
    main()
