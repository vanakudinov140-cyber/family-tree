"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { ProposalDetails } from "@/components/collaboration/ProposalDetails";
import {
  proposalTypeLabel,
  ProposalStatusBadge,
} from "@/components/collaboration/ProposalStatusBadge";
import { useFamilyData } from "@/context/FamilyDataContext";
import {
  cancelMyFamilyChangeProposal,
  listMyFamilyChangeProposals,
  ProposalServiceError,
  resubmitFamilyChangeProposal,
} from "@/services/family-proposal-service";
import type { FamilyChangeProposal } from "@/types/family-proposal";

interface MyProposalsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyProposalsDialog({ isOpen, onClose }: MyProposalsDialogProps) {
  const titleId = useId();
  const { people } = useFamilyData();
  const [mounted, setMounted] = useState(false);
  const [proposals, setProposals] = useState<FamilyChangeProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseComment, setResponseComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await listMyFamilyChangeProposals();
      setProposals(items);
    } catch (loadError) {
      setError(
        loadError instanceof ProposalServiceError
          ? loadError.message
          : "Не удалось загрузить предложения",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const selected = proposals.find((item) => item.id === selectedId) ?? null;

  const handleCancel = async (proposalId: string) => {
    setIsSubmitting(true);
    try {
      await cancelMyFamilyChangeProposal(proposalId);
      await load();
      setSelectedId(null);
    } catch (cancelError) {
      setError(
        cancelError instanceof ProposalServiceError
          ? cancelError.message
          : "Не удалось отменить предложение",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await resubmitFamilyChangeProposal({
        proposalId: selected.id,
        newPayload: selected.payload,
        responseComment: responseComment.trim() || null,
      });
      setResponseComment("");
      await load();
    } catch (resubmitError) {
      setError(
        resubmitError instanceof ProposalServiceError
          ? resubmitError.message
          : "Не удалось отправить уточнение",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

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
        className="relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#EDE8DF] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
            Мои предложения
          </h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm">
            Закрыть
          </button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-2">
          <div className="overflow-y-auto border-r border-[#EDE8DF] p-4">
            {isLoading ? <p className="text-sm text-[#5C6B63]">Загрузка…</p> : null}
            {error ? (
              <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              {proposals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedId === item.id
                      ? "border-[#C4A962] bg-[#FAF7F1]"
                      : "border-[#E4DDD1] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{proposalTypeLabel(item.proposalType)}</span>
                    <ProposalStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#6B776F]">
                    {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </p>
                </button>
              ))}
              {!isLoading && proposals.length === 0 ? (
                <p className="text-sm text-[#5C6B63]">Пока нет предложений.</p>
              ) : null}
            </div>
          </div>

          <div className="overflow-y-auto p-4">
            {selected ? (
              <>
                <ProposalDetails proposal={selected} people={people} />
                {selected.status === "pending" || selected.status === "needs_info" ? (
                  <div className="mt-4 space-y-2">
                    {selected.status === "needs_info" ? (
                      <>
                        <textarea
                          value={responseComment}
                          onChange={(e) => setResponseComment(e.target.value)}
                          rows={3}
                          placeholder="Ответ на запрос уточнения"
                          className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleResubmit()}
                          className="min-h-10 w-full rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-3 text-sm text-white"
                        >
                          Отправить уточнение
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleCancel(selected.id)}
                      className="min-h-10 w-full rounded-xl border border-[#D9D0C3] px-3 text-sm"
                    >
                      Отменить предложение
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[#5C6B63]">Выберите предложение слева.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
