import { z } from "zod";

export const familyImportPersonSchema = z.object({
  key: z.string().trim().min(1, "key обязателен"),
  firstName: z.string().trim().min(1, "Имя обязательно"),
  middleName: z.string().trim().nullable().optional(),
  lastName: z.string().trim().nullable().optional(),
  maidenName: z.string().trim().nullable().optional(),
  gender: z.enum(["male", "female", "other", "unknown"]),
  birthDate: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  deathDate: z.string().nullable().optional(),
  deathYear: z.number().int().nullable().optional(),
  birthPlace: z.string().trim().nullable().optional(),
  biography: z.string().trim().nullable().optional(),
  isLiving: z.boolean().optional(),
  dataStatus: z
    .enum(["confirmed", "needs_review", "test"])
    .optional()
    .default("confirmed"),
  notes: z.string().trim().nullable().optional(),
});

export const familyImportRelationshipSchema = z
  .object({
    key: z.string().trim().min(1, "key обязателен"),
    type: z.enum(["parent", "spouse"]),
    person1Key: z.string().trim().min(1),
    person2Key: z.string().trim().min(1),
    parentKind: z
      .enum(["biological", "adoptive", "step", "guardian"])
      .nullable()
      .optional(),
    spouseStatus: z.enum(["current", "former", "unknown"]).nullable().optional(),
    confidence: z
      .enum(["confirmed", "probable", "uncertain"])
      .optional()
      .default("confirmed"),
    notes: z.string().trim().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "parent" && !value.parentKind) {
      ctx.addIssue({
        code: "custom",
        message: "Для parent нужен parentKind",
        path: ["parentKind"],
      });
    }
    if (value.type === "spouse" && !value.spouseStatus) {
      ctx.addIssue({
        code: "custom",
        message: "Для spouse нужен spouseStatus",
        path: ["spouseStatus"],
      });
    }
    if (value.type === "parent" && value.spouseStatus) {
      ctx.addIssue({
        code: "custom",
        message: "spouseStatus недопустим для parent",
        path: ["spouseStatus"],
      });
    }
    if (value.type === "spouse" && value.parentKind) {
      ctx.addIssue({
        code: "custom",
        message: "parentKind недопустим для spouse",
        path: ["parentKind"],
      });
    }
    if (value.person1Key === value.person2Key) {
      ctx.addIssue({
        code: "custom",
        message: "Нельзя связать человека с самим собой",
        path: ["person2Key"],
      });
    }
  });

export const familyImportPayloadSchema = z.object({
  version: z.literal(1),
  familyName: z.string().trim().min(1).optional(),
  people: z.array(familyImportPersonSchema).min(1),
  relationships: z.array(familyImportRelationshipSchema).default([]),
});

export type FamilyImportPayload = z.infer<typeof familyImportPayloadSchema>;
export type FamilyImportPerson = z.infer<typeof familyImportPersonSchema>;
export type FamilyImportRelationship = z.infer<
  typeof familyImportRelationshipSchema
>;

export interface FamilyImportIssue {
  code: string;
  message: string;
  key?: string;
}

export interface FamilyImportValidationResult {
  valid: boolean;
  errors: FamilyImportIssue[];
  warnings: FamilyImportIssue[];
  newPeopleCount: number;
  existingPeopleCount: number;
  newRelationshipsCount: number;
  existingRelationshipsCount: number;
  unresolvedKeys: string[];
  duplicateKeys: string[];
  reviewRequiredCount: number;
}

export interface FamilyImportBatchResult {
  insertedPeople: Array<{ key: string; id: string }>;
  skippedPeople: Array<{ key: string; id?: string; reason: string }>;
  insertedRelationships: Array<{ key: string }>;
  skippedRelationships: Array<{ key: string; reason: string }>;
  warnings: FamilyImportIssue[];
  importedPersonIds: string[];
  mode: "insert_only";
}

export interface FamilyBackupFile {
  version: 1;
  schemaVersion: 4 | 5;
  exportedAt: string;
  /** Clarifies that photo binaries / signed URLs are not in the JSON. */
  notes?: string;
  people: unknown[];
  relationships: unknown[];
}
