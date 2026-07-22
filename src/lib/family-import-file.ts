import { parseFamilyImportJson } from "@/lib/family-import-schema";
import { sanitizeImportPayload } from "@/services/family-import-service";
import type { FamilyImportPayload } from "@/types/family-import";

export type ImportFileFormat = "json" | "csv" | "xlsx" | "xls" | "unknown";

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export type ParsedImportFile = {
  format: ImportFileFormat;
  payload: FamilyImportPayload;
  rawText: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  peopleCount: number;
  relationshipsCount: number;
};

const JSON_MIMES = new Set([
  "application/json",
  "text/json",
  "application/ld+json",
]);

const CSV_MIMES = new Set(["text/csv", "application/csv", "text/comma-separated-values"]);

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function extractFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return "";
  return trimmed.slice(dot + 1).toLowerCase();
}

export function detectImportFileFormat(
  fileName: string,
  mimeType: string,
): ImportFileFormat {
  const extension = extractFileExtension(fileName);
  const mime = mimeType.trim().toLowerCase();

  if (extension === "json" || JSON_MIMES.has(mime)) {
    return "json";
  }
  if (extension === "csv" || CSV_MIMES.has(mime)) {
    return "csv";
  }
  if (extension === "xlsx" || XLSX_MIMES.has(mime)) {
    return "xlsx";
  }
  if (extension === "xls") {
    return "xls";
  }

  if (!mime || mime === "application/octet-stream") {
    if (extension === "json") return "json";
    if (extension === "csv") return "csv";
    if (extension === "xlsx") return "xlsx";
    if (extension === "xls") return "xls";
  }

  return "unknown";
}

function unsupportedFormatMessage(format: ImportFileFormat): string {
  if (format === "csv") {
    return "CSV пока не поддерживается. Используйте JSON-файл импорта.";
  }
  if (format === "xlsx" || format === "xls") {
    return "Excel (XLS/XLSX) пока не поддерживается. Используйте JSON-файл импорта.";
  }
  return "Не удалось определить формат файла. Поддерживается только JSON (.json).";
}

export async function readImportFileText(file: File): Promise<string> {
  const text = await file.text();
  return stripUtf8Bom(text);
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const format = detectImportFileFormat(file.name, file.type);

  if (format !== "json") {
    throw new ImportFileError(
      format === "unknown"
        ? unsupportedFormatMessage(format)
        : unsupportedFormatMessage(format),
    );
  }

  const rawText = await readImportFileText(file);
  if (!rawText.trim()) {
    throw new ImportFileError("Файл пустой");
  }

  const payload = sanitizeImportPayload(parseFamilyImportJson(rawText));

  return {
    format,
    payload,
    rawText,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    peopleCount: payload.people.length,
    relationshipsCount: payload.relationships.length,
  };
}

export function describeZeroImportResult(
  report: {
    insertedPeople: unknown[];
    insertedRelationships: unknown[];
    skippedPeople: Array<{ reason?: string }>;
  },
  payloadPeopleCount: number,
): string | null {
  if (report.insertedPeople.length > 0 || report.insertedRelationships.length > 0) {
    return null;
  }

  if (payloadPeopleCount === 0) {
    return "В файле не найдено записей, подходящих для импорта";
  }

  const skipped = report.skippedPeople.length;
  if (skipped > 0 && skipped >= payloadPeopleCount) {
    return "Новые записи не добавлены: данные уже присутствуют";
  }

  return "Сервер не добавил новых записей. Проверьте предпросмотр и попробуйте снова.";
}

export function logImportDiagnostics(meta: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  parsedRowsCount: number;
  validRowsCount?: number;
  rejectedRowsCount?: number;
  payloadRowsCount: number;
  importedCount?: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.table(meta);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
