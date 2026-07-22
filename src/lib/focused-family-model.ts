import {
  buildPersonIndex,
  getAncestorIds,
  getDescendantIds,
  getSiblingIds,
  type PersonIndex,
  type TreeViewMode,
} from "./tree-visibility";
import {
  buildFamilyViewPersonIds,
  selectFamilyViewIds,
} from "./family-view-visibility";
import {
  mapRelationsToFocus,
  resolveRelationToFocus,
  type RelationToFocus,
} from "./relation-to-focus";
import { findConnectedComponents } from "./botanical-tree-model";
import type { Person } from "@/types/family";

export type FocusedFamilyScenario =
  | "nearby"
  | "adult-three" // parents + focus/siblings + children
  | "elder-three" // focus + children + grandchildren
  | "child-three" // grandparents + parents + focus/siblings
  | "partial"
  | "branch"
  | "all-overview";

export type FocusedFamilyUnitKind =
  | "focus-couple"
  | "parent-couple"
  | "sibling"
  | "sibling-couple"
  | "child"
  | "child-couple"
  | "grandchild"
  | "grandparent-couple"
  | "branch-root"
  | "solo";

export type FocusedFamilyUnit = {
  id: string;
  kind: FocusedFamilyUnitKind;
  personIds: string[];
  /** Optional parent unit id for grouping grandchildren under a child. */
  parentUnitId?: string;
  label?: string;
};

export type FocusedGenerationLevel = {
  /** Display order topв†’bottom (0 = top / younger in heritage art). */
  rowIndex: number;
  title: string;
  units: FocusedFamilyUnit[];
};

export type FocusedBranchCard = {
  id: string;
  title: string;
  rootPersonId: string;
  personIds: string[];
  peopleCount: number;
};

export type FocusedFamilyModel = {
  focusId: string;
  scenario: FocusedFamilyScenario;
  viewMode: TreeViewMode;
  personIds: Set<string>;
  generations: Map<string, number>;
  relations: Map<string, RelationToFocus>;
  levels: FocusedGenerationLevel[];
  branchCards: FocusedBranchCard[];
  softLinks: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    kind: "spouse" | "parent-child";
  }>;
};

function uniquePush(target: Set<string>, ids: Iterable<string>): void {
  for (const id of ids) target.add(id);
}

function peopleWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "человек";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "человека";
  }
  return "человек";
}

function personSortKey(person: Person): string {
  return [
    person.lastName ?? "",
    person.firstName ?? "",
    person.middleName ?? "",
    person.id,
  ].join("|");
}

function sortPersonIds(ids: string[], index: PersonIndex): string[] {
  return [...ids].sort((a, b) => {
    const pa = index.byId.get(a);
    const pb = index.byId.get(b);
    if (!pa || !pb) return a.localeCompare(b);
    return personSortKey(pa).localeCompare(personSortKey(pb));
  });
}

/** Siblings via at least one shared parent; stable, deduped, excludes self. */
export function getSiblingsOfPerson(input: {
  personId: string;
  people: Person[];
}): string[] {
  const index = buildPersonIndex(input.people);
  return sortPersonIds(getSiblingIds(input.personId, index), index);
}

export function getDirectChildren(
  personId: string,
  index: PersonIndex,
): string[] {
  return sortPersonIds(
    (index.childIds.get(personId) ?? []).filter((id) => index.byId.has(id)),
    index,
  );
}

/**
 * All direct grandchildren through every child вЂ” not a single line.
 */
export function getDirectGrandchildren(
  personId: string,
  index: PersonIndex,
): string[] {
  const result = new Set<string>();
  for (const childId of getDirectChildren(personId, index)) {
    for (const grandchildId of getDirectChildren(childId, index)) {
      result.add(grandchildId);
    }
  }
  return sortPersonIds([...result], index);
}

/**
 * Directed parent/child generations only. Spouses are assigned later for layout.
 */
