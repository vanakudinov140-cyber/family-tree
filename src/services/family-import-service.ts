import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { parseFamilyImportJson } from "@/lib/family-import-schema";
import type {
  FamilyBackupFile,
  FamilyImportBatchResult,
  FamilyImportPayload,
  FamilyImportValidationResult,
} from "@/types/family-import";

export class FamilyImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilyImportError";
  }
}

function requireClient() {
  if (!isSupabaseConfigured()) {
    throw new FamilyImportError("Supabase не настроен");
  }
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyImportError("Не удалось создать клиент Supabase");
  }
  return client;
}

function asIssueArray(value: unknown): FamilyImportValidationResult["errors"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      code: typeof row.code === "string" ? row.code : "unknown",
      message:
        typeof row.message === "string" ? row.message : "Неизвестная ошибка",
      key: typeof row.key === "string" ? row.key : undefined,
    };
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeValidationResult(
  raw: Record<string, unknown>,
): FamilyImportValidationResult {
  return {
    valid: Boolean(raw.valid),
    errors: asIssueArray(raw.errors),
    warnings: asIssueArray(raw.warnings),
    newPeopleCount: Number(raw.newPeopleCount ?? 0),
    existingPeopleCount: Number(raw.existingPeopleCount ?? 0),
    newRelationshipsCount: Number(raw.newRelationshipsCount ?? 0),
    existingRelationshipsCount: Number(raw.existingRelationshipsCount ?? 0),
    unresolvedKeys: asStringArray(raw.unresolvedKeys),
    duplicateKeys: asStringArray(raw.duplicateKeys),
    reviewRequiredCount: Number(raw.reviewRequiredCount ?? 0),
  };
}

function normalizeBatchResult(
  raw: Record<string, unknown>,
): FamilyImportBatchResult {
  const asKeyed = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        key: typeof row.key === "string" ? row.key : "",
        id: typeof row.id === "string" ? row.id : undefined,
        reason: typeof row.reason === "string" ? row.reason : undefined,
      };
    });
  };

  return {
    insertedPeople: asKeyed(raw.insertedPeople).map((row) => ({
      key: row.key,
      id: row.id ?? "",
    })),
    skippedPeople: asKeyed(raw.skippedPeople).map((row) => ({
      key: row.key,
      id: row.id,
      reason: row.reason ?? "skipped",
    })),
    insertedRelationships: asKeyed(raw.insertedRelationships).map((row) => ({
      key: row.key,
    })),
    skippedRelationships: asKeyed(raw.skippedRelationships).map((row) => ({
      key: row.key,
      reason: row.reason ?? "skipped",
    })),
    warnings: asIssueArray(raw.warnings),
    importedPersonIds: asStringArray(raw.importedPersonIds),
    mode: "insert_only",
  };
}

/** Strip fields that must never be accepted from import payloads. */
export function sanitizeImportPayload(
  payload: FamilyImportPayload,
): FamilyImportPayload {
  return {
    version: 1,
    familyName: payload.familyName,
    people: payload.people.map((person) => ({
      key: person.key,
      firstName: person.firstName,
      middleName: person.middleName ?? null,
      lastName: person.lastName ?? null,
      maidenName: person.maidenName ?? null,
      gender: person.gender,
      birthDate: person.birthDate ?? null,
      birthYear: person.birthYear ?? null,
      deathDate: person.deathDate ?? null,
      deathYear: person.deathYear ?? null,
      birthPlace: person.birthPlace ?? null,
      biography: person.biography ?? null,
      isLiving: person.isLiving,
      dataStatus: person.dataStatus ?? "confirmed",
      notes: person.notes ?? null,
    })),
    relationships: payload.relationships.map((relationship) => ({
      key: relationship.key,
      type: relationship.type,
      person1Key: relationship.person1Key,
      person2Key: relationship.person2Key,
      parentKind: relationship.parentKind ?? null,
      spouseStatus: relationship.spouseStatus ?? null,
      confidence: relationship.confidence ?? "confirmed",
      notes: relationship.notes ?? null,
    })),
  };
}

export async function validateFamilyImport(
  payload: FamilyImportPayload,
): Promise<FamilyImportValidationResult> {
  const client = requireClient();
  const safePayload = sanitizeImportPayload(payload);

  const { data, error } = await client.rpc("validate_family_import", {
    payload: safePayload,
  });

  if (error) {
    throw new FamilyImportError(error.message);
  }

  return normalizeValidationResult(
    (data ?? {}) as Record<string, unknown>,
  );
}

export async function importFamilyBatch(
  payload: FamilyImportPayload,
): Promise<FamilyImportBatchResult> {
  const client = requireClient();
  const safePayload = sanitizeImportPayload(payload);

  const { data, error } = await client.rpc("import_family_batch", {
    payload: safePayload,
  });

  if (error) {
    throw new FamilyImportError(error.message);
  }

  return normalizeBatchResult((data ?? {}) as Record<string, unknown>);
}

export function parseImportText(raw: string): FamilyImportPayload {
  return sanitizeImportPayload(parseFamilyImportJson(raw));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildBackupFilename(date = new Date()): string {
  return `family-tree-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}.json`;
}

export async function downloadFamilyBackup(): Promise<void> {
  const client = requireClient();

  const [peopleResult, relationshipsResult] = await Promise.all([
    client
      .from("people")
      .select(
        "id, first_name, middle_name, last_name, maiden_name, gender, birth_date, birth_year, death_date, death_year, birth_place, biography, is_living, external_key, data_status, notes, photo_path, photo_updated_at, created_at, updated_at",
      )
      .order("created_at", { ascending: true }),
    client
      .from("relationships")
      .select(
        "id, person1_id, person2_id, relationship_type, parent_kind, spouse_status, confidence, external_key, notes, created_at",
      )
      .order("created_at", { ascending: true }),
  ]);

  if (peopleResult.error) {
    throw new FamilyImportError(peopleResult.error.message);
  }
  if (relationshipsResult.error) {
    throw new FamilyImportError(relationshipsResult.error.message);
  }

  const backup: FamilyBackupFile = {
    version: 1,
    schemaVersion: 5,
    exportedAt: new Date().toISOString(),
    // photo_path is metadata only — image binaries are NOT included in this JSON.
    notes:
      "Backup includes people.photo_path as Storage path metadata only. Signed URLs and image files are not exported.",
    people: peopleResult.data ?? [],
    relationships: relationshipsResult.data ?? [],
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildBackupFilename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
