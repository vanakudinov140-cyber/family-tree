import type { DbPerson, DbRelationship } from "@/lib/supabase/types";
import type {
  Confidence,
  FamilyRelationship,
  ParentKind,
  Person,
  SpouseStatus,
} from "@/types/family";

function asParentKind(value: string | null | undefined): ParentKind {
  if (
    value === "biological" ||
    value === "adoptive" ||
    value === "step" ||
    value === "guardian"
  ) {
    return value;
  }
  return "biological";
}

function asSpouseStatus(value: string | null | undefined): SpouseStatus {
  if (value === "current" || value === "former" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function asConfidence(value: string | null | undefined): Confidence {
  if (value === "confirmed" || value === "probable" || value === "uncertain") {
    return value;
  }
  return "confirmed";
}

export function mapDbRelationships(
  rows: DbRelationship[],
): FamilyRelationship[] {
  return rows.map((row) => {
    if (row.relationship_type === "spouse") {
      return {
        id: row.id,
        type: "spouse" as const,
        sourceId: row.person1_id,
        targetId: row.person2_id,
        spouseStatus: asSpouseStatus(row.spouse_status),
        confidence: asConfidence(row.confidence),
      };
    }

    return {
      id: row.id,
      type: "parent-child" as const,
      sourceId: row.person1_id,
      targetId: row.person2_id,
      parentKind: asParentKind(row.parent_kind),
      confidence: asConfidence(row.confidence),
    };
  });
}

export function mapDbPeopleToPersons(
  rows: DbPerson[],
  relationships: FamilyRelationship[],
  currentUserId: string,
): Person[] {
  const parentLinksByChild = new Map<
    string,
    Array<{ parentId: string; kind: ParentKind; confidence: Confidence }>
  >();
  const childIdsByParent = new Map<string, string[]>();
  const spouseLinksByPerson = new Map<
    string,
    Array<{ spouseId: string; status: SpouseStatus; confidence: Confidence }>
  >();

  for (const relationship of relationships) {
    if (relationship.type === "parent-child") {
      const parents = parentLinksByChild.get(relationship.targetId) ?? [];
      parents.push({
        parentId: relationship.sourceId,
        kind: relationship.parentKind ?? "biological",
        confidence: relationship.confidence ?? "confirmed",
      });
      parentLinksByChild.set(relationship.targetId, parents);

      const children = childIdsByParent.get(relationship.sourceId) ?? [];
      children.push(relationship.targetId);
      childIdsByParent.set(relationship.sourceId, children);
      continue;
    }

    const status = relationship.spouseStatus ?? "unknown";
    const confidence = relationship.confidence ?? "confirmed";

    const left = spouseLinksByPerson.get(relationship.sourceId) ?? [];
    left.push({
      spouseId: relationship.targetId,
      status,
      confidence,
    });
    spouseLinksByPerson.set(relationship.sourceId, left);

    const right = spouseLinksByPerson.get(relationship.targetId) ?? [];
    right.push({
      spouseId: relationship.sourceId,
      status,
      confidence,
    });
    spouseLinksByPerson.set(relationship.targetId, right);
  }

  const genderById = new Map(
    rows.map((row) => [row.id, row.gender ?? null] as const),
  );

  return rows.map((row) => {
    const parentLinks = parentLinksByChild.get(row.id) ?? [];
    const parentIds = parentLinks.map((link) => link.parentId);
    const childIds = childIdsByParent.get(row.id) ?? [];
    const spouseLinks = spouseLinksByPerson.get(row.id) ?? [];
    const spouseIds = spouseLinks.map((link) => link.spouseId);

    const primarySpouse =
      spouseLinks.find((link) => link.status === "current") ??
      spouseLinks.find((link) => link.status === "unknown") ??
      spouseLinks[0];

    return {
      id: row.id,
      firstName: row.first_name,
      middleName: row.middle_name ?? undefined,
      lastName: row.last_name?.trim() ?? "",
      maidenName: row.maiden_name ?? undefined,
      gender:
        row.gender === "male" ||
        row.gender === "female" ||
        row.gender === "other" ||
        row.gender === "unknown"
          ? row.gender
          : undefined,
      birthDate: row.birth_date ?? undefined,
      birthYear: row.birth_year ?? undefined,
      deathDate: row.death_date ?? undefined,
      deathYear: row.death_year ?? undefined,
      birthPlace: row.birth_place ?? undefined,
      biography: row.biography ?? undefined,
      isLiving: row.is_living ?? undefined,
      dataStatus:
        row.data_status === "confirmed" ||
        row.data_status === "needs_review" ||
        row.data_status === "test"
          ? row.data_status
          : "confirmed",
      notes: row.notes ?? undefined,
      photoPath: row.photo_path ?? null,
      photoUpdatedAt: row.photo_updated_at ?? null,
      // Legacy photo_url is not used for private Storage display.
      photoUrl: undefined,
      parentIds,
      parentLinks,
      spouseId: primarySpouse?.spouseId,
      spouseIds,
      spouseLinks,
      childIds,
      isCurrentUser: row.id === currentUserId,
      externalKey: row.external_key ?? undefined,
      relationshipLabel: resolveRelationshipLabel({
        personId: row.id,
        gender: genderById.get(row.id) ?? null,
        parentIds,
        currentUserId,
        parentIdsByChild: new Map(
          [...parentLinksByChild.entries()].map(([childId, links]) => [
            childId,
            links.map((link) => link.parentId),
          ]),
        ),
        spouseByPerson: new Map(
          [...spouseLinksByPerson.entries()].map(([id, links]) => [
            id,
            (links.find((link) => link.status === "current") ?? links[0])
              ?.spouseId ?? "",
          ]),
        ),
        genderById,
      }),
    };
  });
}

function resolveRelationshipLabel(input: {
  personId: string;
  gender: string | null;
  parentIds: string[];
  currentUserId: string;
  parentIdsByChild: Map<string, string[]>;
  spouseByPerson: Map<string, string>;
  genderById: Map<string, string | null>;
}): string {
  const {
    personId,
    gender,
    parentIds,
    currentUserId,
    parentIdsByChild,
    spouseByPerson,
    genderById,
  } = input;

  if (personId === currentUserId) {
    return "Это вы";
  }

  const currentParents = parentIdsByChild.get(currentUserId) ?? [];
  if (currentParents.includes(personId)) {
    return gender === "female" ? "Мать" : "Отец";
  }

  const currentSpouse = spouseByPerson.get(currentUserId);
  if (currentSpouse === personId) {
    return gender === "female" ? "Супруга" : "Супруг";
  }

  for (const parentId of currentParents) {
    const grandparents = parentIdsByChild.get(parentId) ?? [];
    if (grandparents.includes(personId)) {
      return gender === "female" ? "Прабабушка" : "Прадед";
    }
  }

  for (const parentId of currentParents) {
    const grandparents = parentIdsByChild.get(parentId) ?? [];
    if (grandparents.length === 0) {
      continue;
    }

    const sharesGrandparent = parentIds.some((parentOfPerson) =>
      grandparents.includes(parentOfPerson),
    );
    if (sharesGrandparent && personId !== parentId) {
      return gender === "female" ? "Тётя" : "Дядя";
    }
  }

  void genderById;
  return "Родственник";
}
