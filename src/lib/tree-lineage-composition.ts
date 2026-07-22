import {
  pickPrimarySpouse,
  personSortKey,
  type PersonIndex,
} from "./botanical-tree-model";

export type TreeCenterComposition =
  | "single-with-parents"
  | "couple-with-lineages"
  | "single-with-descendants"
  | "isolated";

export type TreeLineageKey =
  | "focus"
  | "focus-lineage"
  | "spouse-lineage"
  | "parent-left-lineage"
  | "parent-right-lineage"
  | "descendant"
  | "collateral";

export type ParentPair = {
  leftParentId: string;
  rightParentId: string;
};

function comparePersonIds(a: string, b: string, index: PersonIndex): number {
  const pa = index.byId.get(a);
  const pb = index.byId.get(b);
  if (!pa || !pb) return a.localeCompare(b);
  return personSortKey(pa).join(":").localeCompare(personSortKey(pb).join(":"));
}

export function pickParentPair(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
): ParentPair | null {
  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    visibleIds.has(id),
  );
  if (parents.length === 0) return null;

  let leftId: string | null = null;
  let rightId: string | null = null;
  const unknownIds: string[] = [];

  for (const parentId of parents) {
    const parent = index.byId.get(parentId);
    if (!parent) continue;
    if (parent.gender === "male" && !leftId) {
      leftId = parentId;
    } else if (parent.gender === "female" && !rightId) {
      rightId = parentId;
    } else {
      unknownIds.push(parentId);
    }
  }

  for (const parentId of unknownIds) {
    if (!leftId) {
      leftId = parentId;
    } else if (!rightId) {
      rightId = parentId;
    }
  }

  if (parents.length === 1) {
    leftId = parents[0];
    rightId = parents[0];
  } else if (parents.length >= 2) {
    if (!leftId || !rightId) {
      const sorted = [...parents].sort((a, b) => comparePersonIds(a, b, index));
      leftId = sorted[0];
      rightId = sorted[1];
    }
  }

  if (!leftId || !rightId) return null;
  return { leftParentId: leftId, rightParentId: rightId };
}

export function detectTreeCenterComposition(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
): TreeCenterComposition {
  if (!index.byId.has(focusId)) return "isolated";

  const parents = (index.parentIds.get(focusId) ?? []).filter((id) =>
    visibleIds.has(id),
  );
  const children = (index.childIds.get(focusId) ?? []).filter((id) =>
    visibleIds.has(id),
  );
  const primarySpouse = pickPrimarySpouse(focusId, index);
  const hasSpouse =
    Boolean(primarySpouse) && visibleIds.has(primarySpouse as string);

  const sharedChildrenWithSpouse =
    hasSpouse &&
    children.some((childId) =>
      (index.parentIds.get(childId) ?? []).includes(primarySpouse as string),
    );

  const focusAsChildCenter =
    parents.length > 0 &&
    (!hasSpouse || (children.length === 0 && !sharedChildrenWithSpouse));

  if (hasSpouse && !focusAsChildCenter) {
    return "couple-with-lineages";
  }

  if (parents.length > 0) {
    return "single-with-parents";
  }

  if (children.length > 0) {
    return "single-with-descendants";
  }

  return "isolated";
}

export type AssignAncestorLineageInput = {
  rootParentId: string;
  lineageKey: TreeLineageKey;
  visibleIds: Set<string>;
  index: PersonIndex;
  lineageByPersonId: Map<string, TreeLineageKey>;
};

export function assignAncestorLineage(
  input: AssignAncestorLineageInput,
): void {
  const { rootParentId, lineageKey, visibleIds, index, lineageByPersonId } =
    input;

  const stack = [rootParentId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const personId = stack.pop()!;
    if (visited.has(personId)) continue;
    visited.add(personId);

    const existing = lineageByPersonId.get(personId);
    if (
      existing &&
      existing !== lineageKey &&
      isLineageSide(existing) &&
      isLineageSide(lineageKey) &&
      anchorSideForLineage(existing) !== anchorSideForLineage(lineageKey)
    ) {
      continue;
    }

    if (!existing) {
      lineageByPersonId.set(personId, lineageKey);
    }

    for (const parentId of index.parentIds.get(personId) ?? []) {
      if (!visibleIds.has(parentId) || visited.has(parentId)) continue;
      stack.push(parentId);
    }
  }
}

function isLineageSide(key: TreeLineageKey): boolean {
  return (
    key === "parent-left-lineage" ||
    key === "parent-right-lineage" ||
    key === "focus-lineage" ||
    key === "spouse-lineage"
  );
}

export function anchorSideForLineage(
  lineageKey: TreeLineageKey,
): "left" | "center" | "right" {
  switch (lineageKey) {
    case "parent-left-lineage":
    case "focus-lineage":
      return "left";
    case "parent-right-lineage":
    case "spouse-lineage":
      return "right";
    case "focus":
    case "descendant":
      return "center";
    case "collateral":
      return "left";
    default:
      return "center";
  }
}

