import type { FamilyRelationship, Person } from "@/types/family";
import {
  buildFamilyViewPersonIds,
  selectFamilyViewIds,
} from "./family-view-visibility";

export type TreeViewMode = "nearby" | "generations" | "branch" | "all";

export interface PersonIndex {
  byId: Map<string, Person>;
  parentIds: Map<string, string[]>;
  childIds: Map<string, string[]>;
  spouseIds: Map<string, string[]>;
}

function uniquePush(target: Set<string>, ids: Iterable<string>): void {
  for (const id of ids) {
    target.add(id);
  }
}

export function getSpouseIds(person: Person): string[] {
  if (person.spouseIds && person.spouseIds.length > 0) {
    return [...new Set(person.spouseIds)];
  }
  return person.spouseId ? [person.spouseId] : [];
}

export function buildPersonIndex(people: Person[]): PersonIndex {
  const byId = new Map(people.map((person) => [person.id, person]));
  const parentIds = new Map<string, string[]>();
  const childIds = new Map<string, string[]>();
  const spouseIds = new Map<string, string[]>();

  for (const person of people) {
    parentIds.set(person.id, [...(person.parentIds ?? [])]);
    childIds.set(person.id, [...(person.childIds ?? [])]);
    spouseIds.set(person.id, getSpouseIds(person));
  }

  return { byId, parentIds, childIds, spouseIds };
}

export function getSiblingIds(
  personId: string,
  index: PersonIndex,
): string[] {
  const parents = index.parentIds.get(personId) ?? [];
  if (parents.length === 0) {
    return [];
  }

  const siblings = new Set<string>();
  for (const parentId of parents) {
    for (const childId of index.childIds.get(parentId) ?? []) {
      if (childId !== personId) {
        siblings.add(childId);
      }
    }
  }
  return [...siblings];
}

export function getDescendantIds(
  personId: string,
  index: PersonIndex,
): Set<string> {
  const result = new Set<string>();
  const stack = [...(index.childIds.get(personId) ?? [])];
  const visiting = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || result.has(current) || visiting.has(current)) {
      continue;
    }
    visiting.add(current);
    result.add(current);
    for (const childId of index.childIds.get(current) ?? []) {
      if (!result.has(childId) && !visiting.has(childId)) {
        stack.push(childId);
      }
    }
  }

  return result;
}

export function getAncestorIds(
  personId: string,
  index: PersonIndex,
): Set<string> {
  const result = new Set<string>();
  const stack = [...(index.parentIds.get(personId) ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || result.has(current)) {
      continue;
    }
    result.add(current);
    for (const parentId of index.parentIds.get(current) ?? []) {
      if (!result.has(parentId)) {
        stack.push(parentId);
      }
    }
  }

  return result;
}

/**
 * Relative generations around focus:
 * focus = 0, parents = -1, grandparents = -2, children = +1, …
 * Spouses share the partner's generation. Conflicts keep the first assignment.
 */
export function computeRelativeGenerations(
  focusId: string,
  index: PersonIndex,
): Map<string, number> {
  const generations = new Map<string, number>();
  if (!index.byId.has(focusId)) {
    return generations;
  }

  const assign = (id: string, generation: number): boolean => {
    const existing = generations.get(id);
    if (existing === undefined) {
      generations.set(id, generation);
      return true;
    }
    if (
      existing !== generation &&
      typeof process !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      console.warn(
        `[family-tree] generation conflict for ${id}: keep ${existing}, skip ${generation}`,
      );
    }
    return false;
  };

  assign(focusId, 0);

  const ancestorQueue: Array<{ id: string; generation: number }> = [
    { id: focusId, generation: 0 },
  ];
  while (ancestorQueue.length > 0) {
    const current = ancestorQueue.shift();
    if (!current) break;
    for (const parentId of index.parentIds.get(current.id) ?? []) {
      if (!index.byId.has(parentId)) continue;
      if (assign(parentId, current.generation - 1)) {
        ancestorQueue.push({
          id: parentId,
          generation: current.generation - 1,
        });
      }
    }
  }

  const descendantQueue: Array<{ id: string; generation: number }> = [
    { id: focusId, generation: 0 },
  ];
  while (descendantQueue.length > 0) {
    const current = descendantQueue.shift();
    if (!current) break;
    for (const childId of index.childIds.get(current.id) ?? []) {
      if (!index.byId.has(childId)) continue;
      if (assign(childId, current.generation + 1)) {
        descendantQueue.push({
          id: childId,
          generation: current.generation + 1,
        });
      }
    }
  }

  for (const siblingId of getSiblingIds(focusId, index)) {
    assign(siblingId, 0);
  }

  // Spouses share generation with the already-assigned partner.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [personId, generation] of generations) {
      for (const spouseId of index.spouseIds.get(personId) ?? []) {
        if (!index.byId.has(spouseId)) continue;
        if (assign(spouseId, generation)) {
          changed = true;
        }
      }
    }
  }

  return generations;
}