export function computeDirectedGenerations(
  focusId: string,
  index: PersonIndex,
): Map<string, number> {
  const generations = new Map<string, number>();
  if (!index.byId.has(focusId)) return generations;

  const assign = (id: string, generation: number): boolean => {
    if (generations.has(id)) return false;
    generations.set(id, generation);
    return true;
  };

  assign(focusId, 0);

  const up: Array<{ id: string; gen: number }> = [{ id: focusId, gen: 0 }];
  const seenUp = new Set<string>([focusId]);
  while (up.length > 0) {
    const current = up.shift();
    if (!current) break;
    for (const parentId of index.parentIds.get(current.id) ?? []) {
      if (!index.byId.has(parentId) || seenUp.has(parentId)) continue;
      seenUp.add(parentId);
      if (assign(parentId, current.gen - 1)) {
        up.push({ id: parentId, gen: current.gen - 1 });
      }
    }
  }

  const down: Array<{ id: string; gen: number }> = [{ id: focusId, gen: 0 }];
  const seenDown = new Set<string>([focusId]);
  while (down.length > 0) {
    const current = down.shift();
    if (!current) break;
    for (const childId of index.childIds.get(current.id) ?? []) {
      if (!index.byId.has(childId) || seenDown.has(childId)) continue;
      seenDown.add(childId);
      if (assign(childId, current.gen + 1)) {
        down.push({ id: childId, gen: current.gen + 1 });
      }
    }
  }

  for (const siblingId of getSiblingIds(focusId, index)) {
    assign(siblingId, 0);
  }

  // Spouses share partner generation for placement only (do not BFS through them).
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, gen] of [...generations]) {
      for (const spouseId of index.spouseIds.get(id) ?? []) {
        if (!index.byId.has(spouseId)) continue;
        if (!generations.has(spouseId)) {
          generations.set(spouseId, gen);
          changed = true;
        }
      }
    }
  }

  return generations;
}

function coupleUnit(
  id: string,
  kind: FocusedFamilyUnitKind,
  primaryId: string,
  index: PersonIndex,
  visible: Set<string>,
): FocusedFamilyUnit {
  const spouses = (index.spouseIds.get(primaryId) ?? []).filter((spouseId) =>
    visible.has(spouseId),
  );
  const personIds = sortPersonIds([primaryId, ...spouses], index);
  // Keep primary first for focus couple
  if (kind === "focus-couple" || kind === "child-couple") {
    const rest = personIds.filter((pid) => pid !== primaryId);
    return { id, kind, personIds: [primaryId, ...rest] };
  }
  return { id, kind, personIds };
}

function detectThreeScenario(
  focusId: string,
  index: PersonIndex,
): FocusedFamilyScenario {
  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    index.byId.has(id),
  );
  const children = getDirectChildren(focusId, index);
  const grandchildren = getDirectGrandchildren(focusId, index);
  const hasGrandparents = parents.some((parentId) =>
    (index.parentIds.get(parentId) ?? []).some((id) => index.byId.has(id)),
  );

  if (parents.length > 0 && children.length > 0) return "adult-three";
  if (parents.length === 0 && children.length > 0) {
    return grandchildren.length > 0 || children.length > 0
      ? "elder-three"
      : "partial";
  }
  if (parents.length > 0 && children.length === 0) {
    return hasGrandparents ? "child-three" : "partial";
  }
  return "partial";
}

function buildSoftLinks(
  personIds: Set<string>,
  index: PersonIndex,
): FocusedFamilyModel["softLinks"] {
  const links: FocusedFamilyModel["softLinks"] = [];
  const drawnSpouses = new Set<string>();

  for (const id of personIds) {
    for (const spouseId of index.spouseIds.get(id) ?? []) {
      if (!personIds.has(spouseId)) continue;
      const key = [id, spouseId].sort().join("::");
      if (drawnSpouses.has(key)) continue;
      drawnSpouses.add(key);
      links.push({
        id: `spouse-${key}`,
        sourceId: id,
        targetId: spouseId,
        kind: "spouse",
      });
    }
    for (const childId of index.childIds.get(id) ?? []) {
      if (!personIds.has(childId)) continue;
      links.push({
        id: `pc-${id}-${childId}`,
        sourceId: id,
        targetId: childId,
        kind: "parent-child",
      });
    }
  }

  return links;
}

