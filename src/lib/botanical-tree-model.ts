import {
  buildPersonIndex,
  computeRelativeGenerations,
  getAncestorIds,
  getDescendantIds,
  getSiblingIds,
  getSpouseIds,
  type PersonIndex,
} from "./tree-visibility";
import type { Person } from "../types/family";

export type LineageSide = "center" | "paternal" | "maternal" | "collateral";

export type BotanicalDisplayLevel = "central" | "primary" | "normal";

export type BotanicalPersonPlacement = {
  personId: string;
  generation: number;
  branchId: string;
  side: LineageSide;
  x: number;
  y: number;
  displayLevel: BotanicalDisplayLevel;
  isCentral: boolean;
  isSpouse: boolean;
  isCollapsedLineageRoot: boolean;
};

export type BotanicalCollapsedBranch = {
  id: string;
  anchorPersonId: string;
  hiddenCount: number;
  x: number;
  y: number;
  side: LineageSide;
};

export type BotanicalSvgPath = {
  d: string;
  width: number;
  kind: "root" | "trunk" | "branch" | "twig" | "canopy";
};

export type BotanicalTreeModel = {
  componentId: string;
  focusId: string;
  centerX: number;
  centerY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  placements: BotanicalPersonPlacement[];
  collapsed: BotanicalCollapsedBranch[];
  svgPaths: BotanicalSvgPath[];
  unionDecor: Array<{ x: number; y: number; personA: string; personB: string }>;
};

export function personSortKey(person: Person): [number, number, string] {
  if (person.birthDate) {
    return [0, new Date(person.birthDate).getFullYear(), person.id];
  }
  if (person.birthYear !== undefined) {
    return [1, person.birthYear, person.id];
  }
  return [2, 0, person.externalKey ?? person.id];
}

