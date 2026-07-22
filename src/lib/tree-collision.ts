export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionPair {
  a: Rect;
  b: Rect;
  overlapX: number;
  overlapY: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface CollisionMetrics extends NodeSize {
  gapX: number;
  gapY: number;
  paddingX?: number;
  paddingY?: number;
}

export function getNodeRect(
  id: string,
  position: Point,
  size: CollisionMetrics,
): Rect {
  const padX = size.paddingX ?? 0;
  const padY = size.paddingY ?? 0;
  return {
    id,
    x: position.x - padX,
    y: position.y - padY,
    width: size.width + padX * 2,
    height: size.height + padY * 2,
  };
}

/** Axis-aligned overlap including optional minimum gap (touching counts as overlap). */
export function rectanglesOverlap(
  a: Rect,
  b: Rect,
  gapX = 0,
  gapY = 0,
): boolean {
  if (a.id === b.id) return false;
  return !(
    a.x + a.width + gapX <= b.x ||
    b.x + b.width + gapX <= a.x ||
    a.y + a.height + gapY <= b.y ||
    b.y + b.height + gapY <= a.y
  );
}

export function findNodeCollisions(
  rects: Rect[],
  gapX = 0,
  gapY = 0,
): CollisionPair[] {
  const pairs: CollisionPair[] = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if (!rectanglesOverlap(a, b, gapX, gapY)) continue;
      const overlapX =
        Math.min(a.x + a.width + gapX, b.x + b.width + gapX) -
        Math.max(a.x, b.x);
      const overlapY =
        Math.min(a.y + a.height + gapY, b.y + b.height + gapY) -
        Math.max(a.y, b.y);
      pairs.push({ a, b, overlapX, overlapY });
    }
  }
  return pairs;
}

/**
 * Push overlapping nodes in the same generation row to the right.
 * Returns total dx applied per id (for shifting unions).
 */
export function resolveGenerationCollisions(
  positions: Map<string, Point>,
  personIds: string[],
  metrics: CollisionMetrics,
  maxPasses = 64,
): Map<string, number> {
  const shifts = new Map<string, number>();
  if (personIds.length < 2) return shifts;

  const minStep = metrics.width + metrics.gapX;
  let pass = 0;

  while (pass < maxPasses) {
    pass += 1;
    const sorted = [...personIds].sort((a, b) => {
      const pa = positions.get(a);
      const pb = positions.get(b);
      return (pa?.x ?? 0) - (pb?.x ?? 0);
    });

    let moved = false;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const leftId = sorted[i];
      const rightId = sorted[i + 1];
      const left = positions.get(leftId);
      const right = positions.get(rightId);
      if (!left || !right) continue;

      const leftRect = getNodeRect(leftId, left, metrics);
      const rightRect = getNodeRect(rightId, right, metrics);
      if (!rectanglesOverlap(leftRect, rightRect, metrics.gapX, metrics.gapY)) {
        continue;
      }

      const requiredX = left.x + minStep;
      const delta = requiredX - right.x;
      if (delta <= 0.01) continue;

      // Shift this node and everyone to its right in the row.
      for (let j = i + 1; j < sorted.length; j += 1) {
        const id = sorted[j];
        const point = positions.get(id);
        if (!point) continue;
        point.x += delta;
        shifts.set(id, (shifts.get(id) ?? 0) + delta);
      }
      moved = true;
      break;
    }

    if (!moved) break;
  }

  return shifts;
}

export function validateNoPersonNodeCollisions(
  positions: Map<string, Point>,
  metrics: CollisionMetrics,
): CollisionPair[] {
  const rects = [...positions.entries()].map(([id, point]) =>
    getNodeRect(id, point, metrics),
  );
  return findNodeCollisions(rects, metrics.gapX, metrics.gapY);
}

export interface ComponentBounds {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getComponentBounds(
  id: string,
  memberIds: string[],
  positions: Map<string, Point>,
  size: NodeSize,
): ComponentBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  for (const memberId of memberIds) {
    const point = positions.get(memberId);
    if (!point) continue;
    found = true;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x + size.width);
    maxY = Math.max(maxY, point.y + size.height);
  }

  if (!found) return null;
  return { id, minX, minY, maxX, maxY };
}

export function componentBoundsOverlap(
  a: ComponentBounds,
  b: ComponentBounds,
  gapX: number,
  gapY: number,
): boolean {
  return !(
    a.maxX + gapX <= b.minX ||
    b.maxX + gapX <= a.minX ||
    a.maxY + gapY <= b.minY ||
    b.maxY + gapY <= a.minY
  );
}

/** Pack component bounding boxes left-to-right without overlap. */
export function resolveComponentCollisions(
  components: ComponentBounds[],
  positions: Map<string, Point>,
  memberIdsByComponent: Map<string, string[]>,
  gapX: number,
  maxPasses = 32,
): void {
  if (components.length < 2) return;

  let pass = 0;
  while (pass < maxPasses) {
    pass += 1;
    const ordered = [...components].sort((a, b) => a.minX - b.minX);
    let moved = false;

    for (let i = 0; i < ordered.length - 1; i += 1) {
      const left = ordered[i];
      const right = ordered[i + 1];
      if (!componentBoundsOverlap(left, right, gapX, 0)) continue;

      const delta = left.maxX + gapX - right.minX;
      if (delta <= 0.01) continue;

      const members = memberIdsByComponent.get(right.id) ?? [];
      for (const memberId of members) {
        const point = positions.get(memberId);
        if (point) point.x += delta;
      }
      right.minX += delta;
      right.maxX += delta;
      moved = true;
    }

    if (!moved) break;
  }
}

export function logCollisionsInDev(
  pairs: CollisionPair[],
  generationByPerson?: Map<string, number>,
): void {
  if (
    typeof process === "undefined" ||
    process.env.NODE_ENV === "production" ||
    pairs.length === 0
  ) {
    return;
  }

  for (const pair of pairs) {
    console.warn("[tree-layout] Person node collision:", {
      personA: pair.a.id,
      personB: pair.b.id,
      generationA: generationByPerson?.get(pair.a.id),
      generationB: generationByPerson?.get(pair.b.id),
      rectA: pair.a,
      rectB: pair.b,
    });
  }
}
