"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { FamilyImportPreview } from "@/components/admin/FamilyImportPreview";
import { FamilyImportReport } from "@/components/admin/FamilyImportReport";
import { useAuth } from "@/context/AuthContext";
import { useFamilyData } from "@/context/FamilyDataContext";
import { computeFamilyGraphStats } from "@/lib/family-graph-stats";
import {
  buildImportOutcomeSummary,
  buildImportPipelineCounts,
  logImportPipelineTable,
  type ImportPipelineCounts,
} from "@/lib/family-import-outcome";
import {
  extractFileExtension,
  formatFileSize,
  ImportFileError,
  logImportDiagnostics,
  parseImportFile,
  type ParsedImportFile,
} from "@/lib/family-import-file";
import {
  FamilyImportError,
  importFamilyBatch,
  validateFamilyImport,
} from "@/services/family-import-service";
import type {
  FamilyImportBatchResult,
  FamilyImportPayload,
  FamilyImportValidationResult,
} from "@/types/family-import";

const CONFIRM_PHRASE = "ИМПОРТИРОВАТЬ";
export const IMPORT_DEBUG_STORAGE_KEY = "family-import-debug-snapshot";

interface FamilyImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function collectNameMatches(
  payload: FamilyImportPayload,
  existingPeople: Array<{ firstName: string; lastName: string }>,
): string[] {
  const matches: string[] = [];
  for (const person of payload.people) {
    const last = (person.lastName ?? "").trim().toLowerCase();
    const first = person.firstName.trim().toLowerCase();
    const hit = existingPeople.find(
      (existing) =>
        existing.firstName.trim().toLowerCase() === first &&
        existing.lastName.trim().toLowerCase() === last &&
        last.length > 0,
    );
    if (hit) {
      matches.push(
        `${person.key}: совпадает имя с существующим «${hit.firstName} ${hit.lastName}» (объединение только по external_key)`,
      );
    }
  }
  return matches;
}

