"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Area } from "react-easy-crop";

import { PhotoCropper } from "@/components/family/PhotoCropper";
import { getFullName } from "@/data/family";
import {
  PhotoProcessingError,
  loadImageForCrop,
  preparePersonPhoto,
} from "@/lib/image-processing";
import { FamilyDataError } from "@/services/family-service";
import {
  replacePersonPhoto,
} from "@/services/person-photo-service";
import type { Person } from "@/types/family";

type UploadStage =
  | "idle"
  | "prepare"
  | "upload"
  | "save"
  | "done";

interface PersonPhotoDialogProps {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onSaved: (warning?: string) => void;
}

const STAGE_LABEL: Record<UploadStage, string> = {
  idle: "",
  prepare: "Подготовка",
  upload: "Загрузка",
  save: "Сохранение",
  done: "Завершено",
};

export function PersonPhotoDialog({
  isOpen,
  person,
  onClose,
  onSaved,
}: PersonPhotoDialogProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personIdRef = useRef(person.id);
  const [mounted, setMounted] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const sourceFileRef = useRef<File | null>(null);

  personIdRef.current = person.id;
  const isBusy = stage === "prepare" || stage === "upload" || stage === "save";

  const clearObjectUrl = useCallback(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    setObjectUrl(null);
  }, [objectUrl]);

  const resetLocal = useCallback(() => {
    clearObjectUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCropArea(null);
    setError(null);
    setStage("idle");
    sourceFileRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [clearObjectUrl, previewUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetLocal();
    }
  }, [isOpen, resetLocal]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isBusy, isOpen, onClose]);

  const acceptFile = async (file: File) => {
    setError(null);
    try {
      const loaded = await loadImageForCrop(file);
      clearObjectUrl();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      sourceFileRef.current = file;
      setObjectUrl(loaded.objectUrl);
      setCropArea(null);
    } catch (loadError) {
      const message =
        loadError instanceof PhotoProcessingError
          ? loadError.message
          : "Не удалось прочитать изображение";
      setError(message);
    }
  };

  const handleSave = async () => {
    const file = sourceFileRef.current;
    const capturedPersonId = personIdRef.current;
    if (!file || !cropArea || isBusy) {
      return;
    }

    setError(null);
    setStage("prepare");

    try {
      const prepared = await preparePersonPhoto(file, cropArea);
      if (capturedPersonId !== personIdRef.current) {
        // Profile switched mid-flight — still finish for original id.
      }

      setStage("upload");
      const { oldFileCleanupFailed } = await replacePersonPhoto(
        capturedPersonId,
        prepared.blob,
        prepared.extension,
        (nextStage) => setStage(nextStage),
      );

      setStage("done");
      onSaved(
        oldFileCleanupFailed
          ? "Фотография сохранена, но старый файл не удалось удалить"
          : undefined,
      );
      onClose();
    } catch (saveError) {
      const message =
        saveError instanceof PhotoProcessingError ||
        saveError instanceof FamilyDataError
          ? saveError.message
          : "Не удалось сохранить фотографию";
      setError(message);
      setStage("idle");
    }
  };

  // Round preview from crop area (lightweight, not for upload).
  useEffect(() => {
    if (!objectUrl || !cropArea || !sourceFileRef.current) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const prepared = await preparePersonPhoto(
            sourceFileRef.current!,
            cropArea,
          );
          if (cancelled) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(prepared.blob));
        } catch {
          // Preview is optional.
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropArea, objectUrl]);

  if (!isOpen || !mounted) {
    return null;
  }

  const dialog = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть диалог фотографии"
        className="absolute inset-0 bg-[#1B4332]/35 backdrop-blur-[1px]"
        disabled={isBusy}
        onClick={() => {
          if (!isBusy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex w-full max-w-[min(100%,560px)] flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
        style={{ maxHeight: "calc(100dvh - 32px)" }}
      >
        <div className="shrink-0 border-b border-[#EDE8DF] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
                {person.photoPath ? "Изменить фотографию" : "Добавить фотографию"}
              </h2>
              <p className="mt-1 truncate text-sm text-[#5C6B63]">
                {getFullName(person)}
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="rounded-full px-3 py-1 text-sm text-[#5C6B63] hover:bg-[#F3EEE4] disabled:opacity-60"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Выбрать файл фотографии"
            disabled={isBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void acceptFile(file);
            }}
          />

          {!objectUrl ? (
            <div
              className={[
                "flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center",
                isDragging
                  ? "border-[#C4A962] bg-[#F7F3ED]"
                  : "border-[#D9D0C3] bg-[#FAF7F1]",
              ].join(" ")}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void acceptFile(file);
              }}
            >
              <p className="text-sm text-[#2D4A3E]">
                Перетащите JPEG, PNG или WebP сюда
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 min-h-11 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm font-medium text-[#F5F0E8]"
              >
                Выбрать файл
              </button>
            </div>
          ) : (
            <>
              <PhotoCropper
                imageSrc={objectUrl}
                disabled={isBusy}
                onCropComplete={setCropArea}
              />
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-[#E8DFD0] bg-[#F3EEE4]">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="text-sm text-[#5C6B63]">
                  Предпросмотр круглого портрета
                </p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-medium text-[#2D4A3E] underline-offset-2 hover:underline"
              >
                Выбрать другой файл
              </button>
            </>
          )}

          {stage !== "idle" ? (
            <p className="text-sm font-medium text-[#2D4A3E]" aria-live="polite">
              {STAGE_LABEL[stage]}…
            </p>
          ) : null}

          {error ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#EDE8DF] px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 text-sm font-medium text-[#2D4A3E] disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isBusy || !objectUrl || !cropArea}
              onClick={() => void handleSave()}
              className="min-h-11 flex-1 rounded-xl border border-[#1B4332] bg-[#1B4332] px-4 text-sm font-medium text-[#F5F0E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? "Сохранение…" : "Сохранить фотографию"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