/** Nearby: focus, spouses, parents, siblings, direct children. */
export function getNearbyPersonIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  const people = [...index.byId.values()];
  return buildFamilyViewPersonIds({
    focusedPersonId: focusId,
    people,
  }).nearbyIds;
}

/**
 * Three neighbouring generation levels around focus (not ancestor-only).
 *
 * Window selection:
 * - ancestors + descendants → [-1, 0, +1]
 * - ancestors only → expand upward [-2, -1, 0]
 * - descendants only → expand downward [0, +1, +2]
 * - parents only / children only / isolated → shorter windows
 *
 * Includes focus path (ancestors + descendants) and necessary spouses.
 * Does not auto-include siblings, uncles/aunts, or cousins.
 */
export function chooseThreeGenerationLevels(
  availableLevels: readonly number[],
): number[] {
  const available = [...new Set(availableLevels)].sort((a, b) => a - b);
  if (available.length === 0) {
    return [0];
  }

  const set = new Set(available);
  const hasNeg = available.some((level) => level < 0);
  const hasPos = available.some((level) => level > 0);

  let preferred: number[];
  if (hasNeg && hasPos) {
    preferred = [-1, 0, 1];
  } else if (hasNeg) {
    preferred = [0, -1, -2];
  } else if (hasPos) {
    preferred = [0, 1, 2];
  } else {
    preferred = [0];
  }

  const chosen = preferred.filter((level) => set.has(level));
  if (chosen.length > 0) {
    return [...chosen].sort((a, b) => a - b);
  }

  // Fallback: contiguous window of up to 3 levels that includes 0 when possible.
  if (set.has(0)) {
    return [0];
  }
  return available.slice(0, 3);
}

export type ThreeGenerationWindow = {
  levels: number[];
  personIds: Set<string>;
  generations: Map<string, number>;
};

/**
 * Core path for the generations window: focus, ancestors, descendants,
 * plus spouses of people already on that path.
 */
export function getThreeGenerationCorePathIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  const core = new Set<string>();
  if (!index.byId.has(focusId)) {
    return core;
  }

  core.add(focusId);
  uniquePush(core, getAncestorIds(focusId, index));
  uniquePush(core, getDescendantIds(focusId, index));

  for (const personId of [...core]) {
    uniquePush(core, index.spouseIds.get(personId) ?? []);
  }

  return core;
}

export function getThreeGenerationWindow(input: {
  focusedPersonId: string;
  people: Person[];
  relationships?: FamilyRelationship[];
}): ThreeGenerationWindow {
  void input.relationships;
  const index = buildPersonIndex(input.people);
  const focusId = input.focusedPersonId;
  if (!index.byId.has(focusId)) {
    return { levels: [0], personIds: new Set(), generations: new Map() };
  }

  const generations = computeRelativeGenerations(focusId, index);
  const personIds = getThreeGenerationPersonIds(focusId, index);

  const availableLevels: number[] = [];
  for (const personId of personIds) {
    const level = generations.get(personId);
    if (level === undefined) continue;
    if (!availableLevels.includes(level)) availableLevels.push(level);
  }
  availableLevels.sort((a, b) => a - b);
  const levels = chooseThreeGenerationLevels(availableLevels);

  return { levels, personIds, generations };
}

/**
 * «3 поколения» — nearby ∪ grandparents ∪ grandchildren ∪ pair spouses.
 * Shared by Tree and Scheme via getVisiblePersonIds / family-view-visibility.
 */
export function getThreeGenerationPersonIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  const people = [...index.byId.values()];
  return buildFamilyViewPersonIds({
    focusedPersonId: focusId,
    people,
  }).generationsIds;
}

/** @deprecated Use getThreeGenerationPersonIds — kept as alias for callers. */
export function getGenerationsPersonIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  return getThreeGenerationPersonIds(focusId, index);
}

/**
 * Branch: full connected component of focus (parent/spouse edges).
 */
export function getBranchPersonIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  const people = [...index.byId.values()];
  return buildFamilyViewPersonIds({
    focusedPersonId: focusId,
    people,
  }).branchIds;
}

