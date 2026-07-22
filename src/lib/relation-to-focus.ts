import {
  buildPersonIndex,
  getAncestorIds,
  getDescendantIds,
  getSiblingIds,
  type PersonIndex,
} from "./tree-visibility";
import type { ParentKind, Person } from "@/types/family";

export type RelationToFocusKind =
  | "center"
  | "spouse"
  | "father"
  | "mother"
  | "parent"
  | "son"
  | "daughter"
  | "child"
  | "brother"
  | "sister"
  | "half-brother"
  | "half-sister"
  | "grandfather"
  | "grandmother"
  | "grandson"
  | "granddaughter"
  | "step-father"
  | "step-mother"
  | "adoptive-parent"
  | "adopted-child"
  | "other"
  | "unknown";

export type RelationToFocus = {
  kind: RelationToFocusKind;
  /** Short UI label, e.g. «дочь», «внук». */
  label: string;
  /** Optional path of person ids from focus to target (inclusive). */
  pathIds: string[];
  /** Human-readable chain for profile, e.g. «Центр → дочь → внук». */
  chainLabel: string;
};

function genderWord(
  gender: Person["gender"] | undefined,
  male: string,
  female: string,
  neutral: string,
): string {
  if (gender === "male") return male;
  if (gender === "female") return female;
  return neutral;
}

function parentKindBetween(
  childId: string,
  parentId: string,
  index: PersonIndex,
): ParentKind | undefined {
  const child = index.byId.get(childId);
  const link = child?.parentLinks?.find((item) => item.parentId === parentId);
  return link?.kind;
}

function sharedParentCount(
  a: string,
  b: string,
  index: PersonIndex,
): number {
  const parentsA = new Set(index.parentIds.get(a) ?? []);
  let count = 0;
  for (const parentId of index.parentIds.get(b) ?? []) {
    if (parentsA.has(parentId)) count += 1;
  }
  return count;
}

function labelForKind(
  kind: RelationToFocusKind,
  person: Person | undefined,
): string {
  switch (kind) {
    case "center":
      return "центр";
    case "spouse":
      return genderWord(person?.gender, "супруг", "супруга", "супруг(а)");
    case "father":
      return "отец";
    case "mother":
      return "мать";
    case "parent":
      return "родитель";
    case "son":
      return "сын";
    case "daughter":
      return "дочь";
    case "child":
      return "ребёнок";
    case "brother":
      return "брат";
    case "sister":
      return "сестра";
    case "half-brother":
      return "сводный брат";
    case "half-sister":
      return "сводная сестра";
    case "grandfather":
      return "дедушка";
    case "grandmother":
      return "бабушка";
    case "grandson":
      return "внук";
    case "granddaughter":
      return "внучка";
    case "step-father":
      return "отчим";
    case "step-mother":
      return "мачеха";
    case "adoptive-parent":
      return "приёмный родитель";
    case "adopted-child":
      return "усыновлённый ребёнок";
    case "other":
      return "родственник";
    case "unknown":
    default:
      return "связь не определена";
  }
}

function chainFromKinds(kinds: RelationToFocusKind[], people: Person[]): string {
  if (kinds.length === 0) return "связь не определена";
  if (kinds[0] === "center" && kinds.length === 1) return "центр";
  const parts = ["Центр"];
  for (let i = 1; i < kinds.length; i += 1) {
    parts.push(labelForKind(kinds[i], people[i]));
  }
  return parts.join(" → ");
}

/**
 * Relation of `personId` relative to `focusId`.
 * Generation uses directed parent/child edges only.
 */
