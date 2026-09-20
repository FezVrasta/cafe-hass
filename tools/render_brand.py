#!/usr/bin/env python3
"""Render the integration's brand PNGs from its SVG source.

    python tools/render_brand.py custom_components/cafe/brand/icon.svg

Writes `icon.png` (256) and `icon@2x.png` (512). Needs `rsvg-convert` —
`brew install librsvg`, or `apt install librsvg2-bin`. Chromium and Inkscape render
some filters differently from librsvg, which is what Home Assistant's own tooling
uses, so stick to this one.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

#: Home Assistant asks for 256 and its retina double. Anything larger is wasted bytes
#: on every page load of the integrations list.
SIZES = {"": 256, "@2x": 512}


def render(source: Path) -> None:
    """Render one SVG to every PNG size Home Assistant recognises."""
    if not source.exists():
        raise SystemExit(f"no such file: {source}")

    stem = source.stem  # "icon" or "logo"
    for suffix, size in SIZES.items():
        target = source.with_name(f"{stem}{suffix}.png")
        subprocess.run(
            [
                "rsvg-convert",
                "--width",
                str(size),
                "--height",
                str(size),
                "--keep-aspect-ratio",
                "--background-color",
                "none",
                "--output",
                str(target),
                str(source),
            ],
            check=True,
        )
        print(f"{target}  {size}x{size}")


def main() -> None:
    """Render every SVG named on the command line."""
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    if not shutil.which("rsvg-convert"):
        raise SystemExit("rsvg-convert is not installed — brew install librsvg")
    for arg in sys.argv[1:]:
        render(Path(arg))


if __name__ == "__main__":
    main()