function applyCollapsedVisibility(
  baseVisible: Set<string>,
  collapsedPersonIds: ReadonlySet<string>,
  index: PersonIndex,
  focusId: string | null,
): Set<string> {
  if (collapsedPersonIds.size === 0) {
    const result = new Set(baseVisible);
    if (focusId && index.byId.has(focusId)) {
      result.add(focusId);
      uniquePush(result, index.spouseIds.get(focusId) ?? []);
    }
    return result;
  }

  const result = new Set(baseVisible);
  const focusAncestors =
    focusId && index.byId.has(focusId)
      ? getAncestorIds(focusId, index)
      : new Set<string>();
  const focusPath = new Set<string>(focusAncestors);
  if (focusId) {
    focusPath.add(focusId);
  }

  for (const collapsedId of collapsedPersonIds) {
    if (!result.has(collapsedId)) {
      continue;
    }

    const descendants = getDescendantIds(collapsedId, index);
    const spousesOfCollapsed = new Set(
      index.spouseIds.get(collapsedId) ?? [],
    );

    for (const descendantId of descendants) {
      if (!result.has(descendantId)) {
        continue;
      }

      if (
        focusPath.has(descendantId) ||
        (focusId !== null &&
          (index.spouseIds.get(focusId) ?? []).includes(descendantId))
      ) {
        continue;
      }

      const parents = index.parentIds.get(descendantId) ?? [];
      const hasExternalParent = parents.some(
        (parentId) =>
          result.has(parentId) &&
          parentId !== collapsedId &&
          !descendants.has(parentId) &&
          !spousesOfCollapsed.has(parentId),
      );

      if (hasExternalParent) {
        continue;
      }

      const spouses = index.spouseIds.get(descendantId) ?? [];
      const linkedOutside = spouses.some(
        (spouseId) =>
          result.has(spouseId) &&
          !descendants.has(spouseId) &&
          spouseId !== collapsedId,
      );

      if (linkedOutside) {
        continue;
      }

      result.delete(descendantId);
    }
  }

  if (focusId && index.byId.has(focusId)) {
    result.add(focusId);
    uniquePush(result, index.spouseIds.get(focusId) ?? []);
    for (const ancestorId of focusAncestors) {
      if (baseVisible.has(ancestorId)) {
        result.add(ancestorId);
      }
    }
  }

  return result;
}

/** Collapse ids that hide a person; used to temporarily reveal a path. */
export function getCollapseIdsHidingPerson(
  personId: string,
  collapsedPersonIds: ReadonlySet<string>,
  index: PersonIndex,
): string[] {
  if (collapsedPersonIds.size === 0) {
    return [];
  }

  const hiding: string[] = [];
  for (const collapsedId of collapsedPersonIds) {
    if (collapsedId === personId) continue;
    const descendants = getDescendantIds(collapsedId, index);
    if (descendants.has(personId)) {
      hiding.push(collapsedId);
    }
  }
  return hiding;
}

export function getVisiblePersonIds(input: {
  mode: TreeViewMode;
  focusId: string | null;
  people: Person[];
  collapsedPersonIds: ReadonlySet<string>;
}): Set<string> {
  const { mode, focusId, people, collapsedPersonIds } = input;
  const index = buildPersonIndex(people);
  const visibility = buildFamilyViewPersonIds({
    focusedPersonId: focusId,
    people,
  });
  const base = selectFamilyViewIds(visibility, mode);

  if (focusId && index.byId.has(focusId)) {
    base.add(focusId);
    uniquePush(base, index.spouseIds.get(focusId) ?? []);
  }

  return applyCollapsedVisibility(base, collapsedPersonIds, index, focusId);
}

export function filterPeopleByIds(
  people: Person[],
  visibleIds: ReadonlySet<string>,
): Person[] {
  return people.filter((person) => visibleIds.has(person.id));
}

export function filterRelationshipsForVisiblePeople(
  relationships: FamilyRelationship[],
  visibleIds: ReadonlySet<string>,
): FamilyRelationship[] {
  return relationships.filter(
    (relationship) =>
      visibleIds.has(relationship.sourceId) &&
      visibleIds.has(relationship.targetId),
  );
}

export function getHiddenDescendantCount(
  personId: string,
  collapsedPersonIds: ReadonlySet<string>,
  index: PersonIndex,
  visibleBeforeCollapse: ReadonlySet<string>,
): number {
  if (!collapsedPersonIds.has(personId)) {
    return 0;
  }

  const descendants = getDescendantIds(personId, index);
  let count = 0;
  for (const descendantId of descendants) {
    if (visibleBeforeCollapse.has(descendantId)) {
      count += 1;
    }
  }
  return count;
}

export function personHasCollapsibleDescendants(
  personId: string,
  index: PersonIndex,
  visibleIds: ReadonlySet<string>,
): boolean {
  return (index.childIds.get(personId) ?? []).some((childId) =>
    visibleIds.has(childId),
  );
}
