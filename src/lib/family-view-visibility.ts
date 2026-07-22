import { findConnectedComponents } from "./botanical-tree-model";
import type { FamilyRelationship, Person } from "@/types/family";
import type { TreeViewMode } from "./tree-visibility";

export type FamilyViewInclusionReason =
  | "nearby-focus"
  | "nearby-spouse"
  | "nearby-parent"
  | "nearby-sibling"
  | "nearby-child"
  | "generation-grandparent"
  | "generation-grandchild"
  | "generation-spouse"
  | "branch-component"
  | "all";

export type FamilyViewVisibility = {
  focusId: string | null;
  nearbyIds: Set<string>;
  generationsIds: Set<string>;
  branchIds: Set<string>;
  allIds: Set<string>;
  reasons: Map<string, FamilyViewInclusionReason>;
  focusedComponentSize: number;
  connectedComponentCount: number;
};

type LocalIndex = {
  byId: Map<string, Person>;
  parentIds: Map<string, string[]>;
  childIds: Map<string, string[]>;
  spouseIds: Map<string, string[]>;
};

function uniquePush(target: Set<string>, ids: Iterable<string>): void {
  for (const id of ids) target.add(id);
}

function getSpouseIds(person: Person): string[] {
  if (person.spouseIds && person.spouseIds.length > 0) {
    return [...new Set(person.spouseIds)];
  }
  return person.spouseId ? [person.spouseId] : [];
}

function buildLocalIndex(people: Person[]): LocalIndex {
  const byId = new Map(people.map((person) => [person.id, person]));
  const parentIds = new Map<string, string[]>();
  const childIds = new Map<string, string[]>();
  const spouseIds = new Map<string, string[]>();

  for (const person of people) {
    parentIds.set(person.id, [...person.parentIds]);
    childIds.set(person.id, [...person.childIds]);
    spouseIds.set(person.id, getSpouseIds(person));
  }

  for (const person of people) {
    for (const parentId of person.parentIds) {
      if (!byId.has(parentId)) continue;
      const kids = childIds.get(parentId) ?? [];
      if (!kids.includes(person.id)) {
        childIds.set(parentId, [...kids, person.id]);
      }
    }
    for (const childId of person.childIds) {
      if (!byId.has(childId)) continue;
      const parents = parentIds.get(childId) ?? [];
      if (!parents.includes(person.id)) {
        parentIds.set(childId, [...parents, person.id]);
      }
    }
    for (const spouseId of getSpouseIds(person)) {
      if (!byId.has(spouseId)) continue;
      const reverse = spouseIds.get(spouseId) ?? [];
      if (!reverse.includes(person.id)) {
        spouseIds.set(spouseId, [...reverse, person.id]);
      }
    }
  }

  return { byId, parentIds, childIds, spouseIds };
}

function getSiblingIds(personId: string, index: LocalIndex): string[] {
  const parents = index.parentIds.get(personId) ?? [];
  const siblings = new Set<string>();
  for (const parentId of parents) {
    for (const childId of index.childIds.get(parentId) ?? []) {
      if (childId !== personId && index.byId.has(childId)) {
        siblings.add(childId);
      }
    }
  }
  return [...siblings];
}

function markReason(
  reasons: Map<string, FamilyViewInclusionReason>,
  id: string,
  reason: FamilyViewInclusionReason,
): void {
  if (!reasons.has(id)) {
    reasons.set(id, reason);
  }
}

function getConnectedComponentIds(
  focusId: string,
  people: Person[],
  index: LocalIndex,
): Set<string> {
  const components = findConnectedComponents(people, index);
  const focusComponent =
    components.find((memberIds) => memberIds.includes(focusId)) ?? [];
  return new Set(focusComponent);
}

/** Strict nearby: focus, spouses, parents, siblings, direct children. */
export function buildNearbyViewIds(
  focusId: string,
  index: LocalIndex,
  reasons: Map<string, FamilyViewInclusionReason>,
): Set<string> {
  const nearby = new Set<string>();
  if (!index.byId.has(focusId)) return nearby;

  nearby.add(focusId);
  markReason(reasons, focusId, "nearby-focus");

  for (const spouseId of index.spouseIds.get(focusId) ?? []) {
    if (!index.byId.has(spouseId)) continue;
    nearby.add(spouseId);
    markReason(reasons, spouseId, "nearby-spouse");
  }

  for (const parentId of index.parentIds.get(focusId) ?? []) {
    if (!index.byId.has(parentId)) continue;
    nearby.add(parentId);
    markReason(reasons, parentId, "nearby-parent");
  }

  for (const siblingId of getSiblingIds(focusId, index)) {
    nearby.add(siblingId);
    markReason(reasons, siblingId, "nearby-sibling");
  }

  for (const childId of index.childIds.get(focusId) ?? []) {
    if (!index.byId.has(childId)) continue;
    nearby.add(childId);
    markReason(reasons, childId, "nearby-child");
  }

  return nearby;
}

/**
 * Generations = nearby ∪ grandparents ∪ grandchildren ∪ needed pair spouses.
 * Never removes anyone from nearby.
 */
