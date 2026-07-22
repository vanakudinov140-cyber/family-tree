"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import {
  PersonForm,
  type PersonFormSubmitPayload,
} from "@/components/family/PersonForm";
import { useAuth } from "@/context/AuthContext";
import { useFamilyData } from "@/context/FamilyDataContext";
import { getFullName } from "@/data/family";
import {
  FamilyDataError,
  updatePerson,
} from "@/services/family-service";
import type { Person } from "@/types/family";

interface EditPersonDialogProps {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onSaved: (personId: string) => void;
}

export function EditPersonDialog({
  isOpen,
  person,
  onClose,
  onSaved,
}: EditPersonDialogProps) {
  const titleId = useId();
  const { user, canEditFamily, isLoading: isAuthLoading } = useAuth();
  const { source, reload } = useFamilyData();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, person.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !mounted) {
    return null;
  }

  const blockedMessage = (() => {
    if (source === "local") {
      return "Редактирование недоступно: используются локальные тестовые данные";
    }
    if (isAuthLoading) {
      return null;
    }
    if (!user) {
      return "Для редактирования необходимо войти";
    }
    if (!canEditFamily) {
      return "Редактировать родственников может только редактор или администратор";
    }
    return null;
  })();

  const handleSubmit = async (payload: PersonFormSubmitPayload) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { secondParentId: _ignored, ...personData } = payload;
      await updatePerson(person.id, personData);
      await reload();
      onSaved(person.id);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof FamilyDataError
          ? submitError.message
          : "Не удалось сохранить данные";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ overflow: "hidden" }}
    >
      <button
        type="button"
        aria-label="Закрыть форму редактирования"
        className="absolute inset-0 bg-[#1B4332]/35 backdrop-blur-[1px]"
        onClick={() => {
          if (!isSubmitting) {
            onClose();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex w-full max-w-[min(100%,520px)] flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
        style={{ maxHeight: "calc(100dvh - 32px)" }}
      >
        <div className="shrink-0 border-b border-[#EDE8DF] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
                Редактировать
              </h2>
              <p className="mt-1 truncate text-sm text-[#5C6B63]">
                {getFullName(person)}
              </p>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-full px-3 py-1 text-sm text-[#5C6B63] hover:bg-[#F3EEE4] disabled:opacity-60"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {blockedMessage ? (
            <p className="rounded-2xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 py-3 text-sm text-[#2D4A3E]">
              {blockedMessage}
            </p>
          ) : (
            <PersonForm
              mode="edit"
              initialPerson={person}
              isSubmitting={isSubmitting}
              onBack={onClose}
              onSubmit={handleSubmit}
              submitLabel="Сохранить"
              cancelLabel="Отмена"
            />
          )}

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