function buildNearbyModel(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  const visible = new Set<string>([focusId]);
  uniquePush(visible, index.spouseIds.get(focusId) ?? []);
  uniquePush(visible, index.parentIds.get(focusId) ?? []);
  for (const parentId of index.parentIds.get(focusId) ?? []) {
    uniquePush(visible, index.spouseIds.get(parentId) ?? []);
  }
  uniquePush(visible, getDirectChildren(focusId, index));
  const siblings = getSiblingIds(focusId, index);
  uniquePush(visible, siblings);
  for (const siblingId of siblings) {
    uniquePush(visible, index.spouseIds.get(siblingId) ?? []);
  }

  const levels: FocusedGenerationLevel[] = [];
  const children = getDirectChildren(focusId, index);
  if (children.length > 0) {
    levels.push({
      rowIndex: 0,
      title: "Дети",
      units: children.map((childId) => ({
        id: `child-${childId}`,
        kind: "child" as const,
        personIds: [childId],
      })),
    });
  }

  const midUnits: FocusedFamilyUnit[] = [
    coupleUnit("focus", "focus-couple", focusId, index, visible),
    ...sortPersonIds(siblings, index).map((siblingId) =>
      coupleUnit(`sib-${siblingId}`, "sibling-couple", siblingId, index, visible),
    ),
  ];
  levels.push({
    rowIndex: levels.length,
    title: "Центр и братья/сёстры",
    units: midUnits,
  });

  const parents = sortPersonIds(
    (index.parentIds.get(focusId) ?? []).filter((id) => index.byId.has(id)),
    index,
  );
  if (parents.length > 0) {
    const parentPeople = new Set(parents);
    for (const parentId of parents) {
      uniquePush(parentPeople, index.spouseIds.get(parentId) ?? []);
    }
    levels.push({
      rowIndex: levels.length,
      title: "Родители",
      units: [
        {
          id: "parents",
          kind: "parent-couple" as const,
          personIds: sortPersonIds([...parentPeople].filter((id) => visible.has(id)), index),
        },
      ],
    });
  }

  return finalizeModel({
    focusId,
    scenario: "nearby",
    viewMode: "nearby",
    personIds: visible,
    levels,
    people,
    index,
  });
}

function buildAdultThree(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  const visible = new Set<string>([focusId]);
  uniquePush(visible, index.spouseIds.get(focusId) ?? []);
  const parents = sortPersonIds(
    (index.parentIds.get(focusId) ?? []).filter((id) => index.byId.has(id)),
    index,
  );
  uniquePush(visible, parents);
  for (const parentId of parents) {
    uniquePush(visible, index.spouseIds.get(parentId) ?? []);
  }
  const siblings = getSiblingIds(focusId, index);
  uniquePush(visible, siblings);
  for (const siblingId of siblings) {
    uniquePush(visible, index.spouseIds.get(siblingId) ?? []);
  }
  const children = getDirectChildren(focusId, index);
  uniquePush(visible, children);

  const levels: FocusedGenerationLevel[] = [
    {
      rowIndex: 0,
      title: "Дети",
      units: children.map((childId) => ({
        id: `child-${childId}`,
        kind: "child" as const,
        personIds: [childId],
      })),
    },
    {
      rowIndex: 1,
      title: "Центр и братья/сёстры",
      units: [
        coupleUnit("focus", "focus-couple", focusId, index, visible),
        ...sortPersonIds(siblings, index).map((siblingId) =>
          coupleUnit(
            `sib-${siblingId}`,
            "sibling-couple",
            siblingId,
            index,
            visible,
          ),
        ),
      ],
    },
    {
      rowIndex: 2,
      title: "Родители",
      units: [
        {
          id: "parents",
          kind: "parent-couple" as const,
          personIds: sortPersonIds(
            [...visible].filter((id) => {
              const gen = computeDirectedGenerations(focusId, index).get(id);
              return gen === -1;
            }),
            index,
          ),
        },
      ],
    },
  ].filter((level) => level.units.some((unit) => unit.personIds.length > 0));

  // Re-index rows
  levels.forEach((level, indexRow) => {
    level.rowIndex = indexRow;
  });

  return finalizeModel({
    focusId,
    scenario: "adult-three",
    viewMode: "generations",
    personIds: visible,
    levels,
    people,
    index,
  });
}

