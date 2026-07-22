import { z } from "zod";

import type { ProposalType } from "@/types/family-proposal";

const uuidSchema = z.string().uuid();
const shortText = z.string().trim().max(2000).nullable().optional();
const biographyText = z.string().trim().max(10000).nullable().optional();

export const personUpdateChangesSchema = z
  .object({
    firstName: z.string().trim().min(1).max(200).optional(),
    middleName: z.string().trim().max(200).nullable().optional(),
    lastName: z.string().trim().max(200).nullable().optional(),
    maidenName: z.string().trim().max(200).nullable().optional(),
    birthDate: z.string().nullable().optional(),
    birthYear: z.number().int().min(1000).max(2100).nullable().optional(),
    deathDate: z.string().nullable().optional(),
    deathYear: z.number().int().min(1000).max(2100).nullable().optional(),
    birthPlace: z.string().trim().max(500).nullable().optional(),
    biography: biographyText,
    isLiving: z.boolean().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const personUpdatePayloadSchema = z
  .object({
    changes: personUpdateChangesSchema.refine(
      (value) => Object.keys(value).length > 0,
      "Укажите хотя бы одно изменение",
    ),
  })
  .strict();

export const personCreatePersonSchema = z
  .object({
    firstName: z.string().trim().min(1).max(200),
    middleName: z.string().trim().max(200).nullable().optional(),
    lastName: z.string().trim().max(200).nullable().optional(),
    maidenName: z.string().trim().max(200).nullable().optional(),
    gender: z.enum(["male", "female", "other", "unknown"]),
    birthDate: z.string().nullable().optional(),
    birthYear: z.number().int().min(1000).max(2100).nullable().optional(),
    deathDate: z.string().nullable().optional(),
    deathYear: z.number().int().min(1000).max(2100).nullable().optional(),
    birthPlace: z.string().trim().max(500).nullable().optional(),
    biography: biographyText,
    isLiving: z.boolean().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const personCreateRelationSchema = z
  .object({
    anchorPersonId: uuidSchema,
    type: z.enum(["parent", "child", "spouse"]),
    parentKind: z
      .enum(["biological", "adoptive", "step", "guardian"])
      .nullable()
      .optional(),
    spouseStatus: z.enum(["current", "former", "unknown"]).nullable().optional(),
    confidence: z
      .enum(["confirmed", "probable", "uncertain"])
      .optional()
      .default("confirmed"),
  })
  .strict();

export const personCreatePayloadSchema = z
  .object({
    person: personCreatePersonSchema,
    relation: personCreateRelationSchema,
  })
  .strict();

export const relationshipCreatePayloadSchema = z
  .object({
    person1Id: uuidSchema,
    person2Id: uuidSchema,
    relationshipType: z.enum(["parent", "spouse"]),
    parentKind: z
      .enum(["biological", "adoptive", "step", "guardian"])
      .nullable()
      .optional(),
    spouseStatus: z.enum(["current", "former", "unknown"]).nullable().optional(),
    confidence: z
      .enum(["confirmed", "probable", "uncertain"])
      .optional()
      .default("confirmed"),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((value) => value.person1Id !== value.person2Id, {
    message: "Нельзя связать человека с самим собой",
    path: ["person2Id"],
  });

export const relationshipUpdateChangesSchema = z
  .object({
    person1Id: uuidSchema.optional(),
    person2Id: uuidSchema.optional(),
    parentKind: z
      .enum(["biological", "adoptive", "step", "guardian"])
      .nullable()
      .optional(),
    spouseStatus: z.enum(["current", "former", "unknown"]).nullable().optional(),
    confidence: z.enum(["confirmed", "probable", "uncertain"]).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Укажите хотя бы одно изменение",
  });

export const relationshipUpdatePayloadSchema = z
  .object({
    relationshipId: uuidSchema,
    changes: relationshipUpdateChangesSchema,
  })
  .strict();

const proposalPhotoPathRegex =
  /^proposals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$/i;

export const photoReplacePayloadSchema = z
  .object({
    proposalPhotoPath: z
      .string()
      .regex(proposalPhotoPathRegex, "Некорректный путь предложенной фотографии"),
  })
  .strict();

export const proposalReasonSchema = z.string().trim().max(2000).nullable().optional();
export const proposalSourceNoteSchema = z.string().trim().max(2000).nullable().optional();

export function parseProposalPayload(
  proposalType: ProposalType,
  payload: unknown,
) {
  switch (proposalType) {
    case "person_update":
      return personUpdatePayloadSchema.parse(payload);
    case "person_create":
      return personCreatePayloadSchema.parse(payload);
    case "relationship_create":
      return relationshipCreatePayloadSchema.parse(payload);
    case "relationship_update":
      return relationshipUpdatePayloadSchema.parse(payload);
    case "photo_replace":
      return photoReplacePayloadSchema.parse(payload);
    default:
      throw new Error("Неподдерживаемый тип предложения");
  }
}

export function createProposalPhotoPath(userId: string, extension: "webp" | "jpg"): string {
  const fileId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ext = extension;
  return `proposals/${userId}/${fileId}.${ext}`;
}

export function isValidProposalPhotoPath(path: string, userId?: string): boolean {
  if (!proposalPhotoPathRegex.test(path)) {
    return false;
  }
  if (userId) {
    const folder = path.split("/")[1]?.toLowerCase();
    return folder === userId.toLowerCase();
  }
  return true;
}
