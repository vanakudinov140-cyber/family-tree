"use client";

import type { FamilyImportBatchResult } from "@/types/family-import";
import type { ImportPipelineCounts } from "@/lib/family-import-outcome";

interface FamilyImportReportProps {
  report: FamilyImportBatchResult;
  importCounts: ImportPipelineCounts | null;
  outcomeHeadline: string | null;
}

export function FamilyImportReport({
  report,
  importCounts,
  outcomeHeadline,
}: FamilyImportReportProps) {
  const tone =
    importCounts &&
    importCounts.createdPeopleCount === 0 &&
    importCounts.createdRelationshipsCount === 0
      ? "warn"
      : importCounts?.createdPeopleCount &&
          importCounts.createdRelationshipsCount === 0
        ? "warn"
        : "success";

  const boxClass =
    tone === "warn"
      ? "rounded-xl border border-[#E8D4A8] bg-[#FFF6E8] px-3 py-2 text-sm text-[#7A5A1E]"
      : "space-y-3 rounded-xl border border-[#D9E8D4] bg-[#F6FBF4] px-3 py-2 text-sm text-[#2D4A3E]";

  return (
    <div className={boxClass}>
      {outcomeHeadline ? (
        <p className="font-medium text-[#1B4332]">{outcomeHeadline}</p>
      ) : null}

      {importCounts ? (
        <ul className="mt-2 space-y-1">
          <li>Прочитано записей: {importCounts.parsedPeopleCount}</li>
          <li>
            Готово к импорту: {importCounts.validPeopleCount} людей,{" "}
            {importCounts.validRelationshipsCount} связей
          </li>
          <li>Добавлено людей: {importCounts.createdPeopleCount}</li>
          <li>Добавлено связей: {importCounts.createdRelationshipsCount}</li>
          <li>Пропущено людей: {report.skippedPeople.length}</li>
          <li>Пропущено связей: {report.skippedRelationships.length}</li>
        </ul>
      ) : null}

      {importCounts &&
      importCounts.createdPeopleCount > 0 &&
      importCounts.createdRelationshipsCount === 0 ? (
        <p className="mt-2 text-[#7A5A1E]">
          Люди импортированы, но родственные связи не были созданы. Проверьте
          person1Key и person2Key в файле.
        </p>
      ) : null}

      {report.skippedRelationships.length > 0 ? (
        <div>
          <p className="mt-2 font-medium">Пропущенные связи</p>
          <ul className="list-disc pl-5">
            {report.skippedRelationships.slice(0, 5).map((item) => (
              <li key={item.key}>
                {item.key}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length > 0 ? (
        <div>
          <p className="mb-1 mt-2 font-medium text-[#7A5A1E]">Предупреждения</p>
          <ul className="list-disc space-y-1 pl-5 text-[#7A5A1E]">
            {report.warnings.map((issue, index) => (
              <li key={`w-${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
