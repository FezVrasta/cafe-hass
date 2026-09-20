# Brand assets

Home Assistant serves these. Since **2026.3** a custom integration ships its own brand images in a `brand/` folder inside the integration, and HA exposes them at `/api/brands/integration/cafe/`, taking priority over the brands CDN. The central [home-assistant/brands](https://github.com/home-assistant/brands) repository no longer accepts custom integrations, so there is nothing to submit anywhere — the files here are the whole story. See the [Brands Proxy API announcement](https://developers.home-assistant.io/blog/2026/02/24/brands-proxy-api/).

On Home Assistant older than 2026.3 the integration shows the generic puzzle-piece icon. Nothing breaks.

| File | Size | Used for |
| --- | --- | --- |
| `icon.png` | 256×256 | The integration tile, the device page, the "add integration" list |
| `icon@2x.png` | 512×512 | The same, on a retina display |
| `logo.png` | ≤256 tall | The wordmark, shown in the config flow header |
| `logo@2x.png` | ≤512 tall | The same, on a retina display |
| `dark_logo.png` / `dark_logo@2x.png` | as above | The logo on a dark theme |

The icon's tile is self-contained — a roast-brown squircle with the bean on it — so it reads the same on light and dark themes and there is no `dark_icon.png` to keep in sync. The logo is a bare glyph and a wordmark with no background of their own, which is exactly why the dark variant exists.

The wordmark is drawn by the generator rather than set in a typeface, so there are no glyph outlines in here that someone else owns and no font to install before regenerating.

## Regenerating

Every SVG in here is generated, not hand-edited. Change `tools/make_icon.py` and re-run it; it writes all three, renders the PNGs beside them, and copies the icon to `packages/frontend/public/icon.svg`, which is the panel's favicon.

```sh
python3 tools/make_icon.py
```

Needs `rsvg-convert` (`brew install librsvg`). Use it rather than Chromium or Inkscape — librsvg is what Home Assistant's own tooling uses, and the three disagree about filters.
