import {
  buildGenerationsForVisible,
  computeBotanicalDisplayIds,
  countHiddenCollateralLineage,
  isCentralCoupleMember,
  personSortKey,
  pickPrimarySpouse,
  type BotanicalDisplayLevel,
  type LineageSide,
  buildPersonIndex,
  type PersonIndex,
} from "./botanical-tree-model";
import {
  anchorSideForLineage,
  buildLineageKeys,
  detectTreeCenterComposition,
  lineageKeyToLegacySide,
  type TreeCenterComposition,
  type TreeLineageKey,
} from "./tree-lineage-composition";
import {
  type TreeAssetVariant,
} from "./tree-asset-config";
import {
  DEFAULT_TREE_NODE_DIMENSIONS,
  DEFAULT_TREE_SAFE_BOUNDS,
  resolveTreeNodeCollisions,
  type TreeNodePlacement,
} from "./tree-node-collision";
import type { TreeViewMode } from "./tree-visibility";
import type { TreeAnchor } from "@/types/tree-anchor";
import type { Person } from "@/types/family";

export type { TreeCenterComposition, TreeLineageKey };

export type PersonAnchorAssignment = {
  personId: string;
  anchorId: string;
  anchor: TreeAnchor;
  generation: number;
  side: LineageSide;
  lineageKey: TreeLineageKey;
  composition: TreeCenterComposition;
  isCentral: boolean;
  isSpouse: boolean;
  displayLevel: BotanicalDisplayLevel;
  /** Optional post-collision label side. */
  labelPlacement?: "top" | "bottom";
};

export type TreeOverflowGroup = {
  id: string;
  personIds: string[];
  generation: number;
  side: LineageSide;
  lineageKey: TreeLineageKey;
  x: number;
  y: number;
};

export type AssignPeopleToTreeAnchorsInput = {
  people: Person[];
  focusedPersonId: string | null;
  visiblePersonIds: Set<string>;
  anchors: TreeAnchor[];
  expandedCollateral?: Set<string>;
  /** When set, run collision resolution in image pixel space. */
  collision?: {
    renderedWidth: number;
    renderedHeight: number;
    viewMode?: TreeViewMode;
  };
};

export type AssignPeopleToTreeAnchorsResult = {
  assignments: PersonAnchorAssignment[];
  overflowGroups: TreeOverflowGroup[];
  hiddenCollateralCount: number;
  suggestedVariant: TreeAssetVariant | null;
  composition: TreeCenterComposition;
};

function buildProtectedPersonIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  const protectedIds = new Set<string>([focusId]);

  const addWithSpouses = (personId: string) => {
    protectedIds.add(personId);
    for (const spouseId of index.spouseIds.get(personId) ?? []) {
      protectedIds.add(spouseId);
    }
  };

  for (const parentId of index.parentIds.get(focusId) ?? []) {
    addWithSpouses(parentId);
    for (const grandparentId of index.parentIds.get(parentId) ?? []) {
      addWithSpouses(grandparentId);
    }
  }

  for (const childId of index.childIds.get(focusId) ?? []) {
    addWithSpouses(childId);
    for (const grandchildId of index.childIds.get(childId) ?? []) {
      protectedIds.add(grandchildId);
    }
  }

  for (const spouseId of index.spouseIds.get(focusId) ?? []) {
    protectedIds.add(spouseId);
  }

  return protectedIds;
}

