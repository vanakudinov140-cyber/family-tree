import { findConnectedComponents } from "./botanical-tree-model";
import {
  buildPersonIndex,
  getVisiblePersonIds,
  type TreeViewMode,
} from "./tree-visibility";
import type { Person } from "@/types/family";

export type FamilyGraphStats = {
  peopleLoaded: number;
  relationshipsLoaded: number;
  connectedComponents: number;
  focusedComponentSize: number;
  isolatedPeopleCount: number;
};

export function computeFamilyGraphStats(
  people: Person[],
  relationshipsCount: number,
  focusId: string | null,
): FamilyGraphStats {
  const index = buildPersonIndex(people);
  const components = findConnectedComponents(people, index);
  const focusComponent = focusId
    ? components.find((component) => component.includes(focusId))
    : undefined;

  const largest = components[0]?.length ?? 0;
  const isolatedPeopleCount = components.filter(
    (component) => component.length === 1,
  ).length;

  return {
    peopleLoaded: people.length,
    relationshipsLoaded: relationshipsCount,
    connectedComponents: components.length,
    focusedComponentSize: focusComponent?.length ?? largest,
    isolatedPeopleCount,
  };
}

export function isPersonVisibleInMode(
  personId: string,
  mode: TreeViewMode,
  focusId: string | null,
  people: Person[],
): boolean {
  if (mode === "all") return true;
  if (!focusId) return false;
  const visible = getVisiblePersonIds({
    mode,
    focusId,
    people,
    collapsedPersonIds: new Set(),
  });
  return visible.has(personId);
}