export function findConnectedComponents(
  people: Person[],
  index: PersonIndex,
): string[][] {
  const ids = new Set(people.map((p) => p.id));
  const visited = new Set<string>();
  const components: string[][] = [];

  function neighbors(id: string): string[] {
    const result: string[] = [];
    for (const parentId of index.parentIds.get(id) ?? []) {
      if (ids.has(parentId)) result.push(parentId);
    }
    for (const childId of index.childIds.get(id) ?? []) {
      if (ids.has(childId)) result.push(childId);
    }
    for (const spouseId of index.spouseIds.get(id) ?? []) {
      if (ids.has(spouseId)) result.push(spouseId);
    }
    return result;
  }

  for (const person of people) {
    if (visited.has(person.id)) continue;
    const component: string[] = [];
    const queue = [person.id];
    visited.add(person.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of neighbors(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
}

/** Assign lineage side relative to focus person. */
export function assignLineageSides(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
  expandedCollateral: Set<string>,
): Map<string, LineageSide> {
  const sides = new Map<string, LineageSide>();
  if (!index.byId.has(focusId)) return sides;

  sides.set(focusId, "center");

  const focus = index.byId.get(focusId)!;
  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    visibleIds.has(id),
  );

  let fatherId: string | null = null;
  let motherId: string | null = null;
  for (const parentId of parents) {
    const parent = index.byId.get(parentId);
    if (!parent) continue;
    if (parent.gender === "female") {
      motherId = parentId;
    } else if (parent.gender === "male") {
      fatherId = parentId;
    } else if (!fatherId) {
      fatherId = parentId;
    } else if (!motherId) {
      motherId = parentId;
    }
  }
  if (parents.length === 1 && !fatherId && !motherId) {
    fatherId = parents[0];
  }
  if (parents.length === 2 && !motherId) {
    motherId = parents[1];
  }

  function markAncestors(startId: string, side: LineageSide): void {
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (sides.has(id)) continue;
      sides.set(id, side);
      for (const parentId of index.parentIds.get(id) ?? []) {
        if (visibleIds.has(parentId) && !sides.has(parentId)) {
          stack.push(parentId);
        }
      }
    }
  }

  if (fatherId) {
    sides.set(fatherId, "paternal");
    markAncestors(fatherId, "paternal");
  }
  if (motherId) {
    sides.set(motherId, "maternal");
    markAncestors(motherId, "maternal");
  }

  const primarySpouse = pickPrimarySpouse(focusId, index);
  if (primarySpouse && visibleIds.has(primarySpouse)) {
    sides.set(primarySpouse, "center");
    for (const ancestorId of getAncestorIds(primarySpouse, index)) {
      if (!visibleIds.has(ancestorId) || sides.has(ancestorId)) continue;
      sides.set(ancestorId, "maternal");
    }
  }

  const centerIds = new Set<string>([focusId]);
  for (const spouseId of index.spouseIds.get(focusId) ?? []) {
    if (visibleIds.has(spouseId)) {
      sides.set(spouseId, "center");
      centerIds.add(spouseId);
    }
  }

  for (const childId of index.childIds.get(focusId) ?? []) {
    if (visibleIds.has(childId)) sides.set(childId, "center");
  }

  for (const id of getDescendantIds(focusId, index)) {
    if (visibleIds.has(id)) sides.set(id, "center");
  }

  for (const id of visibleIds) {
    if (sides.has(id)) continue;
    const person = index.byId.get(id);
    if (!person) continue;

    let assigned = false;
    for (const spouseId of index.spouseIds.get(id) ?? []) {
      const spouseSide = sides.get(spouseId);
      if (spouseSide === "center" || spouseSide === "paternal" || spouseSide === "maternal") {
        if (expandedCollateral.has(id)) {
          sides.set(id, spouseSide);
          markAncestors(id, spouseSide === "center" ? "collateral" : spouseSide);
        } else {
          sides.set(id, "center");
        }
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      sides.set(id, "collateral");
    }
  }

  return sides;
}

export function countHiddenCollateralLineage(
  personId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
  displayIds?: Set<string>,
): number {
  const ancestors = getAncestorIds(personId, index);
  let hidden = 0;
  for (const id of ancestors) {
    if (!visibleIds.has(id)) {
      hidden += 1;
      continue;
    }
    if (displayIds && !displayIds.has(id)) {
      hidden += 1;
    }
  }
  return hidden;
}

export function buildGenerationsForVisible(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
): Map<string, number> {
  const all = computeRelativeGenerations(focusId, index);

  const primarySpouse = pickPrimarySpouse(focusId, index);
  if (primarySpouse && index.byId.has(primarySpouse)) {
    const spouseGens = computeRelativeGenerations(primarySpouse, index);
    const focusGen = all.get(focusId) ?? 0;
    const spouseFocusGen = spouseGens.get(primarySpouse) ?? 0;
    const offset = focusGen - spouseFocusGen;
    for (const [id, gen] of spouseGens) {
      if (!visibleIds.has(id)) continue;
      if (!all.has(id)) {
        all.set(id, gen + offset);
      }
    }
  }

  const filtered = new Map<string, number>();
  for (const [id, gen] of all) {
    if (visibleIds.has(id)) filtered.set(id, gen);
  }
  return filtered;
}

export function pickPrimarySpouse(
  focusId: string,
  index: PersonIndex,
): string | null {
  const spouses = (index.spouseIds.get(focusId) ?? []).filter((id) =>
    index.byId.has(id),
  );
  if (spouses.length === 0) return null;
  const focus = index.byId.get(focusId)!;
  const current = spouses.find((id) => {
    const link = focus.spouseLinks?.find((l) => l.spouseId === id);
    return link?.status === "current" || link?.status === "unknown";
  });
  return current ?? spouses[0];
}

export function isCentralCoupleMember(
  focusId: string,
  personId: string,
  index: PersonIndex,
): boolean {
  if (personId === focusId) return true;
  const primary = pickPrimarySpouse(focusId, index);
  return primary === personId;
}

/** People actually drawn as medallions — collateral spouse lineages stay collapsed by default. */
export function computeBotanicalDisplayIds(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
  expandedCollateral: Set<string>,
): Set<string> {
  const display = new Set<string>();
  const primarySpouse = pickPrimarySpouse(focusId, index);

  const alwaysShow = new Set<string>();
  alwaysShow.add(focusId);

  for (const id of getAncestorIds(focusId, index)) {
    if (visibleIds.has(id)) alwaysShow.add(id);
  }
  for (const id of getDescendantIds(focusId, index)) {
    if (visibleIds.has(id)) alwaysShow.add(id);
  }

  if (primarySpouse && visibleIds.has(primarySpouse)) {
    alwaysShow.add(primarySpouse);
    for (const id of getAncestorIds(primarySpouse, index)) {
      if (visibleIds.has(id)) alwaysShow.add(id);
    }
  }

  for (const spouseId of index.spouseIds.get(focusId) ?? []) {
    if (visibleIds.has(spouseId)) alwaysShow.add(spouseId);
  }

  for (const siblingId of getSiblingIds(focusId, index)) {
    if (visibleIds.has(siblingId)) alwaysShow.add(siblingId);
    for (const spouseId of index.spouseIds.get(siblingId) ?? []) {
      if (visibleIds.has(spouseId)) alwaysShow.add(spouseId);
    }
  }

  for (const id of visibleIds) {
    if (alwaysShow.has(id)) {
      display.add(id);
      continue;
    }

    for (const rootId of expandedCollateral) {
      if (!visibleIds.has(rootId)) continue;
      if (id === rootId) {
        display.add(id);
        break;
      }
      if (getAncestorIds(rootId, index).has(id)) {
        display.add(id);
        break;
      }
      if (getDescendantIds(rootId, index).has(id)) {
        display.add(id);
        break;
      }
    }
  }

  return display;
}

export { buildPersonIndex, getSpouseIds, type PersonIndex };
