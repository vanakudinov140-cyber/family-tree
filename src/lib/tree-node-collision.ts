import type { TreeLineageKey } from "./tree-lineage-composition";
import type { TreeViewMode } from "./tree-visibility";

export type LabelPlacement = "top" | "bottom";

export type TreeNodePlacement = {
  personId: string;
  /** Medallion center X in normalized tree space (0..1). */
  x: number;
  /** Medallion center Y in normalized tree space (0..1). */
  y: number;
  generation: number;
  lineageKey: TreeLineageKey;
  isFocused?: boolean;
  isSelected?: boolean;
  /** Protected people never move to overflow. */
  protected?: boolean;
  labelPlacement?: LabelPlacement;
};

export type TreeNodeDimensions = {
  width: number;
  height: number;
  focusedWidth: number;
  focusedHeight: number;
  gapX: number;
  gapY: number;
};

export type TreeBoundsNorm = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ResolveTreeNodeCollisionsInput = {
  placements: TreeNodePlacement[];
  treeBounds: TreeBoundsNorm;
  viewMode: TreeViewMode;
  nodeDimensions: TreeNodeDimensions;
  /** Image pixel size — converts pixel gaps/boxes into normalized units. */
  renderedWidth: number;
  renderedHeight: number;
  lineageByPersonId?: Map<string, TreeLineageKey>;
};

export type ResolveTreeNodeCollisionsResult = {
  placements: TreeNodePlacement[];
  overflowPersonIds: string[];
  rowCountByGroup: Map<string, number>;
};

export const DEFAULT_TREE_NODE_DIMENSIONS: TreeNodeDimensions = {
  width: 150,
  height: 138,
  focusedWidth: 165,
  focusedHeight: 152,
  gapX: 22,
  gapY: 26,
};

/** Safe interior of the rendered tree illustration (normalized). */
export const DEFAULT_TREE_SAFE_BOUNDS: TreeBoundsNorm = {
  minX: 0.06,
  maxX: 0.94,
  minY: 0.06,
  maxY: 0.88,
};

const LINEAGE_X_RANGE: Record<TreeLineageKey, { min: number; max: number }> = {
  focus: { min: 0.28, max: 0.72 },
  "focus-lineage": { min: 0.1, max: 0.45 },
  "parent-left-lineage": { min: 0.1, max: 0.45 },
  "spouse-lineage": { min: 0.55, max: 0.9 },
  "parent-right-lineage": { min: 0.55, max: 0.9 },
  descendant: { min: 0.24, max: 0.76 },
  collateral: { min: 0.08, max: 0.92 },
};

const LINEAGE_Y_RANGE: Record<TreeLineageKey, { min: number; max: number }> = {
  focus: { min: 0.28, max: 0.72 },
  "focus-lineage": { min: 0.18, max: 0.78 },
  "parent-left-lineage": { min: 0.18, max: 0.78 },
  "spouse-lineage": { min: 0.18, max: 0.78 },
  "parent-right-lineage": { min: 0.18, max: 0.78 },
  descendant: { min: 0.06, max: 0.42 },
  collateral: { min: 0.12, max: 0.82 },
};

/** Relative generation → vertical band (roots below / descendants above). */
export function getGenerationYRange(generation: number): {
  min: number;
  max: number;
} {
  if (generation <= -3) return { min: 0.78, max: 0.88 };
  if (generation === -2) return { min: 0.66, max: 0.78 };
  if (generation === -1) return { min: 0.5, max: 0.64 };
  if (generation === 0) return { min: 0.36, max: 0.48 };
  if (generation === 1) return { min: 0.2, max: 0.34 };
  if (generation === 2) return { min: 0.08, max: 0.18 };
  return { min: 0.04, max: 0.08 };
}