function buildElderThree(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  const visible = new Set<string>([focusId]);
  uniquePush(visible, index.spouseIds.get(focusId) ?? []);
  const children = getDirectChildren(focusId, index);
  uniquePush(visible, children);
  for (const childId of children) {
    uniquePush(visible, index.spouseIds.get(childId) ?? []);
  }
  const grandchildren = getDirectGrandchildren(focusId, index);
  uniquePush(visible, grandchildren);

  const childUnits: FocusedFamilyUnit[] = children.map((childId) =>
    coupleUnit(`child-${childId}`, "child-couple", childId, index, visible),
  );

  const grandchildUnits: FocusedFamilyUnit[] = [];
  for (const childId of children) {
    const kids = getDirectChildren(childId, index);
    for (const grandchildId of kids) {
      grandchildUnits.push({
        id: `gc-${grandchildId}`,
        kind: "grandchild",
        personIds: [grandchildId],
        parentUnitId: `child-${childId}`,
      });
    }
  }

  const levels: FocusedGenerationLevel[] = [
    {
      rowIndex: 0,
      title: "Внуки",
      units: grandchildUnits,
    },
    {
      rowIndex: 1,
      title: "Дети",
      units: childUnits,
    },
    {
      rowIndex: 2,
      title: "Центр",
      units: [coupleUnit("focus", "focus-couple", focusId, index, visible)],
    },
  ].filter((level) => level.units.some((unit) => unit.personIds.length > 0));

  levels.forEach((level, indexRow) => {
    level.rowIndex = indexRow;
  });

  return finalizeModel({
    focusId,
    scenario: "elder-three",
    viewMode: "generations",
    personIds: visible,
    levels,
    people,
    index,
  });
}

function buildChildThree(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  const visible = new Set<string>([focusId]);
  uniquePush(visible, index.spouseIds.get(focusId) ?? []);
  const siblings = getSiblingIds(focusId, index);
  uniquePush(visible, siblings);
  const parents = sortPersonIds(
    (index.parentIds.get(focusId) ?? []).filter((id) => index.byId.has(id)),
    index,
  );
  uniquePush(visible, parents);
  for (const parentId of parents) {
    uniquePush(visible, index.spouseIds.get(parentId) ?? []);
  }
  const grandparents = new Set<string>();
  for (const parentId of parents) {
    for (const gpId of index.parentIds.get(parentId) ?? []) {
      if (index.byId.has(gpId)) {
        grandparents.add(gpId);
        uniquePush(grandparents, index.spouseIds.get(gpId) ?? []);
      }
    }
  }
  uniquePush(visible, grandparents);

  const levels: FocusedGenerationLevel[] = [
    {
      rowIndex: 0,
      title: "Центр и братья/сёстры",
      units: [
        coupleUnit("focus", "focus-couple", focusId, index, visible),
        ...sortPersonIds(siblings, index).map((siblingId) =>
          coupleUnit(
            `sib-${siblingId}`,
            "sibling-couple",
            siblingId,
            index,
            visible,
          ),
        ),
      ],
    },
    {
      rowIndex: 1,
      title: "Родители",
      units: [
        {
          id: "parents",
          kind: "parent-couple" as const,
          personIds: sortPersonIds(
            parents.flatMap((parentId) => [
              parentId,
              ...(index.spouseIds.get(parentId) ?? []),
            ]).filter((id) => visible.has(id)),
            index,
          ),
        },
      ],
    },
    {
      rowIndex: 2,
      title: "Бабушки и дедушки",
      units: [
        {
          id: "grandparents",
          kind: "grandparent-couple" as const,
          personIds: sortPersonIds([...grandparents], index),
        },
      ],
    },
  ].filter((level) => level.units.some((unit) => unit.personIds.length > 0));

  levels.forEach((level, indexRow) => {
    level.rowIndex = indexRow;
  });

  return finalizeModel({
    focusId,
    scenario: "child-three",
    viewMode: "generations",
    personIds: visible,
    levels,
    people,
    index,
  });
}