function applyCollisionResolution(input: {
  assignments: PersonAnchorAssignment[];
  overflowGroups: TreeOverflowGroup[];
  focusId: string;
  index: PersonIndex;
  renderedWidth: number;
  renderedHeight: number;
  viewMode: TreeViewMode;
}): {
  assignments: PersonAnchorAssignment[];
  overflowGroups: TreeOverflowGroup[];
} {
  const {
    assignments,
    overflowGroups,
    focusId,
    index,
    renderedWidth,
    renderedHeight,
    viewMode,
  } = input;

  if (assignments.length === 0) {
    return { assignments, overflowGroups };
  }

  const protectedIds = buildProtectedPersonIds(focusId, index);
  const placements: TreeNodePlacement[] = assignments.map((assignment) => ({
    personId: assignment.personId,
    x: assignment.anchor.x,
    y: assignment.anchor.y,
    generation: assignment.generation,
    lineageKey: assignment.lineageKey,
    isFocused: assignment.isCentral,
    protected: protectedIds.has(assignment.personId),
  }));

  const lineageByPersonId = new Map(
    assignments.map((assignment) => [
      assignment.personId,
      assignment.lineageKey,
    ] as const),
  );

  const resolved = resolveTreeNodeCollisions({
    placements,
    treeBounds: DEFAULT_TREE_SAFE_BOUNDS,
    viewMode,
    nodeDimensions: DEFAULT_TREE_NODE_DIMENSIONS,
    renderedWidth,
    renderedHeight,
    lineageByPersonId,
  });

  const resolvedById = new Map(
    resolved.placements.map((placement) => [placement.personId, placement]),
  );
  const overflowSet = new Set(resolved.overflowPersonIds);

  const nextAssignments: PersonAnchorAssignment[] = [];
  const extraOverflow = new Map<string, string[]>();

  for (const assignment of assignments) {
    if (overflowSet.has(assignment.personId) && !protectedIds.has(assignment.personId)) {
      const key = `${assignment.generation}:${assignment.lineageKey}`;
      const list = extraOverflow.get(key) ?? [];
      list.push(assignment.personId);
      extraOverflow.set(key, list);
      continue;
    }

    const placement = resolvedById.get(assignment.personId);
    if (!placement) {
      nextAssignments.push(assignment);
      continue;
    }

    nextAssignments.push({
      ...assignment,
      anchor: {
        ...assignment.anchor,
        x: placement.x,
        y: placement.y,
      },
      labelPlacement: placement.labelPlacement,
    });
  }

  const nextOverflow = [...overflowGroups];
  for (const [key, personIds] of extraOverflow) {
    const separator = key.indexOf(":");
    const generation = Number(key.slice(0, separator));
    const lineageKey = key.slice(separator + 1) as TreeLineageKey;
    const side = lineageKeyToLegacySide(lineageKey);
    const existing = nextOverflow.find(
      (group) =>
        group.generation === generation && group.lineageKey === lineageKey,
    );
    if (existing) {
      existing.personIds = [...new Set([...existing.personIds, ...personIds])];
      continue;
    }
    nextOverflow.push({
      id: `overflow-collision-${key}`,
      personIds,
      generation,
      side,
      lineageKey,
      x: lineageKey.includes("right") || lineageKey === "spouse-lineage" ? 0.88 : 0.12,
      y: clampGenerationY(generation),
    });
  }

  return { assignments: nextAssignments, overflowGroups: nextOverflow };
}

function clampGenerationY(generation: number): number {
  if (generation <= -2) return 0.78;
  if (generation === -1) return 0.62;
  if (generation === 0) return 0.48;
  if (generation === 1) return 0.32;
  return 0.18;
}

function lineageOrder(lineageKey: TreeLineageKey): number {
  switch (lineageKey) {
    case "focus":
      return 0;
    case "descendant":
      return 1;
    case "parent-left-lineage":
    case "focus-lineage":
      return 2;
    case "parent-right-lineage":
    case "spouse-lineage":
      return 3;
    case "collateral":
      return 4;
    default:
      return 5;
  }
}

function comparePersonIds(
  a: string,
  b: string,
  index: PersonIndex,
): number {
  const pa = index.byId.get(a);
  const pb = index.byId.get(b);
  if (!pa || !pb) return a.localeCompare(b);
  return personSortKey(pa).join(":").localeCompare(personSortKey(pb).join(":"));
}

function sortPeopleForAssignment(
  personIds: string[],
  focusId: string,
  generations: Map<string, number>,
  lineageKeys: Map<string, TreeLineageKey>,
  index: PersonIndex,
): string[] {
  const primarySpouse = pickPrimarySpouse(focusId, index);
  return [...personIds].sort((a, b) => {
    const ga = generations.get(a) ?? 0;
    const gb = generations.get(b) ?? 0;
    if (ga !== gb) return ga - gb;

    const aIsFocus = a === focusId ? -2 : 0;
    const bIsFocus = b === focusId ? -2 : 0;
    if (aIsFocus !== bIsFocus) return aIsFocus - bIsFocus;

    const aIsSpouse = a === primarySpouse ? -1 : 0;
    const bIsSpouse = b === primarySpouse ? -1 : 0;
    if (aIsSpouse !== bIsSpouse) return aIsSpouse - bIsSpouse;

    const lineageDiff =
      lineageOrder(lineageKeys.get(a) ?? "collateral") -
      lineageOrder(lineageKeys.get(b) ?? "collateral");
    if (lineageDiff !== 0) return lineageDiff;

    return comparePersonIds(a, b, index);
  });
}

function anchorMatchesLineage(
  anchor: TreeAnchor,
  lineageKey: TreeLineageKey,
): boolean {
  const requiredSide = anchorSideForLineage(lineageKey);
  if (lineageKey === "collateral") {
    return anchor.side === "left" || anchor.side === "right";
  }
  return anchor.side === requiredSide;
}

