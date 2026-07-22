import {
  CURRENT_USER_ID,
  people as localPeople,
  relationships as localRelationships,
} from "@/data/family";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  CreateRelativePersonData,
  DbPerson,
  DbRelationship,
  DeletePersonResult,
  RelationKind,
  UpdatePersonInput,
} from "@/lib/supabase/types";
import {
  mapDbPeopleToPersons,
  mapDbRelationships,
} from "@/lib/family-mapper";
import type { FamilyRelationship, Person } from "@/types/family";

export type FamilyDataSource = "supabase" | "local";

export interface FamilyData {
  people: Person[];
  relationships: FamilyRelationship[];
  /**
   * Optional person in the tree linked to the signed-in account.
   * Empty when no such binding exists. Not the Auth user id, focus, or selection.
   * @deprecated Prefer linkedPersonId — kept for existing call sites.
   */
  currentUserId: string;
  /** Same as currentUserId; explicit name for the person↔account link. */
  linkedPersonId: string;
  source: FamilyDataSource;
}

export class FamilyDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilyDataError";
  }
}

function getLocalFamilyData(): FamilyData {
  const normalizedPeople = localPeople.map((person) => {
    const spouseIds =
      (person.spouseIds?.length ?? 0) > 0
        ? person.spouseIds!
        : person.spouseId
          ? [person.spouseId]
          : [];
    const spouseLinks =
      (person.spouseLinks?.length ?? 0) > 0
        ? person.spouseLinks!
        : spouseIds.map((spouseId) => ({
            spouseId,
            status: "current" as const,
            confidence: "confirmed" as const,
          }));
    const parentLinks =
      (person.parentLinks?.length ?? 0) > 0
        ? person.parentLinks!
        : person.parentIds.map((parentId) => ({
            parentId,
            kind: "biological" as const,
            confidence: "confirmed" as const,
          }));

    return {
      ...person,
      spouseIds,
      spouseLinks,
      parentLinks,
    };
  });

  const linkedPersonId =
    CURRENT_USER_ID &&
    normalizedPeople.some((person) => person.id === CURRENT_USER_ID)
      ? CURRENT_USER_ID
      : "";

  return {
    people: normalizedPeople,
    relationships: localRelationships,
    currentUserId: linkedPersonId,
    linkedPersonId,
    source: "local",
  };
}

export async function getPeople(): Promise<DbPerson[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError("Supabase is not configured");
  }

  const { data, error } = await client
    .from("people")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new FamilyDataError(error.message);
  }

  return data ?? [];
}

export async function getRelationships(): Promise<DbRelationship[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError("Supabase is not configured");
  }

  const { data, error } = await client
    .from("relationships")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new FamilyDataError(error.message);
  }

  return data ?? [];
}

/**
 * Loads family data from Supabase when configured.
 *
 * - Configured Supabase → only Supabase rows (empty DB stays empty; no local mix-in).
 * - Errors propagate (UI shows a clear error; no silent local fallback).
 * - Missing env → local demo data only in development; production requires env.
 */
export async function getFamilyData(): Promise<FamilyData> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new FamilyDataError(
        "Supabase не настроен. Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    return getLocalFamilyData();
  }

  const [dbPeople, dbRelationships] = await Promise.all([
    getPeople(),
    getRelationships(),
  ]);

  const relationships = mapDbRelationships(dbRelationships);
  /**
   * No hardcoded test account person (e.g. demid-tretyakov / 77777777…).
   * Tree center = focusedPersonId; Auth identity = AuthContext.user.id;
   * linkedPersonId stays empty until a real profile↔person binding exists.
   */
  const linkedPersonId = "";

  const people = mapDbPeopleToPersons(
    dbPeople,
    relationships,
    linkedPersonId,
  );

  return {
    people,
    relationships,
    currentUserId: linkedPersonId,
    linkedPersonId,
    source: "supabase",
  };
}

export interface CreateRelativeInput {
  referencePersonId: string;
  relationKind: RelationKind;
  personData: CreateRelativePersonData;
  secondParentId?: string | null;
}

export function mapRpcError(message: string, fallback: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("jwt") ||
    lower.includes("not authenticated") ||
    lower.includes("session")
  ) {
    return "Сессия истекла — войдите снова";
  }
  if (
    message.includes("администратор") ||
    message.includes("редактор") ||
    lower.includes("admin") ||
    lower.includes("editor")
  ) {
    return message.includes("Редактировать") ||
      message.includes("Удалять") ||
      message.includes("фотограф")
      ? message.replace(/^.*ERROR:\s*/i, "").split("\n")[0]
      : "Недостаточно прав";
  }

  const cleaned = message.replace(/^.*ERROR:\s*/i, "").split("\n")[0]?.trim();
  return cleaned || fallback;
}

export async function createRelative(
  input: CreateRelativeInput,
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError(
      "Добавление недоступно: используются локальные тестовые данные",
    );
  }

  const { data, error } = await client.rpc("create_relative", {
    reference_person_id: input.referencePersonId,
    relation_kind: input.relationKind,
    person_data: input.personData,
    second_parent_id: input.secondParentId ?? null,
  });

  if (error) {
    throw new FamilyDataError(
      mapRpcError(error.message, "Не удалось создать родственника"),
    );
  }

  if (!data || typeof data !== "string") {
    throw new FamilyDataError("Не удалось создать родственника");
  }

  return data;
}

export async function updatePerson(
  personId: string,
  personData: UpdatePersonInput,
): Promise<DbPerson> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError(
      "Редактирование недоступно: используются локальные тестовые данные",
    );
  }

  const { data, error } = await client.rpc("update_person", {
    target_person_id: personId,
    person_data: personData,
  });

  if (error) {
    throw new FamilyDataError(
      mapRpcError(error.message, "Не удалось сохранить данные"),
    );
  }

  if (!data || typeof data !== "object") {
    throw new FamilyDataError("Не удалось сохранить данные");
  }

  return data;
}

export async function deletePerson(
  personId: string,
): Promise<DeletePersonResult> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError(
      "Удаление недоступно: используются локальные тестовые данные",
    );
  }

  const { data, error } = await client.rpc("delete_person", {
    target_person_id: personId,
  });

  if (error) {
    throw new FamilyDataError(
      mapRpcError(error.message, "Не удалось удалить человека"),
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    typeof data.deleted_person_id !== "string" ||
    typeof data.deleted_relationships_count !== "number"
  ) {
    throw new FamilyDataError("Не удалось удалить человека");
  }

  return {
    deleted_person_id: data.deleted_person_id,
    deleted_relationships_count: data.deleted_relationships_count,
    deleted_photo_path:
      typeof data.deleted_photo_path === "string"
        ? data.deleted_photo_path
        : data.deleted_photo_path === null
          ? null
          : undefined,
  };
}

/** Picks a safe person to focus after deletion. */
export function pickSafeFocusPersonId(
  deleted: Person,
  remainingPeople: Person[],
): string | null {
  for (const parentId of deleted.parentIds) {
    if (remainingPeople.some((person) => person.id === parentId)) {
      return parentId;
    }
  }

  for (const childId of deleted.childIds) {
    if (remainingPeople.some((person) => person.id === childId)) {
      return childId;
    }
  }

  if (
    deleted.spouseId &&
    remainingPeople.some((person) => person.id === deleted.spouseId)
  ) {
    return deleted.spouseId;
  }

  return remainingPeople[0]?.id ?? null;
}
