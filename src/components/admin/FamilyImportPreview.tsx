"use client";

import type { ReactNode } from "react";

import type { ParsedImportFile } from "@/lib/family-import-file";
import type { FamilyImportValidationResult } from "@/types/family-import";

interface FamilyImportPreviewProps {
  validation: FamilyImportValidationResult | null;
  nameMatches: string[];
  fileMeta?: ParsedImportFile | null;
}

export function FamilyImportPreview({
  validation,
  nameMatches,
  fileMeta,
}: FamilyImportPreviewProps) {
  if (!validation) {
    return (
      <p className="text-sm text-[#6B776F]">
        {fileMeta
          ? `Файл «${fileMeta.fileName}» прочитан (${fileMeta.peopleCount} записей). Нажмите «Проверить файл» или дождитесь проверки.`
          : "Загрузите JSON и нажмите «Проверить файл», чтобы увидеть предварительный просмотр."}
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm text-[#2D4A3E]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Новые люди" value={validation.newPeopleCount} />
        <Stat label="Уже есть" value={validation.existingPeopleCount} />
        <Stat label="Новые связи" value={validation.newRelationshipsCount} />
        <Stat
          label="Связи уже есть"
          value={validation.existingRelationshipsCount}
        />
      </div>

      <p className="text-xs text-[#5C6B63]">
        На проверку: {validation.reviewRequiredCount}. Режим импорта:
        insert_only (существующие по external_key не изменяются).
      </p>

      {validation.errors.length > 0 ? (
        <Section title="Ошибки" tone="error">
          {validation.errors.map((issue, index) => (
            <li key={`err-${issue.code}-${index}`}>
              {issue.message}
              {issue.key ? ` (${issue.key})` : ""}
            </li>
          ))}
        </Section>
      ) : null}

      {validation.warnings.length > 0 ? (
        <Section title="Предупреждения" tone="warn">
          {validation.warnings.map((issue, index) => (
            <li key={`warn-${issue.code}-${index}`}>
              {issue.message}
              {issue.key ? ` (${issue.key})` : ""}
            </li>
          ))}
        </Section>
      ) : null}

      {validation.unresolvedKeys.length > 0 ? (
        <Section title="Неизвестные ключи" tone="error">
          {validation.unresolvedKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </Section>
      ) : null}

      {validation.duplicateKeys.length > 0 ? (
        <Section title="Дублирующие ключи" tone="error">
          {validation.duplicateKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </Section>
      ) : null}

      {nameMatches.length > 0 ? (
        <Section title="Возможные совпадения имён" tone="warn">
          {nameMatches.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E0D6C6] bg-[#FFFCF8] px-3 py-2">
      <p className="text-xs text-[#6B776F]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[#1B4332]">{value}</p>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "error" | "warn";
  children: ReactNode;
}) {
  const color = tone === "error" ? "text-[#8B3A2F]" : "text-[#7A5A1E]";
  return (
    <div>
      <p className={`mb-1 font-medium ${color}`}>{title}</p>
      <ul className={`list-disc space-y-1 pl-5 ${color}`}>{children}</ul>
    </div>
  );
}