type NormBox = {
  personId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function getLineageXRange(lineageKey: TreeLineageKey): {
  min: number;
  max: number;
} {
  return LINEAGE_X_RANGE[lineageKey] ?? LINEAGE_X_RANGE.collateral;
}

export function getLineageYRange(lineageKey: TreeLineageKey): {
  min: number;
  max: number;
} {
  return LINEAGE_Y_RANGE[lineageKey] ?? LINEAGE_Y_RANGE.collateral;
}

export function resolveLabelPlacement(y: number): LabelPlacement {
  return y >= 0.72 ? "top" : "bottom";
}

export function nodeBoxForPlacement(
  placement: TreeNodePlacement,
  dims: TreeNodeDimensions,
  renderedWidth: number,
  renderedHeight: number,
): NormBox {
  const focused = Boolean(placement.isFocused || placement.isSelected);
  const pxW = focused ? dims.focusedWidth : dims.width;
  const pxH = focused ? dims.focusedHeight : dims.height;
  const w = pxW / Math.max(1, renderedWidth);
  const h = pxH / Math.max(1, renderedHeight);
  const labelTop = (placement.labelPlacement ?? resolveLabelPlacement(placement.y)) === "top";

  // Box is centered on medallion X; vertically biased so plaque is inside the box.
  const x = placement.x - w / 2;
  const y = labelTop ? placement.y - h * 0.62 : placement.y - h * 0.38;

  return {
    personId: placement.personId,
    x,
    y,
    w,
    h,
  };
}

export function boxesOverlap(
  a: NormBox,
  b: NormBox,
  gapX: number,
  gapY: number,
): boolean {
  if (a.personId === b.personId) return false;
  return !(
    a.x + a.w + gapX <= b.x ||
    b.x + b.w + gapX <= a.x ||
    a.y + a.h + gapY <= b.y ||
    b.y + b.h + gapY <= a.y
  );
}

function groupKey(generation: number, lineageKey: TreeLineageKey): string {
  return `${generation}:${lineageKey}`;
}

function overflowPriority(placement: TreeNodePlacement): number {
  if (placement.protected) return 1000;
  switch (placement.lineageKey) {
    case "collateral":
      return 0;
    case "spouse-lineage":
    case "parent-right-lineage":
      return 1;
    case "focus-lineage":
    case "parent-left-lineage":
      return 2;
    case "descendant":
      return 3;
    case "focus":
      return 4;
    default:
      return 2;
  }
}

function distributeOnRow(
  count: number,
  minX: number,
  maxX: number,
  minStep: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(minX + maxX) / 2];

  const span = maxX - minX;
  const needed = minStep * (count - 1);
  if (needed <= span) {
    const step = span / (count - 1);
    return Array.from({ length: count }, (_, index) => minX + step * index);
  }

  // Pack tightly from center when range is tight.
  const packSpan = minStep * (count - 1);
  const start = (minX + maxX) / 2 - packSpan / 2;
  return Array.from({ length: count }, (_, index) => start + minStep * index);
}

function clampPlacementToBounds(
  placement: TreeNodePlacement,
  bounds: TreeBoundsNorm,
  lineageKey: TreeLineageKey,
): TreeNodePlacement {
  const xRange = getLineageXRange(lineageKey);
  const lineageY = getLineageYRange(lineageKey);
  const generationY = getGenerationYRange(placement.generation);
  const minX = Math.max(bounds.minX, xRange.min);
  const maxX = Math.min(bounds.maxX, xRange.max);
  const minY = Math.max(bounds.minY, lineageY.min, generationY.min);
  const maxY = Math.min(bounds.maxY, lineageY.max, generationY.max);

  const x = clamp(placement.x, minX, maxX);
  const y = clamp(placement.y, minY, Math.max(minY, maxY));
  return {
    ...placement,
    x,
    y,
    labelPlacement: resolveLabelPlacement(y),
  };
}

function findCollidingPair(
  placements: TreeNodePlacement[],
  dims: TreeNodeDimensions,
  renderedWidth: number,
  renderedHeight: number,
): [number, number] | null {
  const gapX = dims.gapX / Math.max(1, renderedWidth);
  const gapY = dims.gapY / Math.max(1, renderedHeight);
  const boxes = placements.map((placement) =>
    nodeBoxForPlacement(placement, dims, renderedWidth, renderedHeight),
  );

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (boxesOverlap(boxes[i], boxes[j], gapX, gapY)) {
        return [i, j];
      }
    }
  }
  return null;
}

/**
 * Redistribute a generation+lineage group into one or two local rows.
 * Returns kept placements and person ids that must overflow.
 */
