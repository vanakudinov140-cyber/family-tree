import type { Edge } from "@xyflow/react";

import type { PersonIndex } from "@/lib/tree-visibility";
import { getAncestorIds, getDescendantIds } from "@/lib/tree-visibility";

/** Direct ancestors only (parents upward), no depth limit. */
export function getAncestorPathIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  return getAncestorIds(focusId, index);
}

/** Direct descendants only (children downward), no depth limit. */
export function getDescendantPathIds(
  focusId: string,
  index: PersonIndex,
): Set<string> {
  return getDescendantIds(focusId, index);
}

/**
 * Focused lineage for heritage dimming:
 * focus + ancestors + descendants + spouses of those people.
 * Does not include cousins or sibling branches.
 */
export function getFocusedFamilyPersonIds(
  focusId: string | null,
  index: PersonIndex,
): Set<string> | null {
  if (!focusId || !index.byId.has(focusId)) {
    return null;
  }

  const result = new Set<string>([focusId]);
  for (const id of getAncestorPathIds(focusId, index)) {
    result.add(id);
  }
  for (const id of getDescendantPathIds(focusId, index)) {
    result.add(id);
  }

  const core = [...result];
  for (const personId of core) {
    for (const spouseId of index.spouseIds.get(personId) ?? []) {
      result.add(spouseId);
    }
  }

  return result;
}

/** Edge is on the focused path if ≥2 related people are on the lineage, or it touches focus. */
export function getFocusedFamilyRelationshipIds(
  focusId: string | null,
  edges: Edge[],
  focusedPeople: Set<string> | null,
): Set<string> | null {
  if (!focusId || !focusedPeople) {
    return null;
  }

  const result = new Set<string>();
  for (const edge of edges) {
    const related =
      (edge.data as { relatedIds?: string[] } | undefined)?.relatedIds ?? [];
    if (related.includes(focusId)) {
      result.add(edge.id);
      continue;
    }
    const overlap = related.filter((id) => focusedPeople.has(id)).length;
    if (overlap >= 2) {
      result.add(edge.id);
    }
  }
  return result;
}

export function isPersonOnFocusedPath(
  personId: string,
  focusedPeople: Set<string> | null,
): boolean {
  if (!focusedPeople) return true;
  return focusedPeople.has(personId);
}
