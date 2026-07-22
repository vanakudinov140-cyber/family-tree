"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { PersonCreateProposalForm } from "@/components/collaboration/PersonCreateProposalForm";
import { PersonUpdateProposalForm } from "@/components/collaboration/PersonUpdateProposalForm";
import { PhotoProposalForm } from "@/components/collaboration/PhotoProposalForm";
import { RelationshipProposalForm } from "@/components/collaboration/RelationshipProposalForm";
import { getFullName } from "@/data/family";
import type { Person } from "@/types/family";

type SuggestStep =
  | "menu"
  | "person_update"
  | "person_create"
  | "relationship"
  | "biography"
  | "photo"
  | "done";

interface SuggestChangeDialogProps {
  isOpen: boolean;
  person: Person;
  people: Person[];
  onClose: () => void;
  onSubmitted: () => void;
}

export function SuggestChangeDialog({
  isOpen,
  person,
  people,
  onClose,
  onSubmitted,
}: SuggestChangeDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<SuggestStep>("menu");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) setStep("menu");
  }, [isOpen, person.id]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && step !== "done") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, step]);

  if (!isOpen || !mounted) return null;

  const handleDone = () => {
    setStep("done");
    onSubmitted();
    onClose();
  };

  const dialog = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-[#1B4332]/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
      >
        <div className="border-b border-[#EDE8DF] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
            Предложить изменение
          </h2>
          <p className="mt-1 text-sm text-[#5C6B63]">{getFullName(person)}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "menu" ? (
            <div className="grid gap-2">
              {[
                ["person_update", "Исправить сведения"],
                ["person_create", "Добавить родственника"],
                ["relationship", "Добавить или исправить связь"],
                ["biography", "Дополнить биографию"],
                ["photo", "Предложить фотографию"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStep(key as SuggestStep)}
                  className="min-h-11 rounded-xl border border-[#D9D0C3] bg-white px-4 text-left text-sm font-medium text-[#2D4A3E] hover:border-[#C4A962]"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {step === "person_update" ? (
            <PersonUpdateProposalForm
              person={person}
              onSubmitted={handleDone}
              onCancel={() => setStep("menu")}
            />
          ) : null}

          {step === "biography" ? (
            <PersonUpdateProposalForm
              person={person}
              biographyOnly
              onSubmitted={handleDone}
              onCancel={() => setStep("menu")}
            />
          ) : null}

          {step === "person_create" ? (
            <PersonCreateProposalForm
              anchorPerson={person}
              people={people}
              onSubmitted={handleDone}
              onCancel={() => setStep("menu")}
            />
          ) : null}

          {step === "relationship" ? (
            <RelationshipProposalForm
              people={people}
              anchorPerson={person}
              onSubmitted={handleDone}
              onCancel={() => setStep("menu")}
            />
          ) : null}

          {step === "photo" ? (
            <PhotoProposalForm
              person={person}
              onSubmitted={handleDone}
              onCancel={() => setStep("menu")}
            />
          ) : null}

          {step === "done" ? (
            <p className="text-sm text-[#2D4A3E]">
              Предложение отправлено администратору.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
