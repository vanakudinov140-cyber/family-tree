"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { ProposalDiff } from "@/components/admin/ProposalDiff";
import { proposalTypeLabel } from "@/components/collaboration/ProposalStatusBadge";
import { useFamilyData } from "@/context/FamilyDataContext";
import {
  approvePhotoChangeProposal,
  ProposalServiceError,
  reviewFamilyChangeProposal,
} from "@/services/family-proposal-service";
import {
  downloadProposalPhotoBlob,
  getSignedProposalPhotoUrl,
  removeProposalPhoto,
} from "@/services/proposal-photo-service";
import {
  removeStoredPhoto,
  uploadPersonPhoto,
} from "@/services/person-photo-service";
import type { AdminProposalListItem } from "@/types/family-proposal";

interface ProposalReviewDialogProps {
  proposal: AdminProposalListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewed: () => void;
}

export function ProposalReviewDialog({
  proposal,
  isOpen,
  onClose,
  onReviewed,
}: ProposalReviewDialogProps) {
  const titleId = useId();
  const { people, reload } = useFamilyData();
  const [mounted, setMounted] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!proposal || proposal.proposalType !== "photo_replace") {
      setPhotoPreviewUrl(null);
      return;
    }
    const path =
      proposal.payload &&
      typeof proposal.payload === "object" &&
      "proposalPhotoPath" in proposal.payload &&
      typeof proposal.payload.proposalPhotoPath === "string"
        ? proposal.payload.proposalPhotoPath
        : null;
    if (!path) return;
    void getSignedProposalPhotoUrl(path).then(setPhotoPreviewUrl);
  }, [proposal]);

  if (!isOpen || !mounted || !proposal) return null;

  const targetPerson = proposal.targetPersonId
    ? people.find((item) => item.id === proposal.targetPersonId)
    : null;

  const isDangerous =
    proposal.proposalType === "relationship_create" ||
    proposal.proposalType === "relationship_update" ||
    proposal.proposalType === "person_create";

  const handleReview = async (action: "approve" | "reject" | "request_info") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setWarning(null);

    try {
      if (proposal.proposalType === "photo_replace" && action === "approve") {
        if (!proposal.targetPersonId) {
          throw new ProposalServiceError("Не указан человек для фотографии");
        }
        const photoPath =
          proposal.payload &&
          typeof proposal.payload === "object" &&
          "proposalPhotoPath" in proposal.payload &&
          typeof proposal.payload.proposalPhotoPath === "string"
            ? proposal.payload.proposalPhotoPath
            : null;
        if (!photoPath) {
          throw new ProposalServiceError("Некорректное предложение фотографии");
        }

        const blob = await downloadProposalPhotoBlob(photoPath);
        const uploadedPath = await uploadPersonPhoto(
          proposal.targetPersonId,
          blob,
          "webp",
        );

        try {
          const result = await approvePhotoChangeProposal({
            proposalId: proposal.id,
            officialPhotoPath: uploadedPath,
            adminComment: adminComment.trim() || null,
          });
          if (result.previousPhotoPath) {
            const removed = await removeStoredPhoto(result.previousPhotoPath);
            if (!removed) {
              setWarning(
                "Фотография принята, но старый официальный файл не удалось удалить",
              );
            }
          }
        } catch (approveError) {
          await removeStoredPhoto(uploadedPath);
          throw approveError;
        }

        await removeProposalPhoto(photoPath);
        await reload();
        onReviewed();
        onClose();
        return;
      }

      await reviewFamilyChangeProposal({
        proposalId: proposal.id,
        action,
        adminComment: adminComment.trim() || null,
        confirmDuplicates,
      });

      if (action === "reject" && proposal.proposalType === "photo_replace") {
        const photoPath =
          proposal.payload &&
          typeof proposal.payload === "object" &&
          "proposalPhotoPath" in proposal.payload &&
          typeof proposal.payload.proposalPhotoPath === "string"
            ? proposal.payload.proposalPhotoPath
            : null;
        if (photoPath) {
          const removed = await removeProposalPhoto(photoPath);
          if (!removed) {
            setWarning("Предложение отклонено, но файл предложения остался в Storage");
          }
        }
      }

      if (action === "approve") {
        await reload();
      }
      onReviewed();
      onClose();
    } catch (reviewError) {
      setError(
        reviewError instanceof ProposalServiceError
          ? reviewError.message
          : "Не удалось обработать предложение",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialog = (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-[#1B4332]/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
      >
        <div className="border-b border-[#EDE8DF] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
            {proposalTypeLabel(proposal.proposalType)}
          </h2>
          <p className="mt-1 text-sm text-[#5C6B63]">
            {proposal.submitterEmail ?? "Автор"} · {proposal.submitterName ?? ""}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isDangerous ? (
            <p className="rounded-xl border border-[#E8C9C0] bg-[#FBF4F1] px-3 py-2 text-sm text-[#7A3E32]">
              Внимание: изменение родственной связи. Проверьте тип родства и участников.
            </p>
          ) : null}

          {photoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreviewUrl}
              alt="Предложенная фотография"
              className="mx-auto h-40 w-40 rounded-full object-cover"
            />
          ) : null}

          <ProposalDiff
            before={targetPerson ?? {}}
            after={proposal.payload}
            afterLabel="Предложение"
          />

          {proposal.reason ? (
            <p className="text-sm text-[#2D4A3E]">
              <span className="font-medium">Комментарий:</span> {proposal.reason}
            </p>
          ) : null}

          {proposal.proposalType === "person_create" ? (
            <label className="flex items-center gap-2 text-sm text-[#2D4A3E]">
              <input
                type="checkbox"
                checked={confirmDuplicates}
                onChange={(e) => setConfirmDuplicates(e.target.checked)}
              />
              Подтверждаю создание при возможном совпадении ФИО
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Комментарий администратора</span>
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
            />
          </label>

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

        <div className="grid grid-cols-1 gap-2 border-t border-[#EDE8DF] px-5 py-4 sm:grid-cols-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleReview("request_info")}
            className="min-h-11 rounded-xl border border-[#D9D0C3] px-3 text-sm"
          >
            Уточнить
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleReview("reject")}
            className="min-h-11 rounded-xl border border-[#E8C9C0] bg-[#FBF4F1] px-3 text-sm text-[#7A3E32]"
          >
            Отклонить
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleReview("approve")}
            className="min-h-11 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-3 text-sm text-white"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