export function buildLineageKeys(
  focusId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
  expandedCollateral: Set<string>,
  composition: TreeCenterComposition,
): Map<string, TreeLineageKey> {
  const lineageByPersonId = new Map<string, TreeLineageKey>();
  if (!index.byId.has(focusId)) return lineageByPersonId;

  lineageByPersonId.set(focusId, "focus");

  const primarySpouse = pickPrimarySpouse(focusId, index);

  if (composition === "single-with-parents") {
    const pair = pickParentPair(focusId, visibleIds, index);
    if (pair) {
      if (pair.leftParentId === pair.rightParentId) {
        lineageByPersonId.set(pair.leftParentId, "parent-left-lineage");
        assignAncestorLineage({
          rootParentId: pair.leftParentId,
          lineageKey: "parent-left-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      } else {
        lineageByPersonId.set(pair.leftParentId, "parent-left-lineage");
        lineageByPersonId.set(pair.rightParentId, "parent-right-lineage");
        assignAncestorLineage({
          rootParentId: pair.leftParentId,
          lineageKey: "parent-left-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
        assignAncestorLineage({
          rootParentId: pair.rightParentId,
          lineageKey: "parent-right-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      }
    }
  } else if (composition === "couple-with-lineages") {
    if (primarySpouse && visibleIds.has(primarySpouse)) {
      lineageByPersonId.set(primarySpouse, "focus");
      for (const parentId of index.parentIds.get(focusId) ?? []) {
        if (!visibleIds.has(parentId)) continue;
        lineageByPersonId.set(parentId, "focus-lineage");
        assignAncestorLineage({
          rootParentId: parentId,
          lineageKey: "focus-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      }
      for (const parentId of index.parentIds.get(primarySpouse) ?? []) {
        if (!visibleIds.has(parentId)) continue;
        lineageByPersonId.set(parentId, "spouse-lineage");
        assignAncestorLineage({
          rootParentId: parentId,
          lineageKey: "spouse-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      }
    }

    for (const childId of index.childIds.get(focusId) ?? []) {
      if (!visibleIds.has(childId)) continue;
      if (
        primarySpouse &&
        (index.parentIds.get(childId) ?? []).includes(primarySpouse)
      ) {
        lineageByPersonId.set(childId, "descendant");
        markDescendants(childId, visibleIds, index, lineageByPersonId);
      }
    }
    if (primarySpouse) {
      for (const childId of index.childIds.get(primarySpouse) ?? []) {
        if (!visibleIds.has(childId)) continue;
        if ((index.parentIds.get(childId) ?? []).includes(focusId)) {
          lineageByPersonId.set(childId, "descendant");
          markDescendants(childId, visibleIds, index, lineageByPersonId);
        }
      }
    }
  } else if (composition === "single-with-descendants") {
    for (const childId of index.childIds.get(focusId) ?? []) {
      if (!visibleIds.has(childId)) continue;
      lineageByPersonId.set(childId, "descendant");
      markDescendants(childId, visibleIds, index, lineageByPersonId);
    }
    const pair = pickParentPair(focusId, visibleIds, index);
    if (pair) {
      if (pair.leftParentId === pair.rightParentId) {
        lineageByPersonId.set(pair.leftParentId, "parent-left-lineage");
        assignAncestorLineage({
          rootParentId: pair.leftParentId,
          lineageKey: "parent-left-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      } else {
        lineageByPersonId.set(pair.leftParentId, "parent-left-lineage");
        lineageByPersonId.set(pair.rightParentId, "parent-right-lineage");
        assignAncestorLineage({
          rootParentId: pair.leftParentId,
          lineageKey: "parent-left-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
        assignAncestorLineage({
          rootParentId: pair.rightParentId,
          lineageKey: "parent-right-lineage",
          visibleIds,
          index,
          lineageByPersonId,
        });
      }
    }
  }

  for (const id of visibleIds) {
    if (lineageByPersonId.has(id)) continue;
    const person = index.byId.get(id);
    if (!person) continue;

    let assigned = false;
    for (const spouseId of index.spouseIds.get(id) ?? []) {
      const spouseLineage = lineageByPersonId.get(spouseId);
      if (!spouseLineage) continue;
      if (expandedCollateral.has(id)) {
        lineageByPersonId.set(id, spouseLineage);
        assignAncestorLineage({
          rootParentId: id,
          lineageKey: spouseLineage,
          visibleIds,
          index,
          lineageByPersonId,
        });
      } else if (spouseLineage === "focus") {
        lineageByPersonId.set(id, "focus");
      } else {
        lineageByPersonId.set(id, "collateral");
      }
      assigned = true;
      break;
    }
    if (!assigned) {
      lineageByPersonId.set(id, "collateral");
    }
  }

  return lineageByPersonId;
}

function markDescendants(
  rootId: string,
  visibleIds: Set<string>,
  index: PersonIndex,
  lineageByPersonId: Map<string, TreeLineageKey>,
): void {
  const stack = [...(index.childIds.get(rootId) ?? [])];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const childId = stack.pop()!;
    if (visited.has(childId) || !visibleIds.has(childId)) continue;
    visited.add(childId);
    if (!lineageByPersonId.has(childId)) {
      lineageByPersonId.set(childId, "descendant");
    }
    for (const next of index.childIds.get(childId) ?? []) {
      if (!visited.has(next)) stack.push(next);
    }
  }
}

export function lineageKeyToLegacySide(
  lineageKey: TreeLineageKey,
): "center" | "paternal" | "maternal" | "collateral" {
  switch (lineageKey) {
    case "parent-left-lineage":
    case "focus-lineage":
      return "paternal";
    case "parent-right-lineage":
    case "spouse-lineage":
      return "maternal";
    case "focus":
    case "descendant":
      return "center";
    case "collateral":
      return "collateral";
    default:
      return "collateral";
  }
}