export function layoutGenerationLineageRow(input: {
  members: TreeNodePlacement[];
  lineageKey: TreeLineageKey;
  treeBounds: TreeBoundsNorm;
  nodeDimensions: TreeNodeDimensions;
  renderedWidth: number;
  renderedHeight: number;
  baseY: number;
}): { kept: TreeNodePlacement[]; overflow: string[]; rows: number } {
  const {
    members,
    lineageKey,
    treeBounds,
    nodeDimensions,
    renderedWidth,
    renderedHeight,
    baseY,
  } = input;

  if (members.length === 0) {
    return { kept: [], overflow: [], rows: 0 };
  }

  const sorted = [...members].sort((a, b) =>
    a.personId.localeCompare(b.personId),
  );
  const xRange = getLineageXRange(lineageKey);
  const minX = Math.max(treeBounds.minX, xRange.min);
  const maxX = Math.min(treeBounds.maxX, xRange.max);
  const avgW =
    nodeDimensions.width / Math.max(1, renderedWidth);
  const minStep =
    avgW + nodeDimensions.gapX / Math.max(1, renderedWidth);
  const capacity = Math.max(
    1,
    Math.floor((maxX - minX) / Math.max(minStep, 0.001)) + 1,
  );

  const protectedMembers = sorted.filter((item) => item.protected);
  const flexible = sorted.filter((item) => !item.protected);

  let active = [...sorted];
  const overflow: string[] = [];

  // Two rows if needed.
  let rows = 1;
  if (active.length > capacity) {
    rows = 2;
  }

  const maxSlots = capacity * rows;
  if (active.length > maxSlots) {
    const dropCount = active.length - maxSlots;
    const dropCandidates = [...flexible].sort(
      (a, b) => overflowPriority(a) - overflowPriority(b),
    );
    for (let i = 0; i < dropCount && i < dropCandidates.length; i += 1) {
      overflow.push(dropCandidates[i].personId);
    }
    const overflowSet = new Set(overflow);
    active = active.filter((item) => !overflowSet.has(item.personId));
    if (active.length > maxSlots) {
      active = [
        ...protectedMembers,
        ...active
          .filter((item) => !item.protected)
          .slice(0, Math.max(0, maxSlots - protectedMembers.length)),
      ];
    }
  }

  const rowYOffset =
    (nodeDimensions.height + nodeDimensions.gapY) /
    Math.max(1, renderedHeight);

  const generationY = getGenerationYRange(sorted[0]?.generation ?? 0);
  const clampedBaseY = clamp(
    baseY,
    Math.max(treeBounds.minY, generationY.min),
    Math.min(treeBounds.maxY, generationY.max),
  );

  const rowBuckets: TreeNodePlacement[][] =
    rows === 1
      ? [active]
      : [
          active.slice(0, Math.ceil(active.length / 2)),
          active.slice(Math.ceil(active.length / 2)),
        ];

  const kept: TreeNodePlacement[] = [];
  rowBuckets.forEach((bucket, rowIndex) => {
    const xs = distributeOnRow(bucket.length, minX, maxX, minStep);
    let y = clampedBaseY;
    if (rows === 2) {
      y =
        rowIndex === 0
          ? clampedBaseY - rowYOffset * 0.5
          : clampedBaseY + rowYOffset * 0.5;
    }
    bucket.forEach((member, index) => {
      // Keep protected people near their original generation anchor Y.
      const preferredY =
        member.protected && rows === 1 ? member.y : y;
      kept.push(
        clampPlacementToBounds(
          {
            ...member,
            x: xs[index] ?? member.x,
            y: preferredY,
            lineageKey,
          },
          treeBounds,
          lineageKey,
        ),
      );
    });
  });

  // Ensure intra-group collisions are cleared with X-only packing.
  const cleared = nudgeToResolve(
    kept,
    nodeDimensions,
    renderedWidth,
    renderedHeight,
    treeBounds,
    64,
    true,
  );

  return { kept: cleared, overflow, rows };
}

function nudgeToResolve(
  placements: TreeNodePlacement[],
  dims: TreeNodeDimensions,
  renderedWidth: number,
  renderedHeight: number,
  treeBounds: TreeBoundsNorm,
  maxPasses = 48,
  xOnly = false,
): TreeNodePlacement[] {
  const next = placements.map((placement) => ({ ...placement }));
  const gapX = dims.gapX / Math.max(1, renderedWidth);
  const gapY = dims.gapY / Math.max(1, renderedHeight);
  const stepX = Math.max(gapX * 0.85, 0.008);
  const stepY = Math.max(gapY * 0.55, 0.005);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pair = findCollidingPair(next, dims, renderedWidth, renderedHeight);
    if (!pair) break;

    const [i, j] = pair;
    const a = next[i];
    const b = next[j];

    const moveIndex =
      overflowPriority(a) <= overflowPriority(b) ? i : j;
    const otherIndex = moveIndex === i ? j : i;
    const moving = next[moveIndex];
    const other = next[otherIndex];

    const xRange = getLineageXRange(moving.lineageKey);
    const lineageY = getLineageYRange(moving.lineageKey);
    const generationY = getGenerationYRange(moving.generation);
    const minX = Math.max(treeBounds.minX, xRange.min);
    const maxX = Math.min(treeBounds.maxX, xRange.max);
    const minY = Math.max(treeBounds.minY, lineageY.min, generationY.min);
    const maxY = Math.min(treeBounds.maxY, lineageY.max, generationY.max);

    const direction = moving.x <= other.x ? -1 : 1;
    const alternate = pass % 2 === 0 ? direction : -direction;
    let candidateX = moving.x + alternate * stepX * (1 + (pass % 3));
    let candidateY = moving.y;

    if (!xOnly && pass > 16 && pass % 5 === 0) {
      // Tiny Y nudge only inside the same generation band.
      candidateY = moving.y + (moving.y <= other.y ? -stepY : stepY);
    }

    next[moveIndex] = clampPlacementToBounds(
      {
        ...moving,
        x: clamp(candidateX, minX, maxX),
        y: clamp(candidateY, minY, Math.max(minY, maxY)),
      },
      treeBounds,
      moving.lineageKey,
    );
  }

  return next;
}