function pickAnchor(
  personId: string,
  generation: number,
  lineageKey: TreeLineageKey,
  composition: TreeCenterComposition,
  anchors: TreeAnchor[],
  usedAnchorIds: Set<string>,
  focusId: string,
  index: PersonIndex,
): TreeAnchor | null {
  const primarySpouse = pickPrimarySpouse(focusId, index);

  const candidates = anchors
    .filter((anchor) => {
      if (anchor.generation !== generation) return false;
      if (usedAnchorIds.has(anchor.id)) return false;
      return anchorMatchesLineage(anchor, lineageKey);
    })
    .sort((a, b) => a.branchId.localeCompare(b.branchId) || a.id.localeCompare(b.id));

  if (personId === focusId) {
    if (
      composition === "single-with-parents" ||
      composition === "single-with-descendants"
    ) {
      const upper = candidates.find(
        (anchor) => anchor.pairGroup === "single-focus-upper",
      );
      if (upper) return upper;
      return (
        candidates.find(
          (anchor) => anchor.side === "center" && anchor.y <= 0.42,
        ) ??
        candidates.find((anchor) => anchor.side === "center") ??
        null
      );
    }

    if (composition === "couple-with-lineages") {
      const coupleLeft = candidates.find(
        (anchor) => anchor.pairGroup === "central-couple-left",
      );
      if (coupleLeft) return coupleLeft;
    }

    const center = candidates.find((anchor) => anchor.side === "center");
    if (center) return center;
    return candidates[0] ?? null;
  }

  if (primarySpouse && personId === primarySpouse && composition === "couple-with-lineages") {
    const coupleRight = candidates.find(
      (anchor) => anchor.pairGroup === "central-couple-right",
    );
    if (coupleRight) return coupleRight;
    const paired = candidates.find(
      (anchor) =>
        anchor.pairGroup === "central-couple-left" ||
        anchor.pairGroup === "central-couple-right",
    );
    if (paired) return paired;
  }

  for (const spouseId of index.spouseIds.get(personId) ?? []) {
    const usedBySpouse = [...usedAnchorIds].find((anchorId) => {
      const anchor = anchors.find((item) => item.id === anchorId);
      return Boolean(anchor?.pairGroup);
    });
    if (usedBySpouse) {
      const spouseAnchor = anchors.find((item) => item.id === usedBySpouse);
      if (spouseAnchor?.pairGroup) {
        const pairMate = candidates.find(
          (anchor) =>
            anchor.pairGroup === spouseAnchor.pairGroup &&
            anchor.id !== spouseAnchor.id,
        );
        if (pairMate) return pairMate;
      }
    }
  }

  if (lineageKey === "descendant") {
    const upper = [...candidates].sort((a, b) => a.y - b.y);
    return upper[0] ?? null;
  }

  if (
    lineageKey === "parent-left-lineage" ||
    lineageKey === "focus-lineage"
  ) {
    return [...candidates].sort((a, b) => a.x - b.x)[0] ?? null;
  }

  if (
    lineageKey === "parent-right-lineage" ||
    lineageKey === "spouse-lineage"
  ) {
    return [...candidates].sort((a, b) => b.x - a.x)[0] ?? null;
  }

  return candidates[0] ?? null;
}

function overflowPosition(
  generation: number,
  lineageKey: TreeLineageKey,
  anchors: TreeAnchor[],
): { x: number; y: number } {
  const anchorSide = anchorSideForLineage(lineageKey);
  const sameGen = anchors.filter((anchor) => anchor.generation === generation);

  const filtered = sameGen.filter((anchor) => {
    if (lineageKey === "collateral") {
      return anchor.side === "left" || anchor.side === "right";
    }
    return anchor.side === anchorSide;
  });

  if (filtered.length === 0) {
    const fallbackY =
      sameGen.length > 0
        ? sameGen.reduce((sum, anchor) => sum + anchor.y, 0) /
          Math.max(sameGen.length, 1)
        : 0.82;
    if (anchorSide === "left") {
      return { x: 0.12, y: fallbackY };
    }
    if (anchorSide === "right") {
      return { x: 0.88, y: fallbackY };
    }
    return { x: 0.5, y: fallbackY };
  }

  const xBase =
    filtered.reduce((sum, anchor) => sum + anchor.x, 0) /
    Math.max(filtered.length, 1);
  const y =
    filtered.reduce((sum, anchor) => sum + anchor.y, 0) /
    Math.max(filtered.length, 1);

  const xOffset =
    anchorSide === "left" ? -0.04 : anchorSide === "right" ? 0.04 : 0.02;
  const x = Math.min(0.95, Math.max(0.05, xBase + xOffset));

  return { x, y };
}

export function logTreeAnchorDebugTable(
  assignments: PersonAnchorAssignment[],
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.table(
    assignments.map((item) => ({
      personId: item.personId,
      generation: item.generation,
      lineageKey: item.lineageKey,
      anchorId: item.anchorId,
      anchorSide: item.anchor.side,
    })),
  );
}