export function resolveRelationToFocus(input: {
  focusId: string;
  personId: string;
  people: Person[];
}): RelationToFocus {
  const { focusId, personId, people } = input;
  const index = buildPersonIndex(people);
  const person = index.byId.get(personId);

  if (!index.byId.has(focusId) || !person) {
    return {
      kind: "unknown",
      label: "связь не определена",
      pathIds: [],
      chainLabel: "связь не определена",
    };
  }

  if (personId === focusId) {
    return {
      kind: "center",
      label: "центр",
      pathIds: [focusId],
      chainLabel: "центр",
    };
  }

  const focusSpouses = new Set(index.spouseIds.get(focusId) ?? []);
  if (focusSpouses.has(personId)) {
    return {
      kind: "spouse",
      label: labelForKind("spouse", person),
      pathIds: [focusId, personId],
      chainLabel: `Центр → ${labelForKind("spouse", person)}`,
    };
  }

  const focusParents = index.parentIds.get(focusId) ?? [];
  if (focusParents.includes(personId)) {
    const kind = parentKindBetween(focusId, personId, index);
    if (kind === "step") {
      const stepKind =
        person.gender === "female" ? "step-mother" : "step-father";
      return {
        kind: stepKind,
        label: labelForKind(stepKind, person),
        pathIds: [focusId, personId],
        chainLabel: `Центр → ${labelForKind(stepKind, person)}`,
      };
    }
    if (kind === "adoptive") {
      return {
        kind: "adoptive-parent",
        label: labelForKind("adoptive-parent", person),
        pathIds: [focusId, personId],
        chainLabel: `Центр → ${labelForKind("adoptive-parent", person)}`,
      };
    }
    const parentKind =
      person.gender === "male"
        ? "father"
        : person.gender === "female"
          ? "mother"
          : "parent";
    return {
      kind: parentKind,
      label: labelForKind(parentKind, person),
      pathIds: [focusId, personId],
      chainLabel: `Центр → ${labelForKind(parentKind, person)}`,
    };
  }

  const focusChildren = index.childIds.get(focusId) ?? [];
  if (focusChildren.includes(personId)) {
    const kind = parentKindBetween(personId, focusId, index);
    if (kind === "adoptive") {
      return {
        kind: "adopted-child",
        label: labelForKind("adopted-child", person),
        pathIds: [focusId, personId],
        chainLabel: `Центр → ${labelForKind("adopted-child", person)}`,
      };
    }
    const childKind =
      person.gender === "male"
        ? "son"
        : person.gender === "female"
          ? "daughter"
          : "child";
    return {
      kind: childKind,
      label: labelForKind(childKind, person),
      pathIds: [focusId, personId],
      chainLabel: `Центр → ${labelForKind(childKind, person)}`,
    };
  }

  const siblings = getSiblingIds(focusId, index);
  if (siblings.includes(personId)) {
    const shared = sharedParentCount(focusId, personId, index);
    const half = shared === 1;
    const siblingKind =
      person.gender === "male"
        ? half
          ? "half-brother"
          : "brother"
        : person.gender === "female"
          ? half
            ? "half-sister"
            : "sister"
          : half
            ? "half-brother"
            : "brother";
    return {
      kind: siblingKind,
      label: labelForKind(siblingKind, person),
      pathIds: [focusId, personId],
      chainLabel: `Центр → ${labelForKind(siblingKind, person)}`,
    };
  }

  // Grandparents
  for (const parentId of focusParents) {
    const grandparents = index.parentIds.get(parentId) ?? [];
    if (grandparents.includes(personId)) {
      const gpKind =
        person.gender === "female" ? "grandmother" : "grandfather";
      return {
        kind: gpKind,
        label: labelForKind(gpKind, person),
        pathIds: [focusId, parentId, personId],
        chainLabel: chainFromKinds(
          [
            "center",
            index.byId.get(parentId)?.gender === "female" ? "mother" : "father",
            gpKind,
          ],
          [index.byId.get(focusId)!, index.byId.get(parentId)!, person],
        ),
      };
    }
  }

  // Grandchildren via each child
  for (const childId of focusChildren) {
    const grandchildren = index.childIds.get(childId) ?? [];
    if (grandchildren.includes(personId)) {
      const gcKind =
        person.gender === "female" ? "granddaughter" : "grandson";
      const child = index.byId.get(childId);
      const via = child
        ? genderWord(child.gender, "сын", "дочь", "ребёнок")
        : "ребёнок";
      return {
        kind: gcKind,
        label: labelForKind(gcKind, person),
        pathIds: [focusId, childId, personId],
        chainLabel: `Центр → ${via} → ${labelForKind(gcKind, person)}`,
      };
    }
  }

  // Spouse of a direct child (невестка / зять)
  for (const childId of focusChildren) {
    if ((index.spouseIds.get(childId) ?? []).includes(personId)) {
      const child = index.byId.get(childId);
      const viaChild = child
        ? genderWord(child.gender, "сына", "дочери", "ребёнка")
        : "ребёнка";
      const label = genderWord(
        person.gender,
        `супруг ${viaChild}`,
        `супруга ${viaChild}`,
        `супруг(а) ${viaChild}`,
      );
      return {
        kind: "other",
        label,
        pathIds: [focusId, childId, personId],
        chainLabel: `Центр → ${child ? genderWord(child.gender, "сын", "дочь", "ребёнок") : "ребёнок"} → ${label}`,
      };
    }
  }

  // Spouse of grandchild
  for (const childId of focusChildren) {
    for (const grandchildId of index.childIds.get(childId) ?? []) {
      if ((index.spouseIds.get(grandchildId) ?? []).includes(personId)) {
        const label = genderWord(
          person.gender,
          "супруг внука/внучки",
          "супруга внука/внучки",
          "супруг(а) внука/внучки",
        );
        return {
          kind: "other",
          label,
          pathIds: [focusId, childId, grandchildId, personId],
          chainLabel: `Центр → ребёнок → внук/внучка → ${label}`,
        };
      }
    }
  }

  // Spouse of parent / child (compact other)
  for (const parentId of focusParents) {
    if ((index.spouseIds.get(parentId) ?? []).includes(personId)) {
      return {
        kind: "other",
        label: "супруг родителя",
        pathIds: [focusId, parentId, personId],
        chainLabel: "Центр → родитель → супруг(а)",
      };
    }
  }

  const ancestors = getAncestorIds(focusId, index);
  if (ancestors.has(personId)) {
    return {
      kind: "other",
      label: "предок",
      pathIds: [focusId, personId],
      chainLabel: "Центр → предок",
    };
  }

  const descendants = getDescendantIds(focusId, index);
  if (descendants.has(personId)) {
    return {
      kind: "other",
      label: "потомок",
      pathIds: [focusId, personId],
      chainLabel: "Центр → потомок",
    };
  }

  return {
    kind: "unknown",
    label: "связь не определена",
    pathIds: [],
    chainLabel: "связь не определена",
  };
}

export function mapRelationsToFocus(
  focusId: string,
  people: Person[],
): Map<string, RelationToFocus> {
  const map = new Map<string, RelationToFocus>();
  for (const person of people) {
    map.set(
      person.id,
      resolveRelationToFocus({ focusId, personId: person.id, people }),
    );
  }
  return map;
}
