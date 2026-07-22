import type { FamilyImportBatchResult, FamilyImportValidationResult } from "@/types/family-import";
import type { FamilyGraphStats } from "./family-graph-stats";

export type ImportPipelineCounts = {
  parsedPeopleCount: number;
  parsedRelationshipsCount: number;
  validPeopleCount: number;
  validRelationshipsCount: number;
  payloadPeopleCount: number;
  payloadRelationshipsCount: number;
  createdPeopleCount: number;
  createdRelationshipsCount: number;
  existingPeopleCount: number;
  skippedRelationshipsCount: number;
};

export type ImportOutcomeSummary = {
  headline: string;
  details: string[];
  isFullSuccess: boolean;
  warningNoRelationships: boolean;
};

export function buildImportPipelineCounts(input: {
  parsedPeopleCount: number;
  parsedRelationshipsCount: number;
  validation: FamilyImportValidationResult | null;
  payloadPeopleCount: number;
  payloadRelationshipsCount: number;
  batch: FamilyImportBatchResult | null;
}): ImportPipelineCounts {
  return {
    parsedPeopleCount: input.parsedPeopleCount,
    parsedRelationshipsCount: input.parsedRelationshipsCount,
    validPeopleCount: input.validation?.newPeopleCount ?? 0,
    validRelationshipsCount: input.validation?.newRelationshipsCount ?? 0,
    payloadPeopleCount: input.payloadPeopleCount,
    payloadRelationshipsCount: input.payloadRelationshipsCount,
    createdPeopleCount: input.batch?.insertedPeople.length ?? 0,
    createdRelationshipsCount: input.batch?.insertedRelationships.length ?? 0,
    existingPeopleCount: input.validation?.existingPeopleCount ?? 0,
    skippedRelationshipsCount: input.batch?.skippedRelationships.length ?? 0,
  };
}

export function buildImportOutcomeSummary(
  counts: ImportPipelineCounts,
  persisted: FamilyGraphStats | null,
): ImportOutcomeSummary {
  const details: string[] = [
    `Прочитано записей: ${counts.parsedPeopleCount}`,
    `Готово к импорту: ${counts.validPeopleCount} людей, ${counts.validRelationshipsCount} связей`,
    `Добавлено людей: ${counts.createdPeopleCount}`,
    `Добавлено связей: ${counts.createdRelationshipsCount}`,
  ];

  if (persisted) {
    details.push(
      `В базе после обновления: ${persisted.peopleLoaded} людей, ${persisted.relationshipsLoaded} связей`,
    );
    details.push(`Связных компонент: ${persisted.connectedComponents}`);
  }

  const warningNoRelationships =
    counts.createdPeopleCount > 0 && counts.createdRelationshipsCount === 0;

  if (counts.createdPeopleCount === 0 && counts.createdRelationshipsCount === 0) {
    if (counts.existingPeopleCount > 0) {
      return {
        headline: "Новые люди не добавлены: записи уже присутствуют",
        details,
        isFullSuccess: false,
        warningNoRelationships: false,
      };
    }
    return {
      headline: "Ни одна запись не была добавлена",
      details,
      isFullSuccess: false,
      warningNoRelationships: false,
    };
  }

  if (warningNoRelationships) {
    return {
      headline: `Добавлено людей: ${counts.createdPeopleCount}. Родственные связи не созданы`,
      details: [
        ...details,
        "Люди импортированы, но родственные связи не были созданы — проверьте person1Key/person2Key в файле.",
      ],
      isFullSuccess: false,
      warningNoRelationships: true,
    };
  }

  return {
    headline: `Добавлено людей: ${counts.createdPeopleCount}, связей: ${counts.createdRelationshipsCount}`,
    details,
    isFullSuccess: true,
    warningNoRelationships: false,
  };
}

export function logImportPipelineTable(
  counts: ImportPipelineCounts,
  persisted: FamilyGraphStats | null,
  visiblePeople: number,
  focusedComponentSize: number,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.table({
    peopleLoaded: persisted?.peopleLoaded ?? 0,
    relationshipsLoaded: persisted?.relationshipsLoaded ?? 0,
    visiblePeople,
    connectedComponents: persisted?.connectedComponents ?? 0,
    focusedComponentSize,
    parsedPeopleCount: counts.parsedPeopleCount,
    payloadPeopleCount: counts.payloadPeopleCount,
    createdPeopleCount: counts.createdPeopleCount,
    createdRelationshipsCount: counts.createdRelationshipsCount,
  });
}
