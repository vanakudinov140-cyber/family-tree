"use client";

import { useMemo, useState } from "react";

import { personCreatePayloadSchema } from "@/lib/family-proposal-schema";
import { getFullName } from "@/data/family";
import {
  ProposalServiceError,
  submitFamilyChangeProposal,
} from "@/services/family-proposal-service";
import type { Person } from "@/types/family";

interface PersonCreateProposalFormProps {
  anchorPerson: Person;
  people: Person[];
  onSubmitted: () => void;
  onCancel: () => void;
}

export function PersonCreateProposalForm({
  anchorPerson,
  people,
  onSubmitted,
  onCancel,
}: PersonCreateProposalFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "unknown">(
    "unknown",
  );
  const [relationType, setRelationType] = useState<"parent" | "child" | "spouse">(
    "child",
  );
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const possibleMatches = useMemo(() => {
    const needle = `${firstName} ${lastName}`.trim().toLowerCase();
    if (needle.length < 3) return [];
    return people
      .filter((item) => getFullName(item).toLowerCase().includes(needle))
      .slice(0, 5);
  }, [firstName, lastName, people]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = personCreatePayloadSchema.parse({
        person: {
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          gender,
        },
        relation: {
          anchorPersonId: anchorPerson.id,
          type: relationType,
          parentKind: relationType === "spouse" ? null : "biological",
          spouseStatus: relationType === "spouse" ? "current" : null,
          confidence: "confirmed",
        },
      });

      await submitFamilyChangeProposal({
        proposalType: "person_create",
        targetPersonId: anchorPerson.id,
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
      <p className="text-sm text-[#5C6B63]">
        Связь с: <span className="font-medium">{getFullName(anchorPerson)}</span>
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Имя</span>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
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

      {possibleMatches.length > 0 ? (
        <div className="rounded-xl border border-[#E8D4A8] bg-[#FFF6E8] p-3 text-xs text-[#7A5A1E]">
          <p className="font-medium">Возможные совпадения в дереве:</p>
          <ul className="mt-1 list-disc pl-4">
            {possibleMatches.map((item) => (
              <li key={item.id}>{getFullName(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Пол</span>
        <select
          value={gender}
          onChange={(e) =>
            setGender(e.target.value as "male" | "female" | "other" | "unknown")
          }
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        >
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
          <option value="other">Другой</option>
          <option value="unknown">Не указан</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Связь с выбранным человеком</span>
        <select
          value={relationType}
          onChange={(e) =>
            setRelationType(e.target.value as "parent" | "child" | "spouse")
          }
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        >
          <option value="child">Ребёнок</option>
          <option value="parent">Родитель</option>
          <option value="spouse">Супруг(а)</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Комментарий</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Источник</span>
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
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-xl border px-4 text-sm">
          Назад
        </button>
        <button
          type="button"
          disabled={isSubmitting || !firstName.trim()}
          onClick={() => void handleSubmit()}
          className="min-h-11 flex-1 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm text-[#F5F0E8]"
        >
          {isSubmitting ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}