export function assignPeopleToTreeAnchors(
  input: AssignPeopleToTreeAnchorsInput,
): AssignPeopleToTreeAnchorsResult {
  const {
    people,
    focusedPersonId,
    visiblePersonIds,
    anchors,
    expandedCollateral = new Set(),
    collision,
  } = input;

  const index = buildPersonIndex(people);
  const effectiveFocus =
    focusedPersonId && index.byId.has(focusedPersonId)
      ? focusedPersonId
      : people[0]?.id ?? "";

  if (!effectiveFocus) {
    return {
      assignments: [],
      overflowGroups: [],
      hiddenCollateralCount: 0,
      suggestedVariant: null,
      composition: "isolated",
    };
  }

  const displayIds = computeBotanicalDisplayIds(
    effectiveFocus,
    visiblePersonIds,
    index,
    expandedCollateral,
  );
  const generations = buildGenerationsForVisible(
    effectiveFocus,
    displayIds,
    index,
  );
  const composition = detectTreeCenterComposition(
    effectiveFocus,
    displayIds,
    index,
  );
  const lineageKeys = buildLineageKeys(
    effectiveFocus,
    displayIds,
    index,
    expandedCollateral,
    composition,
  );

  const sortedIds = sortPeopleForAssignment(
    [...displayIds],
    effectiveFocus,
    generations,
    lineageKeys,
    index,
  );

  const usedAnchorIds = new Set<string>();
  const assignments: PersonAnchorAssignment[] = [];
  const overflowByKey = new Map<string, string[]>();

  for (const personId of sortedIds) {
    const generation = generations.get(personId) ?? 0;
    const lineageKey = lineageKeys.get(personId) ?? "collateral";
    const side = lineageKeyToLegacySide(lineageKey);
    const anchor = pickAnchor(
      personId,
      generation,
      lineageKey,
      composition,
      anchors,
      usedAnchorIds,
      effectiveFocus,
      index,
    );

    if (!anchor) {
      const key = `${generation}:${lineageKey}`;
      const list = overflowByKey.get(key) ?? [];
      list.push(personId);
      overflowByKey.set(key, list);
      continue;
    }

    usedAnchorIds.add(anchor.id);
    assignments.push({
      personId,
      anchorId: anchor.id,
      anchor,
      generation,
      side,
      lineageKey,
      composition,
      isCentral: personId === effectiveFocus,
      isSpouse: (index.spouseIds.get(effectiveFocus) ?? []).includes(personId),
      displayLevel: isCentralCoupleMember(effectiveFocus, personId, index)
        ? personId === effectiveFocus
          ? "central"
          : "primary"
        : "normal",
    });
  }

  const overflowGroups: TreeOverflowGroup[] = [];
  for (const [key, personIds] of overflowByKey) {
    const separator = key.indexOf(":");
    const generation = Number(key.slice(0, separator));
    const lineageKey = key.slice(separator + 1) as TreeLineageKey;
    const side = lineageKeyToLegacySide(lineageKey);
    const position = overflowPosition(generation, lineageKey, anchors);
    overflowGroups.push({
      id: `overflow-${key}`,
      personIds,
      generation,
      side,
      lineageKey,
      x: position.x,
      y: position.y,
    });
  }

  let finalAssignments = assignments;
  let finalOverflow = overflowGroups;

  if (collision) {
    const resolved = applyCollisionResolution({
      assignments,
      overflowGroups,
      focusId: effectiveFocus,
      index,
      renderedWidth: collision.renderedWidth,
      renderedHeight: collision.renderedHeight,
      viewMode: collision.viewMode ?? "all",
    });
    finalAssignments = resolved.assignments;
    finalOverflow = resolved.overflowGroups;
  }

  let hiddenCollateralCount = 0;
  for (const id of visiblePersonIds) {
    if (displayIds.has(id)) continue;
    hiddenCollateralCount += countHiddenCollateralLineage(
      id,
      visiblePersonIds,
      index,
      displayIds,
    );
  }

  return {
    assignments: finalAssignments,
    overflowGroups: finalOverflow,
    hiddenCollateralCount,
    suggestedVariant: finalOverflow.length > 0 ? "wide" : null,
    composition,
  };
}

export function validateAnchorCoordinates(anchors: TreeAnchor[]): boolean {
  return anchors.every(
    (anchor) =>
      Number.isFinite(anchor.x) &&
      Number.isFinite(anchor.y) &&
      anchor.x >= 0 &&
      anchor.x <= 1 &&
      anchor.y >= 0 &&
      anchor.y <= 1,
  );
}