export function FamilyImportDialog({ open, onClose }: FamilyImportDialogProps) {
  const { role } = useAuth();
  const { people, reload } = useFamilyData();
  const [mounted, setMounted] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileMeta, setFileMeta] = useState<ParsedImportFile | null>(null);
  const [payload, setPayload] = useState<FamilyImportPayload | null>(null);
  const [validation, setValidation] =
    useState<FamilyImportValidationResult | null>(null);
  const [report, setReport] = useState<FamilyImportBatchResult | null>(null);
  const [importCounts, setImportCounts] = useState<ImportPipelineCounts | null>(
    null,
  );
  const [importOutcome, setImportOutcome] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isImporting) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isImporting, onClose, open]);

  const nameMatches = useMemo(() => {
    if (!payload) return [];
    return collectNameMatches(payload, people);
  }, [payload, people]);

  const hasValidPayload =
    Boolean(payload) &&
    Boolean(validation?.valid) &&
    (validation?.errors.length ?? 1) === 0 &&
    (payload?.people.length ?? 0) > 0;

  const canImport =
    hasValidPayload &&
    confirmText.trim() === CONFIRM_PHRASE &&
    !isImporting &&
    !isValidating &&
    role === "admin";

  const resetValidation = () => {
    setValidation(null);
    setReport(null);
    setImportCounts(null);
    setImportOutcome(null);
    setClientError(null);
  };

  const runValidation = useCallback(async (parsedPayload: FamilyImportPayload) => {
    setIsValidating(true);
    setProgress("Проверка файла…");

    try {
      const result = await validateFamilyImport(parsedPayload);
      setValidation(result);
      if (!result.valid || result.errors.length > 0) {
        setProgress(null);
        return result;
      }
      if (result.newPeopleCount === 0 && result.newRelationshipsCount === 0) {
        setClientError(
          "Новые записи не добавлены: все данные из файла уже присутствуют",
        );
        setProgress(null);
        return result;
      }
      setProgress("Проверка пройдена");
      return result;
    } catch (error) {
      setValidation(null);
      setClientError(
        error instanceof FamilyImportError || error instanceof Error
          ? error.message
          : "Ошибка проверки",
      );
      setProgress(null);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setClientError(null);
    resetValidation();
    setReport(null);

    try {
      const parsed = await parseImportFile(file);
      setRawText(parsed.rawText);
      setFileMeta(parsed);
      setPayload(parsed.payload);

      logImportDiagnostics({
        fileName: parsed.fileName,
        fileSize: parsed.fileSize,
        mimeType: parsed.mimeType,
        extension: extractFileExtension(parsed.fileName),
        parsedRowsCount: parsed.peopleCount + parsed.relationshipsCount,
        payloadRowsCount: parsed.peopleCount,
        validRowsCount: parsed.peopleCount,
        rejectedRowsCount: 0,
      });

      if (parsed.peopleCount === 0) {
        setClientError(
          "В файле не найдено записей, подходящих для импорта",
        );
        return;
      }

      await runValidation(parsed.payload);
    } catch (error) {
      setFileMeta(null);
      setPayload(null);
      setRawText("");
      setClientError(
        error instanceof ImportFileError ||
          error instanceof FamilyImportError ||
          error instanceof Error
          ? error.message
          : "Не удалось прочитать файл",
      );
    } finally {
      input.value = "";
    }
  };

  const handleValidate = useCallback(async () => {
    setClientError(null);
    setReport(null);
    setImportOutcome(null);

    if (!rawText.trim()) {
      setClientError("Вставьте JSON или выберите файл");
      return;
    }

    setIsValidating(true);
    setProgress("Проверка файла…");

    try {
      const parsed = await parseImportFile(
        new File([rawText], fileMeta?.fileName ?? "import.json", {
          type: fileMeta?.mimeType ?? "application/json",
        }),
      );
      setPayload(parsed.payload);
      setFileMeta((current) => current ?? parsed);
      await runValidation(parsed.payload);
    } catch (error) {
      setPayload(null);
      setValidation(null);
      setClientError(
        error instanceof ImportFileError ||
          error instanceof FamilyImportError ||
          error instanceof Error
          ? error.message
          : "Ошибка проверки",
      );
      setProgress(null);
    } finally {
      setIsValidating(false);
    }
  }, [fileMeta, rawText, runValidation]);

  const handleImport = useCallback(async () => {
    if (!payload || !canImport) return;

    setClientError(null);
    setImportOutcome(null);
    setIsImporting(true);
    setProgress("Импорт…");

    const payloadToImport = payload;

    try {
      const latest = await validateFamilyImport(payloadToImport);
      setValidation(latest);
      if (!latest.valid || latest.errors.length > 0) {
        setClientError("Серверная валидация не пройдена — импорт отменён");
        setProgress(null);
        return;
      }

      if (payloadToImport.people.length === 0) {
        setClientError(
          "В файле не найдено записей, подходящих для импорта",
        );
        setProgress(null);
        return;
      }

      if (latest.newPeopleCount === 0 && latest.newRelationshipsCount === 0) {
        setClientError(
          "Новые записи не добавлены: данные уже присутствуют",
        );
        setProgress(null);
        return;
      }

      const batch = await importFamilyBatch(payloadToImport);
      setReport(batch);

      const reloaded = await reload();
      const counts = buildImportPipelineCounts({
        parsedPeopleCount: fileMeta?.peopleCount ?? payloadToImport.people.length,
        parsedRelationshipsCount:
          fileMeta?.relationshipsCount ?? payloadToImport.relationships.length,
        validation: latest,
        payloadPeopleCount: payloadToImport.people.length,
        payloadRelationshipsCount: payloadToImport.relationships.length,
        batch,
      });
      setImportCounts(counts);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          IMPORT_DEBUG_STORAGE_KEY,
          JSON.stringify(counts),
        );
      }

      const persisted = reloaded
        ? computeFamilyGraphStats(
            reloaded.people,
            reloaded.relationships.length,
            null,
          )
        : null;

      const summary = buildImportOutcomeSummary(counts, persisted);
      setImportOutcome(summary.headline);

      logImportPipelineTable(
        counts,
        persisted,
        reloaded?.people.length ?? 0,
        persisted?.focusedComponentSize ?? 0,
      );

      logImportDiagnostics({
        fileName: fileMeta?.fileName ?? "import.json",
        fileSize: fileMeta?.fileSize ?? rawText.length,
        mimeType: fileMeta?.mimeType ?? "",
        extension: extractFileExtension(fileMeta?.fileName ?? "import.json"),
        parsedRowsCount:
          payloadToImport.people.length + payloadToImport.relationships.length,
        payloadRowsCount: payloadToImport.people.length,
        validRowsCount: latest.newPeopleCount,
        rejectedRowsCount: latest.existingPeopleCount,
        importedCount: counts.createdPeopleCount,
      });

      if (summary.isFullSuccess) {
        setProgress("Готово");
      } else {
        setProgress(null);
      }
    } catch (error) {
      setClientError(
        error instanceof FamilyImportError || error instanceof Error
          ? error.message
          : "Ошибка импорта",
      );
      setProgress(null);
    } finally {
      setIsImporting(false);
    }
  }, [canImport, fileMeta, payload, rawText.length, reload]);

  if (!mounted || !open || role !== "admin") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#1B4332]/35"
        aria-label="Закрыть"
        disabled={isImporting}
        onClick={() => {
          if (!isImporting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Импорт семьи"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#E0D6C6] bg-[#FFFCF8] shadow-[0_20px_48px_rgba(27,67,50,0.22)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#E8DFD0] px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1B4332]">
              Импорт семьи
            </h2>
            <p className="text-xs text-[#6B776F]">
              Сначала проверка, запись только после подтверждения
            </p>
          </div>
          <button
            type="button"
            disabled={isImporting}
            onClick={onClose}
            className="rounded-lg p-2 text-[#5C6B63] hover:bg-[#F3EDE3] disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[#D9D0C3] bg-white px-3 text-sm font-medium text-[#2D4A3E] hover:border-[#C4A962]">
              Выбрать файл
              <input
                type="file"
                accept=".json,.csv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={isValidating || isImporting}
                onChange={(event) => void handleFile(event)}
              />
            </label>
            {fileMeta ? (
              <span className="self-center text-xs text-[#6B776F]">
                {fileMeta.fileName} · {fileMeta.format.toUpperCase()} ·{" "}
                {formatFileSize(fileMeta.fileSize)} · Прочитано записей:{" "}
                {fileMeta.peopleCount}
              </span>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="family-import-json"
              className="mb-1 block text-sm font-medium text-[#2D4A3E]"
            >
              Или вставьте JSON
            </label>
            <textarea
              id="family-import-json"
              value={rawText}
              onChange={(event) => {
                setRawText(event.target.value);
                setFileMeta(null);
                setPayload(null);
                resetValidation();
              }}
              rows={10}
              className="w-full rounded-xl border border-[#D9D0C3] bg-white px-3 py-2 font-mono text-xs text-[#1B4332] outline-none focus:border-[#C4A962]"
              placeholder='{"version":1,"people":[],"relationships":[]}'
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!rawText.trim() || isValidating || isImporting}
              onClick={() => void handleValidate()}
              className="min-h-10 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {isValidating ? "Проверка…" : "Проверить файл"}
            </button>
          </div>

          {clientError ? (
            <p className="rounded-xl border border-[#E8C4BE] bg-[#FBF1EF] px-3 py-2 text-sm text-[#8B3A2F]">
              {clientError}
            </p>
          ) : null}

          {importOutcome ? (
            <p className="rounded-xl border border-[#E8D4A8] bg-[#FFF6E8] px-3 py-2 text-sm text-[#7A5A1E]">
              {importOutcome}
            </p>
          ) : null}

          {progress ? (
            <p className="text-sm text-[#5C6B63]">{progress}</p>
          ) : null}

          <FamilyImportPreview
            validation={validation}
            nameMatches={nameMatches}
            fileMeta={fileMeta}
          />

          {report ? (
            <FamilyImportReport
              report={report}
              importCounts={importCounts}
              outcomeHeadline={importOutcome}
            />
          ) : null}

          <div className="rounded-xl border border-[#E0D6C6] bg-white p-3">
            <p className="text-sm text-[#2D4A3E]">
              Для импорта введите точно:{" "}
              <span className="font-semibold">{CONFIRM_PHRASE}</span>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#D9D0C3] px-3 py-2 text-sm outline-none focus:border-[#C4A962]"
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              disabled={isImporting}
            />
            <button
              type="button"
              disabled={!canImport}
              onClick={() => void handleImport()}
              className="mt-3 min-h-10 w-full rounded-xl bg-[#1B4332] px-4 text-sm font-medium text-white disabled:opacity-45 sm:w-auto"
            >
              {isImporting ? "Импорт…" : "Импортировать"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
