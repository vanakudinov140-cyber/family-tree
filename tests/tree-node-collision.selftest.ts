/**
 * Run: npx tsx tests/tree-node-collision.selftest.ts
 */
import {
  DEFAULT_TREE_NODE_DIMENSIONS,
  DEFAULT_TREE_SAFE_BOUNDS,
  getLineageXRange,
  layoutGenerationLineageRow,
  nodeBoxForPlacement,
  resolveTreeNodeCollisions,
  validateNoTreeNodeCollisions,
  validatePlacementsInBounds,
  type TreeNodePlacement,
} from "../src/lib/tree-node-collision";
import type { TreeLineageKey } from "../src/lib/tree-lineage-composition";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function placement(
  personId: string,
  x: number,
  y: number,
  extra: Partial<TreeNodePlacement> = {},
): TreeNodePlacement {
  return {
    personId,
    x,
    y,
    generation: 0,
    lineageKey: "focus",
    ...extra,
  };
}

const RENDER_W = 1400;
const RENDER_H = 1800;

function testNeighborMedallionsDoNotOverlap(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("a", 0.4, 0.5, { lineageKey: "focus" }),
      placement("b", 0.41, 0.5, { lineageKey: "focus" }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(
    validateNoTreeNodeCollisions(
      result.placements,
      DEFAULT_TREE_NODE_DIMENSIONS,
      RENDER_W,
      RENDER_H,
    ),
    "neighbor medallions do not overlap after resolve",
  );
}

function testLabelInsideCollisionBox(): void {
  const p = placement("a", 0.5, 0.5, { labelPlacement: "bottom" });
  const box = nodeBoxForPlacement(
    p,
    DEFAULT_TREE_NODE_DIMENSIONS,
    RENDER_W,
    RENDER_H,
  );
  assert(box.h > 0.05, "collision box includes plaque height");
  assert(box.w > 0.08, "collision box includes plaque width");
}

function testFocusedUsesLargerBox(): void {
  const normal = nodeBoxForPlacement(
    placement("a", 0.5, 0.5),
    DEFAULT_TREE_NODE_DIMENSIONS,
    RENDER_W,
    RENDER_H,
  );
  const focused = nodeBoxForPlacement(
    placement("a", 0.5, 0.5, { isFocused: true }),
    DEFAULT_TREE_NODE_DIMENSIONS,
    RENDER_W,
    RENDER_H,
  );
  assert(focused.w > normal.w, "focused width larger");
  assert(focused.h > normal.h, "focused height larger");
}

function testLeftLineageStaysLeft(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("l1", 0.2, 0.4, {
        lineageKey: "parent-left-lineage",
        generation: -1,
      }),
      placement("l2", 0.22, 0.4, {
        lineageKey: "parent-left-lineage",
        generation: -1,
      }),
      placement("l3", 0.24, 0.4, {
        lineageKey: "parent-left-lineage",
        generation: -1,
      }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  const range = getLineageXRange("parent-left-lineage");
  assert(
    result.placements.every((item) => item.x <= range.max + 0.01),
    "left lineage stays left",
  );
}

function testRightLineageStaysRight(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("r1", 0.7, 0.4, {
        lineageKey: "parent-right-lineage",
        generation: -1,
      }),
      placement("r2", 0.72, 0.4, {
        lineageKey: "parent-right-lineage",
        generation: -1,
      }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  const range = getLineageXRange("parent-right-lineage");
  assert(
    result.placements.every((item) => item.x >= range.min - 0.01),
    "right lineage stays right",
  );
}

function testDescendantsStayUpper(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("d1", 0.4, 0.2, { lineageKey: "descendant", generation: 1 }),
      placement("d2", 0.5, 0.22, { lineageKey: "descendant", generation: 1 }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(
    result.placements.every((item) => item.y <= 0.45),
    "descendants stay in upper zone",
  );
}

function testTwelvePeopleCreateRows(): void {
  const members: TreeNodePlacement[] = Array.from({ length: 12 }, (_, i) =>
    placement(`p${i}`, 0.3 + i * 0.01, 0.5, {
      lineageKey: "descendant",
      generation: 1,
    }),
  );
  const laid = layoutGenerationLineageRow({
    members,
    lineageKey: "descendant",
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
    baseY: 0.28,
  });
  assert(laid.rows >= 2 || laid.overflow.length > 0, "12 people → second row or overflow");
  assert(
    validateNoTreeNodeCollisions(
      laid.kept,
      DEFAULT_TREE_NODE_DIMENSIONS,
      RENDER_W,
      RENDER_H,
    ),
    "row layout has no collisions",
  );
}

function testOverflowWhenCrowded(): void {
  const members: TreeNodePlacement[] = Array.from({ length: 24 }, (_, i) =>
    placement(`c${i}`, 0.3, 0.5, {
      lineageKey: "collateral",
      generation: 0,
      protected: i < 2,
    }),
  );
  const result = resolveTreeNodeCollisions({
    placements: members,
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(result.overflowPersonIds.length > 0, "overflow created when crowded");
  assert(
    !result.overflowPersonIds.includes("c0"),
    "protected person c0 not in overflow",
  );
  assert(
    !result.overflowPersonIds.includes("c1"),
    "protected person c1 not in overflow",
  );
}

function testProtectedNotInOverflow(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("focus", 0.5, 0.5, {
        lineageKey: "focus",
        protected: true,
        isFocused: true,
      }),
      ...Array.from({ length: 20 }, (_, i) =>
        placement(`x${i}`, 0.5, 0.5, { lineageKey: "collateral" }),
      ),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(
    result.placements.some((item) => item.personId === "focus"),
    "focus remains placed",
  );
  assert(
    !result.overflowPersonIds.includes("focus"),
    "focus not overflowed",
  );
}

function testSafeBounds(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("a", -0.2, 1.2, { lineageKey: "focus" }),
      placement("b", 1.4, -0.1, { lineageKey: "focus" }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(
    validatePlacementsInBounds(result.placements, DEFAULT_TREE_SAFE_BOUNDS),
    "placements stay in safe bounds",
  );
}

function testDeterministic(): void {
  const input = {
    placements: [
      placement("b", 0.45, 0.5, { lineageKey: "focus" }),
      placement("a", 0.46, 0.5, { lineageKey: "focus" }),
      placement("c", 0.47, 0.5, { lineageKey: "focus" }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all" as const,
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  };
  const first = resolveTreeNodeCollisions(input);
  const second = resolveTreeNodeCollisions(input);
  const key = (items: TreeNodePlacement[]) =>
    items
      .map((item) => `${item.personId}:${item.x.toFixed(4)}:${item.y.toFixed(4)}`)
      .sort()
      .join("|");
  assert(key(first.placements) === key(second.placements), "layout deterministic");
}

function testNoNaN(): void {
  const result = resolveTreeNodeCollisions({
    placements: [
      placement("a", Number.NaN, Number.POSITIVE_INFINITY, {
        lineageKey: "focus",
      }),
    ],
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  assert(
    result.placements.every(
      (item) => Number.isFinite(item.x) && Number.isFinite(item.y),
    ),
    "no NaN/Infinity in placements",
  );
}

function testLargeFamilyPerformance(): void {
  const lineages: TreeLineageKey[] = [
    "focus",
    "parent-left-lineage",
    "parent-right-lineage",
    "descendant",
    "collateral",
  ];
  const placements: TreeNodePlacement[] = Array.from({ length: 300 }, (_, i) =>
    placement(`p${i}`, 0.2 + (i % 20) * 0.03, 0.2 + Math.floor(i / 20) * 0.03, {
      lineageKey: lineages[i % lineages.length],
      generation: (i % 5) - 2,
      protected: i < 5,
    }),
  );
  const started = Date.now();
  const result = resolveTreeNodeCollisions({
    placements,
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode: "all",
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth: RENDER_W,
    renderedHeight: RENDER_H,
  });
  const elapsed = Date.now() - started;
  assert(elapsed < 3000, `300 people resolve under 3s (took ${elapsed}ms)`);
  assert(result.placements.length + result.overflowPersonIds.length === 300, "all accounted");
}

function main(): void {
  testNeighborMedallionsDoNotOverlap();
  testLabelInsideCollisionBox();
  testFocusedUsesLargerBox();
  testLeftLineageStaysLeft();
  testRightLineageStaysRight();
  testDescendantsStayUpper();
  testTwelvePeopleCreateRows();
  testOverflowWhenCrowded();
  testProtectedNotInOverflow();
  testSafeBounds();
  testDeterministic();
  testNoNaN();
  testLargeFamilyPerformance();

  // eslint-disable-next-line no-console
  console.log(`tree-node-collision.selftest: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
