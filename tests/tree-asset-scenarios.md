# Tree asset scenarios

Manual and automated checks for heritage mode with external tree artwork.

## Asset installation

1. Add `tree-compact.webp`, `tree-medium.webp`, `tree-wide.webp` to `public/tree-assets/`.
2. Open heritage mode — image appears once, no broken icon.
3. Dev console shows no warning after files are installed.
4. Before install: neutral fallback only, no broken image, dev warning once per variant.

## Must never appear

- Reference screenshot with foreign faces or UI chrome
- Duplicate tree images for one connected component
- Programmatic trunk/root SVG layers
- Relationship edges in heritage mode

## Layout

| Scenario | Expected |
|----------|----------|
| Solo person | compact asset, center anchor |
| Couple | adjacent center anchors, union marker |
| Parent + child | child higher on canvas than parent |
| 18+ visible | medium or wide asset |
| 30+ on compact anchors | overflow badge `+N` |
| Two disconnected components | one main tree + secondary neutral group |
| Re-open profile | zoom preserved, soft pan only |

## View modes

| Mode | Asset bias |
|------|------------|
| nearby | compact |
| generations | compact / medium |
| branch | medium |
| all | wide |

## Diagram mode

Unchanged: `PersonNode`, edges, unions, junctions — no tree assets.

## Anchor tuning

After artwork delivery, edit `src/lib/tree-anchor-presets.ts` normalized coordinates.