/**
 * After initial anchor assignment: redistribute within lineage bands,
 * resolve remaining overlaps, and send excess people to overflow.
 */
export function resolveTreeNodeCollisions(
  input: ResolveTreeNodeCollisionsInput,
): ResolveTreeNodeCollisionsResult {
  const {
    placements,
    treeBounds,
    nodeDimensions,
    renderedWidth,
    renderedHeight,
    lineageByPersonId,
  } = input;

  void input.viewMode;

  if (placements.length === 0) {
    return {
      placements: [],
      overflowPersonIds: [],
      rowCountByGroup: new Map(),
    };
  }

  const normalized = placements.map((placement) => {
    const lineageKey =
      lineageByPersonId?.get(placement.personId) ?? placement.lineageKey;
    return clampPlacementToBounds(
      {
        ...placement,
        lineageKey,
        x: isFiniteNumber(placement.x) ? placement.x : 0.5,
        y: isFiniteNumber(placement.y) ? placement.y : 0.5,
      },
      treeBounds,
      lineageKey,
    );
  });

  const groups = new Map<string, TreeNodePlacement[]>();
  for (const placement of normalized) {
    const key = groupKey(placement.generation, placement.lineageKey);
    const list = groups.get(key) ?? [];
    list.push(placement);
    groups.set(key, list);
  }

  const kept: TreeNodePlacement[] = [];
  const overflowPersonIds: string[] = [];
  const rowCountByGroup = new Map<string, number>();

  for (const [key, members] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const lineageKey = members[0]?.lineageKey ?? "collateral";
    const baseY =
      members.reduce((sum, item) => sum + item.y, 0) / Math.max(1, members.length);

    const laidOut = layoutGenerationLineageRow({
      members,
      lineageKey,
      treeBounds,
      nodeDimensions,
      renderedWidth,
      renderedHeight,
      baseY,
    });

    rowCountByGroup.set(key, laidOut.rows);
    kept.push(...laidOut.kept);
    overflowPersonIds.push(...laidOut.overflow);
  }

  const nudged = nudgeToResolve(
    kept,
    nodeDimensions,
    renderedWidth,
    renderedHeight,
    treeBounds,
    64,
    true,
  );

  // Final overflow pass for any remaining hard collisions among non-protected.
  const stillColliding = findCollidingPair(
    nudged,
    nodeDimensions,
    renderedWidth,
    renderedHeight,
  );
  let finalPlacements = nudged;
  if (stillColliding) {
    const flexible = nudged
      .filter((placement) => !placement.protected)
      .sort((a, b) => overflowPriority(a) - overflowPriority(b));

    const removeIds = new Set<string>();
    let working = [...nudged];
    for (const candidate of flexible) {
      if (!findCollidingPair(working, nodeDimensions, renderedWidth, renderedHeight)) {
        break;
      }
      removeIds.add(candidate.personId);
      working = working.filter((item) => item.personId !== candidate.personId);
    }
    overflowPersonIds.push(...removeIds);
    finalPlacements = working;
  }

  finalPlacements = finalPlacements.map((placement) => ({
    ...placement,
    labelPlacement: resolveLabelPlacement(placement.y),
    x: isFiniteNumber(placement.x) ? placement.x : 0.5,
    y: isFiniteNumber(placement.y) ? placement.y : 0.5,
  }));

  return {
    placements: finalPlacements,
    overflowPersonIds: [...new Set(overflowPersonIds)],
    rowCountByGroup,
  };
}

export function validateNoTreeNodeCollisions(
  placements: TreeNodePlacement[],
  dims: TreeNodeDimensions,
  renderedWidth: number,
  renderedHeight: number,
): boolean {
  return (
    findCollidingPair(placements, dims, renderedWidth, renderedHeight) === null
  );
}

export function validatePlacementsInBounds(
  placements: TreeNodePlacement[],
  bounds: TreeBoundsNorm,
): boolean {
  return placements.every(
    (placement) =>
      isFiniteNumber(placement.x) &&
      isFiniteNumber(placement.y) &&
      placement.x >= bounds.minX - 0.02 &&
      placement.x <= bounds.maxX + 0.02 &&
      placement.y >= bounds.minY - 0.02 &&
      placement.y <= bounds.maxY + 0.02,
  );
}
