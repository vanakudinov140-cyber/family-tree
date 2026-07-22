"use client";

import { useState } from "react";

import { personUpdatePayloadSchema } from "@/lib/family-proposal-schema";
import {
  ProposalServiceError,
  submitFamilyChangeProposal,
} from "@/services/family-proposal-service";
import type { Person } from "@/types/family";

interface PersonUpdateProposalFormProps {
  person: Person;
  biographyOnly?: boolean;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function PersonUpdateProposalForm({
  person,
  biographyOnly = false,
  onSubmitted,
  onCancel,
}: PersonUpdateProposalFormProps) {
  const [firstName, setFirstName] = useState(person.firstName);
  const [middleName, setMiddleName] = useState(person.middleName ?? "");
  const [lastName, setLastName] = useState(person.lastName ?? "");
  const [maidenName, setMaidenName] = useState(person.maidenName ?? "");
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? "");
  const [biography, setBiography] = useState(person.biography ?? "");
  const [notes, setNotes] = useState(person.notes ?? "");
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const changes = biographyOnly
        ? { biography: biography.trim() || null }
        : {
            firstName: firstName.trim(),
            middleName: middleName.trim() || null,
            lastName: lastName.trim() || null,
            maidenName: maidenName.trim() || null,
            birthPlace: birthPlace.trim() || null,
            biography: biography.trim() || null,
            notes: notes.trim() || null,
          };

      const payload = personUpdatePayloadSchema.parse({ changes });

      await submitFamilyChangeProposal({
        proposalType: "person_update",
        targetPersonId: person.id,
        payload,
        reason: reason.trim() || null,
        sourceNote: sourceNote.trim() || null,
      });
      onSubmitted();
    } catch (submitError) {
      setError(
        submitError instanceof ProposalServiceError
          ? submitError.message
          : "Не удалось отправить предложение",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {!biographyOnly ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Имя</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Отчество</span>
            <input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Фамилия</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Девичья фамилия</span>
            <input
              value={maidenName}
              onChange={(e) => setMaidenName(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Место рождения</span>
            <input
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>
        </>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Биография</span>
        <textarea
          value={biography}
          onChange={(e) => setBiography(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        />
      </label>

      {!biographyOnly ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Заметки</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
          />
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Комментарий для администратора</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Источник информации</span>
        <textarea
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-11 flex-1 rounded-xl border border-[#D9D0C3] bg-[#FAF7F1] px-4 text-sm"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
          className="min-h-11 flex-1 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm text-[#F5F0E8]"
        >
          {isSubmitting ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}
