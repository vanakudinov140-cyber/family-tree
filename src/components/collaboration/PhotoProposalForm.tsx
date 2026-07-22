"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Area } from "react-easy-crop";

import { PhotoCropper } from "@/components/family/PhotoCropper";
import {
  PhotoProcessingError,
  loadImageForCrop,
  preparePersonPhoto,
} from "@/lib/image-processing";
import { photoReplacePayloadSchema } from "@/lib/family-proposal-schema";
import { useAuth } from "@/context/AuthContext";
import {
  ProposalServiceError,
  submitFamilyChangeProposal,
} from "@/services/family-proposal-service";
import {
  removeProposalPhoto,
  uploadProposalPhoto,
} from "@/services/proposal-photo-service";
import type { Person } from "@/types/family";

interface PhotoProposalFormProps {
  person: Person;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function PhotoProposalForm({
  person,
  onSubmitted,
  onCancel,
}: PhotoProposalFormProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState<Area | null>(null);
  const [reason, setReason] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sourceFileRef = useRef<File | null>(null);

  const clearObjectUrl = useCallback(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }, [objectUrl]);

  useEffect(() => () => clearObjectUrl(), [clearObjectUrl]);

  const acceptFile = async (file: File) => {
    setError(null);
    try {
      const loaded = await loadImageForCrop(file);
      clearObjectUrl();
      sourceFileRef.current = file;
      setObjectUrl(loaded.objectUrl);
      setCropArea(null);
    } catch (loadError) {
      setError(
        loadError instanceof PhotoProcessingError
          ? loadError.message
          : "Не удалось прочитать изображение",
      );
    }
  };

  const handleSubmit = async () => {
    if (!user || !sourceFileRef.current || !cropArea || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    let uploadedPath: string | null = null;

    try {
      const prepared = await preparePersonPhoto(sourceFileRef.current, cropArea);
      uploadedPath = await uploadProposalPhoto(
        user.id,
        prepared.blob,
        prepared.extension,
      );

      const payload = photoReplacePayloadSchema.parse({
        proposalPhotoPath: uploadedPath,
      });

      await submitFamilyChangeProposal({
        proposalType: "photo_replace",
        targetPersonId: person.id,
        payload,
        reason: reason.trim() || null,
        sourceNote: sourceNote.trim() || null,
      });

      onSubmitted();
    } catch (submitError) {
      if (uploadedPath) {
        await removeProposalPhoto(uploadedPath);
      }
      setError(
        submitError instanceof ProposalServiceError ||
          submitError instanceof PhotoProcessingError
          ? submitError.message
          : "Не удалось отправить предложение",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file);
        }}
      />

      {!objectUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-11 w-full rounded-xl border border-dashed border-[#C4A962] bg-[#FAF7F1] px-4 text-sm"
        >
          Выбрать фотографию
        </button>
      ) : (
        <PhotoCropper
          imageSrc={objectUrl}
          onCropComplete={setCropArea}
          disabled={isSubmitting}
        />
      )}

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
          disabled={isSubmitting || !cropArea}
          onClick={() => void handleSubmit()}
          className="min-h-11 flex-1 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm text-[#F5F0E8]"
        >
          {isSubmitting ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}
