"use client";

import { useEffect, useId, useMemo, useState } from "react";

import {
  PersonForm,
  type PersonFormSubmitPayload,
} from "@/components/family/PersonForm";
import { RelativeTypeSelector } from "@/components/family/RelativeTypeSelector";
import { useAuth } from "@/context/AuthContext";
import { useFamilyData } from "@/context/FamilyDataContext";
import { getFullName } from "@/data/family";
import type { RelationKind } from "@/lib/supabase/types";
import {
  FamilyDataError,
  createRelative,
} from "@/services/family-service";
import type { Person } from "@/types/family";

interface AddRelativeDialogProps {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onCreated: (personId: string) => void;
}

export function AddRelativeDialog({
  isOpen,
  person,
  onClose,
  onCreated,
}: AddRelativeDialogProps) {
  const titleId = useId();
  const { user, canEditFamily, isLoading: isAuthLoading } = useAuth();
  const { source, people, reload } = useFamilyData();
  const [relationKind, setRelationKind] = useState<RelationKind | null>(null);
  const [step, setStep] = useState<"type" | "form">("type");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRelationKind(null);
    setStep("type");
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, person.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const spouses = useMemo(() => {
    const spouseIds =
      person.spouseIds && person.spouseIds.length > 0
        ? person.spouseIds
        : person.spouseId
          ? [person.spouseId]
          : [];
    return spouseIds
      .map((id) => people.find((item) => item.id === id))
      .filter((item): item is Person => Boolean(item));
  }, [people, person.spouseId, person.spouseIds]);

  if (!isOpen) {
    return null;
  }

  const blockedMessage = (() => {
    if (source === "local") {
      return "Добавление недоступно: используются локальные тестовые данные";
    }
    if (isAuthLoading) {
      return null;
    }
    if (!user) {
      return "Для добавления родственников необходимо войти";
    }
    if (!canEditFamily) {
      return "Добавлять родственников может только редактор или администратор";
    }
    return null;
  })();

  const handleSelectKind = (kind: RelationKind) => {
    setError(null);

    if (kind === "sibling" && person.parentIds.length === 0) {
      setError(
        "Сначала добавьте хотя бы одного родителя выбранного человека",
      );
      return;
    }

    setRelationKind(kind);
    setStep("form");
  };

  const handleSubmit = async (payload: PersonFormSubmitPayload) => {
    if (!relationKind || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { secondParentId, ...personData } = payload;
      const newPersonId = await createRelative({
        referencePersonId: person.id,
        relationKind,
        personData,
        secondParentId:
          relationKind === "child" ? secondParentId : null,
      });

      await reload();
      onCreated(newPersonId);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof FamilyDataError
          ? submitError.message
          : "Не удалось добавить родственника";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Закрыть форму"
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
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EDE8DF] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
              Добавить родственника
            </h2>
            <p className="mt-1 truncate text-sm text-[#5C6B63]">
              Для: {getFullName(person)}
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

        <div className="overflow-y-auto px-5 py-4">
          {blockedMessage ? (
            <p className="rounded-2xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 py-3 text-sm text-[#2D4A3E]">
              {blockedMessage}
            </p>
          ) : step === "type" ? (
            <RelativeTypeSelector
              value={relationKind}
              onChange={handleSelectKind}
              disabled={isSubmitting}
            />
          ) : relationKind ? (
            <PersonForm
              relationKind={relationKind}
              spouses={spouses}
              isSubmitting={isSubmitting}
              onBack={() => {
                setStep("type");
                setError(null);
              }}
              onSubmit={handleSubmit}
            />
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