function buildPartialThree(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  // Fall back to whatever exists: prefer nearby-like without inventing empty rows.
  return buildNearbyModel(focusId, index, people);
}

function buildBranchCards(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedBranchCard[] {
  const cards: FocusedBranchCard[] = [];
  const children = getDirectChildren(focusId, index);
  for (const childId of children) {
    const descendants = getDescendantIds(childId, index);
    const personIds = sortPersonIds([childId, ...descendants], index);
    const child = index.byId.get(childId);
    const title = child
      ? `Потомки ${child.firstName}`
      : "Потомки ребёнка";
    cards.push({
      id: `branch-child-${childId}`,
      title: `${title} · ${personIds.length} ${peopleWord(personIds.length)}`,
      rootPersonId: childId,
      personIds,
      peopleCount: personIds.length,
    });
  }

  for (const spouseId of index.spouseIds.get(focusId) ?? []) {
    const spouseParents = (index.parentIds.get(spouseId) ?? []).filter((id) =>
      index.byId.has(id),
    );
    if (spouseParents.length === 0) continue;
    const related = new Set<string>([spouseId, ...spouseParents]);
    for (const parentId of spouseParents) {
      uniquePush(related, getAncestorIds(parentId, index));
      uniquePush(related, getSiblingIds(parentId, index));
    }
    const personIds = sortPersonIds([...related], index);
    cards.push({
      id: `branch-spouse-${spouseId}`,
      title: `Род супруга · ${personIds.length} ${peopleWord(personIds.length)}`,
      rootPersonId: spouseId,
      personIds,
      peopleCount: personIds.length,
    });
  }

  const components = findConnectedComponents(people, index);
  const focusComponent =
    components.find((memberIds) => memberIds.includes(focusId)) ?? [];
  const focusSet = new Set(focusComponent);
  let detachedIndex = 0;
  for (const component of components) {
    if (component.includes(focusId)) continue;
    detachedIndex += 1;
    const rootId = component[0];
    cards.push({
      id: `detached-${detachedIndex}`,
      title: `Не связаны · ${component.length} ${peopleWord(component.length)}`,
      rootPersonId: rootId,
      personIds: sortPersonIds(component, index),
      peopleCount: component.length,
    });
  }

  void focusSet;
  return cards;
}

function buildBranchModel(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  const visible = new Set<string>([focusId]);
  uniquePush(visible, getAncestorIds(focusId, index));
  uniquePush(visible, getDescendantIds(focusId, index));
  uniquePush(visible, getSiblingIds(focusId, index));
  for (const id of [...visible]) {
    uniquePush(visible, index.spouseIds.get(id) ?? []);
  }

  // Direct line rows + collapsed side cards
  const children = getDirectChildren(focusId, index);
  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    index.byId.has(id),
  );
  const levels: FocusedGenerationLevel[] = [];
  if (children.length > 0) {
    levels.push({
      rowIndex: 0,
      title: "Дети",
      units: children.map((childId) =>
        coupleUnit(`child-${childId}`, "child-couple", childId, index, visible),
      ),
    });
  }
  levels.push({
    rowIndex: levels.length,
    title: "Центр",
    units: [
      coupleUnit("focus", "focus-couple", focusId, index, visible),
      ...getSiblingIds(focusId, index).map((siblingId) =>
        coupleUnit(`sib-${siblingId}`, "sibling-couple", siblingId, index, visible),
      ),
    ],
  });
  if (parents.length > 0) {
    levels.push({
      rowIndex: levels.length,
      title: "Родители",
      units: [
        {
          id: "parents",
          kind: "parent-couple" as const,
          personIds: sortPersonIds(
            parents.flatMap((parentId) => [
              parentId,
              ...(index.spouseIds.get(parentId) ?? []),
            ]).filter((id) => visible.has(id)),
            index,
          ),
        },
      ],
    });
  }

  const model = finalizeModel({
    focusId,
    scenario: "branch",
    viewMode: "branch",
    personIds: visible,
    levels,
    people,
    index,
  });
  model.branchCards = buildBranchCards(focusId, index, people).filter(
    (card) => !card.id.startsWith("detached-"),
  );
  return model;
}