export function buildGenerationsViewIds(
  focusId: string,
  index: LocalIndex,
  nearbyIds: Set<string>,
  reasons: Map<string, FamilyViewInclusionReason>,
): Set<string> {
  const generations = new Set(nearbyIds);
  if (!index.byId.has(focusId)) return generations;

  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    index.byId.has(id),
  );
  for (const parentId of parents) {
    for (const gpId of index.parentIds.get(parentId) ?? []) {
      if (!index.byId.has(gpId)) continue;
      generations.add(gpId);
      markReason(reasons, gpId, "generation-grandparent");
      for (const gpSpouse of index.spouseIds.get(gpId) ?? []) {
        if (!index.byId.has(gpSpouse)) continue;
        generations.add(gpSpouse);
        markReason(reasons, gpSpouse, "generation-spouse");
      }
    }
    for (const parentSpouse of index.spouseIds.get(parentId) ?? []) {
      if (!index.byId.has(parentSpouse)) continue;
      generations.add(parentSpouse);
      markReason(reasons, parentSpouse, "generation-spouse");
    }
  }

  const children = (index.childIds.get(focusId) ?? []).filter((id) =>
    index.byId.has(id),
  );
  for (const childId of children) {
    for (const childSpouse of index.spouseIds.get(childId) ?? []) {
      if (!index.byId.has(childSpouse)) continue;
      generations.add(childSpouse);
      markReason(reasons, childSpouse, "generation-spouse");
    }
    for (const grandchildId of index.childIds.get(childId) ?? []) {
      if (!index.byId.has(grandchildId)) continue;
      generations.add(grandchildId);
      markReason(reasons, grandchildId, "generation-grandchild");
    }
  }

  for (const siblingId of getSiblingIds(focusId, index)) {
    for (const siblingSpouse of index.spouseIds.get(siblingId) ?? []) {
      if (!index.byId.has(siblingSpouse)) continue;
      generations.add(siblingSpouse);
      markReason(reasons, siblingSpouse, "generation-spouse");
    }
  }

  return generations;
}

export function assertFamilyViewNesting(sets: {
  nearbyIds: ReadonlySet<string>;
  generationsIds: ReadonlySet<string>;
  branchIds: ReadonlySet<string>;
  allIds: ReadonlySet<string>;
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const id of sets.nearbyIds) {
    if (!sets.generationsIds.has(id)) {
      failures.push(`nearby⊈generations: ${id}`);
    }
  }
  for (const id of sets.generationsIds) {
    if (!sets.branchIds.has(id)) {
      failures.push(`generations⊈branch: ${id}`);
    }
  }
  for (const id of sets.branchIds) {
    if (!sets.allIds.has(id)) {
      failures.push(`branch⊈all: ${id}`);
    }
  }
  return { ok: failures.length === 0, failures };
}

export function buildFamilyViewPersonIds(input: {
  mode?: TreeViewMode;
  focusedPersonId: string | null;
  people: Person[];
  relationships?: FamilyRelationship[];
}): FamilyViewVisibility {
  void input.mode;
  void input.relationships;
  const { people } = input;
  const index = buildLocalIndex(people);
  const allIds = new Set(people.map((person) => person.id));
  const reasons = new Map<string, FamilyViewInclusionReason>();

  const focusId =
    input.focusedPersonId && index.byId.has(input.focusedPersonId)
      ? input.focusedPersonId
      : null;

  if (!focusId) {
    for (const id of allIds) markReason(reasons, id, "all");
    return {
      focusId: null,
      nearbyIds: new Set(),
      generationsIds: new Set(),
      branchIds: new Set(),
      allIds,
      reasons,
      focusedComponentSize: 0,
      connectedComponentCount: findConnectedComponents(people, index).length,
    };
  }

  const nearbyIds = buildNearbyViewIds(focusId, index, reasons);
  const generationsIds = buildGenerationsViewIds(
    focusId,
    index,
    nearbyIds,
    reasons,
  );

  const branchIds = getConnectedComponentIds(focusId, people, index);
  for (const id of branchIds) {
    markReason(reasons, id, "branch-component");
  }
  // Enforce generations ⊆ branch even if graph edges are incomplete.
  uniquePush(branchIds, generationsIds);

  for (const id of allIds) {
    markReason(reasons, id, "all");
  }

  const nesting = assertFamilyViewNesting({
    nearbyIds,
    generationsIds,
    branchIds,
    allIds,
  });
  if (
    !nesting.ok &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development"
  ) {
    // eslint-disable-next-line no-console
    console.warn("[family-view-visibility] nesting failed", nesting.failures);
  }

  return {
    focusId,
    nearbyIds,
    generationsIds,
    branchIds,
    allIds,
    reasons,
    focusedComponentSize: branchIds.size,
    connectedComponentCount: findConnectedComponents(people, index).length,
  };
}

export function selectFamilyViewIds(
  visibility: FamilyViewVisibility,
  mode: TreeViewMode,
): Set<string> {
  if (mode === "nearby") return new Set(visibility.nearbyIds);
  if (mode === "generations") return new Set(visibility.generationsIds);
  if (mode === "branch") return new Set(visibility.branchIds);
  return new Set(visibility.allIds);
}

export function getFamilyViewModeCounts(visibility: FamilyViewVisibility): {
  nearby: number;
  generations: number;
  branch: number;
  all: number;
} {
  return {
    nearby: visibility.nearbyIds.size,
    generations: visibility.generationsIds.size,
    branch: visibility.branchIds.size,
    all: visibility.allIds.size,
  };
}
