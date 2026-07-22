"use client";

import { useState } from "react";

import {
  relationshipCreatePayloadSchema,
  relationshipUpdatePayloadSchema,
} from "@/lib/family-proposal-schema";
import { getFullName } from "@/data/family";
import {
  ProposalServiceError,
  submitFamilyChangeProposal,
} from "@/services/family-proposal-service";
import type { Person } from "@/types/family";

interface RelationshipProposalFormProps {
  people: Person[];
  anchorPerson?: Person;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function RelationshipProposalForm({
  people,
  anchorPerson,
  onSubmitted,
  onCancel,
}: RelationshipProposalFormProps) {
  const [mode, setMode] = useState<"create" | "update">("create");
  const [person1Id, setPerson1Id] = useState(anchorPerson?.id ?? people[0]?.id ?? "");
  const [person2Id, setPerson2Id] = useState("");
  const [relationshipType, setRelationshipType] = useState<"parent" | "spouse">(
    "parent",
  );
  const [parentKind, setParentKind] = useState<
    "biological" | "adoptive" | "step" | "guardian"
  >("biological");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        const payload = relationshipCreatePayloadSchema.parse({
          person1Id,
          person2Id,
          relationshipType,
          parentKind: relationshipType === "parent" ? parentKind : null,
          spouseStatus: relationshipType === "spouse" ? "current" : null,
          confidence: "confirmed",
        });
        await submitFamilyChangeProposal({
          proposalType: "relationship_create",
          targetPersonId: person1Id,
          payload,
          reason: reason.trim() || null,
        });
      } else {
        const payload = relationshipUpdatePayloadSchema.parse({
          relationshipId: person1Id,
          changes: {
            parentKind,
            notes: reason.trim() || null,
          },
        });
        await submitFamilyChangeProposal({
          proposalType: "relationship_update",
          targetRelationshipId: person1Id,
          payload,
          reason: reason.trim() || null,
        });
      }
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === "create" ? "bg-[#2D4A3E] text-white" : "bg-[#FAF7F1]"}`}
        >
          Новая связь
        </button>
        <button
          type="button"
          onClick={() => setMode("update")}
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === "update" ? "bg-[#2D4A3E] text-white" : "bg-[#FAF7F1]"}`}
        >
          Исправить связь
        </button>
      </div>

      {mode === "create" ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Человек 1</span>
            <select
              value={person1Id}
              onChange={(e) => setPerson1Id(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            >
              {people.map((item) => (
                <option key={item.id} value={item.id}>
                  {getFullName(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Человек 2</span>
            <select
              value={person2Id}
              onChange={(e) => setPerson2Id(e.target.value)}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            >
              <option value="">Выберите</option>
              {people.map((item) => (
                <option key={item.id} value={item.id}>
                  {getFullName(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Тип связи</span>
            <select
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as "parent" | "spouse")
              }
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            >
              <option value="parent">Родитель → ребёнок</option>
              <option value="spouse">Супруги</option>
            </select>
          </label>
          {relationshipType === "parent" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Тип родства</span>
              <select
                value={parentKind}
                onChange={(e) =>
                  setParentKind(
                    e.target.value as
                      | "biological"
                      | "adoptive"
                      | "step"
                      | "guardian",
                  )
                }
                className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
              >
                <option value="biological">Биологический</option>
                <option value="adoptive">Усыновление</option>
                <option value="step">Отчим/мачеха</option>
                <option value="guardian">Опекун</option>
              </select>
            </label>
          ) : null}
        </>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">ID связи (UUID)</span>
          <input
            value={person1Id}
            onChange={(e) => setPerson1Id(e.target.value)}
            className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2 font-mono text-xs"
            placeholder="UUID связи из админ-панели"
          />
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Комментарий</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
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
