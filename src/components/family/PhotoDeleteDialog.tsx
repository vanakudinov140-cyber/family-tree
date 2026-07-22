"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getFullName } from "@/data/family";
import { FamilyDataError } from "@/services/family-service";
import { clearPersonPhoto } from "@/services/person-photo-service";
import type { Person } from "@/types/family";

interface PhotoDeleteDialogProps {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onDeleted: (warning?: string) => void;
}

export function PhotoDeleteDialog({
  isOpen,
  person,
  onClose,
  onDeleted,
}: PhotoDeleteDialogProps) {
  const titleId = useId();
  const personIdRef = useRef(person.id);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  personIdRef.current = person.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, person.id]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !mounted) {
    return null;
  }

  const handleDelete = async () => {
    if (isSubmitting) return;
    const capturedId = personIdRef.current;
    setIsSubmitting(true);
    setError(null);
    try {
      const { fileCleanupFailed } = await clearPersonPhoto(capturedId);
      onDeleted(
        fileCleanupFailed
          ? "Фотография удалена, но технический файл остался в хранилище"
          : undefined,
      );
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof FamilyDataError
          ? deleteError.message
          : "Не удалось удалить фотографию",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialog = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть подтверждение"
        className="absolute inset-0 bg-[#1B4332]/35"
        disabled={isSubmitting}
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
          Удалить фотографию?
        </h2>
        <p className="mt-2 text-sm text-[#5C6B63]">
          Для {getFullName(person)} снова будет показана монограмма. Человек и
          родственные связи не удаляются.
        </p>
        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 text-sm font-medium text-[#2D4A3E]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleDelete()}
            className="min-h-11 flex-1 rounded-xl border border-[#8B3A2F] bg-[#8B3A2F] px-4 text-sm font-medium text-[#FFF8F5]"
          >
            {isSubmitting ? "Удаление…" : "Удалить фотографию"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