function buildAllOverviewModel(
  focusId: string,
  index: PersonIndex,
  people: Person[],
): FocusedFamilyModel {
  // Layout uses branch-like main component; personIds = everyone (single source).
  const branch = buildBranchModel(focusId, index, people);
  const allIds = new Set(people.map((person) => person.id));
  const cards = buildBranchCards(focusId, index, people);
  return {
    ...branch,
    scenario: "all-overview",
    viewMode: "all",
    personIds: allIds,
    branchCards: cards,
  };
}

function finalizeModel(input: {
  focusId: string;
  scenario: FocusedFamilyScenario;
  viewMode: TreeViewMode;
  personIds: Set<string>;
  levels: FocusedGenerationLevel[];
  people: Person[];
  index: PersonIndex;
}): FocusedFamilyModel {
  const { focusId, scenario, viewMode, personIds, levels, people, index } =
    input;
  // Ensure focus always present
  personIds.add(focusId);

  const generations = computeDirectedGenerations(focusId, index);
  const relations = mapRelationsToFocus(focusId, people);
  // Trim relations to visible
  const visibleRelations = new Map<string, RelationToFocus>();
  for (const id of personIds) {
    visibleRelations.set(
      id,
      relations.get(id) ??
        resolveRelationToFocus({ focusId, personId: id, people }),
    );
  }

  return {
    focusId,
    scenario,
    viewMode,
    personIds,
    generations,
    relations: visibleRelations,
    levels,
    branchCards: [],
    softLinks: buildSoftLinks(personIds, index),
  };
}

export function buildFocusedFamilyModel(input: {
  focusId: string | null;
  people: Person[];
  viewMode: TreeViewMode;
}): FocusedFamilyModel {
  const { people, viewMode } = input;
  const index = buildPersonIndex(people);
  const focusId =
    input.focusId && index.byId.has(input.focusId)
      ? input.focusId
      : people[0]?.id ?? "";

  if (!focusId) {
    return {
      focusId: "",
      scenario: "partial",
      viewMode,
      personIds: new Set(),
      generations: new Map(),
      relations: new Map(),
      levels: [],
      branchCards: [],
      softLinks: [],
    };
  }

  const visibility = buildFamilyViewPersonIds({
    focusedPersonId: focusId,
    people,
  });
  const canonicalIds = selectFamilyViewIds(visibility, viewMode);

  let model: FocusedFamilyModel;
  if (viewMode === "nearby") {
    model = buildNearbyModel(focusId, index, people);
  } else if (viewMode === "branch") {
    model = buildBranchModel(focusId, index, people);
  } else if (viewMode === "all") {
    model = buildAllOverviewModel(focusId, index, people);
  } else {
    const scenario = detectThreeScenario(focusId, index);
    if (scenario === "adult-three") {
      model = buildAdultThree(focusId, index, people);
    } else if (scenario === "elder-three") {
      model = buildElderThree(focusId, index, people);
    } else if (scenario === "child-three") {
      model = buildChildThree(focusId, index, people);
    } else {
      model = buildPartialThree(focusId, index, people);
    }
  }

  // Single source of truth for who belongs to the mode.
  model.personIds = canonicalIds;
  return model;
}

/** Visible person ids for a view mode — shared by Tree and Scheme. */
export function getFocusedFamilyVisibleIds(input: {
  focusId: string | null;
  people: Person[];
  viewMode: TreeViewMode;
}): Set<string> {
  return selectFamilyViewIds(
    buildFamilyViewPersonIds({
      focusedPersonId: input.focusId,
      people: input.people,
    }),
    input.viewMode,
  );
}
