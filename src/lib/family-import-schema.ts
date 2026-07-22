import { familyImportPayloadSchema } from "@/types/family-import";
import type { FamilyImportPayload } from "@/types/family-import";

export { familyImportPayloadSchema };

export function parseFamilyImportJson(raw: string): FamilyImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Некорректный JSON");
  }

  const result = familyImportPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(first?.message ?? "Файл не соответствует формату импорта");
  }

  return result.data;
}
