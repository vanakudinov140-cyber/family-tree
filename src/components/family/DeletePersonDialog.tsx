"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/context/AuthContext";
import { useFamilyData } from "@/context/FamilyDataContext";
import { getFullName } from "@/data/family";
import {
  FamilyDataError,
  deletePerson,
  pickSafeFocusPersonId,
} from "@/services/family-service";
import { removeStoredPhoto } from "@/services/person-photo-service";
import type { Person } from "@/types/family";

interface DeletePersonDialogProps {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onDeleted: (nextFocusPersonId: string | null) => void;
}

const CONFIRM_WORD = "УДАЛИТЬ";

export function DeletePersonDialog({
  isOpen,
  person,
  onClose,
  onDeleted,
}: DeletePersonDialogProps) {
  const titleId = useId();
  const { user, canDeletePeople, isLoading: isAuthLoading } = useAuth();
  const { source, people, relationships, reload } = useFamilyData();
  const [mounted, setMounted] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null | undefined>(
    undefined,
  );

  const relationshipCount = useMemo(() => {
    return relationships.filter(
      (item) =>
        item.sourceId === person.id || item.targetId === person.id,
    ).length;
  }, [person.id, relationships]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setConfirmText("");
    setError(null);
    setWarning(null);
    setPendingFocusId(undefined);
    setIsSubmitting(false);
  }, [isOpen, person.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting && pendingFocusId === undefined) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isSubmitting, onClose, pendingFocusId]);

  const finishAfterWarning = () => {
    const nextFocus =
      pendingFocusId === undefined ? null : pendingFocusId;
    onDeleted(nextFocus);
    onClose();
  };

  if (!isOpen || !mounted) {
    return null;
  }

  const blockedMessage = (() => {
    if (source === "local") {
      return "Удаление недоступно: используются локальные тестовые данные";
    }
    if (isAuthLoading) {
      return null;
    }
    if (!user) {
      return "Для удаления необходимо войти";
    }
    if (!canDeletePeople) {
      return "Удалять родственников может только администратор";
    }
    if (people.length <= 1) {
      return "Нельзя удалить единственного человека в дереве";
    }
    return null;
  })();

  const canDelete =
    !blockedMessage && confirmText.trim() === CONFIRM_WORD && !isSubmitting;

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const snapshot = person;
      const remainingBefore = people.filter((item) => item.id !== person.id);
      const nextFocusId = pickSafeFocusPersonId(snapshot, remainingBefore);

      const result = await deletePerson(person.id);
      let storageWarning: string | null = null;
      if (result.deleted_photo_path) {
        const removed = await removeStoredPhoto(result.deleted_photo_path);
        if (!removed) {
          storageWarning =
            "Человек удалён, но технический файл фотографии остался в хранилище";
        }
      }
      await reload();
      if (storageWarning) {
        setWarning(storageWarning);
        setPendingFocusId(nextFocusId);
        return;
      }
      onDeleted(nextFocusId);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof FamilyDataError
          ? submitError.message
          : "Не удалось удалить человека";
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
        aria-label="Закрыть подтверждение удаления"
        className="absolute inset-0 bg-[#1B4332]/35 backdrop-blur-[1px]"
        onClick={() => {
          if (pendingFocusId !== undefined) {
            finishAfterWarning();
          } else if (!isSubmitting) {
            onClose();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex w-full max-w-[min(100%,480px)] flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
        style={{ maxHeight: "calc(100dvh - 32px)" }}
      >
        <div className="shrink-0 border-b border-[#EDE8DF] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
                Удалить человека
              </h2>
              <p className="mt-1 truncate text-sm text-[#5C6B63]">
                {getFullName(person)}
              </p>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (pendingFocusId !== undefined) {
                  finishAfterWarning();
                } else {
                  onClose();
                }
              }}
              className="rounded-full px-3 py-1 text-sm text-[#5C6B63] hover:bg-[#F3EEE4] disabled:opacity-60"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {blockedMessage ? (
            <p className="rounded-2xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 py-3 text-sm text-[#2D4A3E]">
              {blockedMessage}
            </p>
          ) : (
            <>
              <p className="text-sm leading-6 text-[#2D4A3E]">
                Будут удалены человек{" "}
                <span className="font-semibold">{getFullName(person)}</span> и{" "}
                <span className="font-semibold">{relationshipCount}</span>{" "}
                {relationshipCount === 1
                  ? "родственная связь"
                  : relationshipCount >= 2 && relationshipCount <= 4
                    ? "родственные связи"
                    : "родственных связей"}
                .
              </p>
              <p className="rounded-2xl border border-[#E8C9C0] bg-[#FBF4F1] px-4 py-3 text-sm text-[#7A3E32]">
                Это действие нельзя отменить.
              </p>
              <label className="block text-sm text-[#2D4A3E]">
                <span className="mb-1 block font-medium">
                  Для подтверждения введите слово {CONFIRM_WORD}
                </span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  className="w-full rounded-xl border border-[#D9D0C3] bg-white px-3 py-2.5 outline-none focus:border-[#C4A962]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </>
          )}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {warning ? (
            <p className="rounded-xl border border-[#E8C9C0] bg-[#FBF4F1] px-3 py-2 text-sm text-[#7A3E32]">
              {warning}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#EDE8DF] px-5 py-4">
          {pendingFocusId !== undefined ? (
            <button
              type="button"
              onClick={finishAfterWarning}
              className="min-h-11 w-full rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332]"
            >
              Понятно
            </button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="min-h-11 flex-1 rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 text-sm font-medium text-[#2D4A3E] transition hover:border-[#C4A962] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!canDelete}
                onClick={() => void handleDelete()}
                className="min-h-11 flex-1 rounded-xl border border-[#8B3A2F] bg-[#8B3A2F] px-4 text-sm font-medium text-[#FFF8F5] transition hover:bg-[#732F26] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Удаление…" : "Удалить человека"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
