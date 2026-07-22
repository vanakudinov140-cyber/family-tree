# Tree assets (heritage mode)

Place finished artwork here. Files must **not** contain people, names, dates, or UI chrome.

## Installed raster trees

| File | Measured size | Format | People |
|------|---------------|--------|--------|
| `tree-compact.png` | 1536×1024 | PNG (RGBA) | 1–10 |
| `tree-medium.png` | 1536×1024 | PNG (RGBA) | 11–25 |
| `tree-wide.png` | 1536×1024 | PNG (RGBA) | 26–50 |

All three assets currently share the same pixel dimensions and 3:2 aspect ratio.
The app uses each file's natural width/height from `tree-asset-config.ts` — no stretching to legacy placeholder sizes.

## Optional vector accents

| File | Purpose |
|------|---------|
| `branch-left.svg` | Extra left branch twig for overflow |
| `branch-right.svg` | Extra right branch twig for overflow |
| `union-medallion.svg` | Spouse union marker between paired anchors |

## Anchor tuning

Normalized anchor coordinates live in `src/lib/tree-anchor-presets.ts`.

Development debug overlay: open the app with `?treeDebug=1` and click the tree to log normalized coordinates in the console.

## Converting to WebP (optional)

If you prefer WebP for smaller file size, convert with your tool of choice and update paths in `src/lib/tree-asset-config.ts`.
