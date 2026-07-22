"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/permissions";
import {
  adminSetUserRole,
  ProposalServiceError,
} from "@/services/family-proposal-service";
import type { AdminUserListItem } from "@/types/family-proposal";

const ADMIN_CONFIRM = "НАЗНАЧИТЬ АДМИНИСТРАТОРОМ";

interface UserRoleDialogProps {
  user: AdminUserListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function UserRoleDialog({
  user,
  isOpen,
  onClose,
  onSaved,
}: UserRoleDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>("relative");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setConfirmText("");
      setError(null);
    }
  }, [user]);

  if (!isOpen || !mounted || !user) return null;

  const needsAdminConfirm = role === "admin" && user.role !== "admin";
  const canSave =
    !isSubmitting && (!needsAdminConfirm || confirmText.trim() === ADMIN_CONFIRM);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await adminSetUserRole(user.userId, role);
      onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof ProposalServiceError
          ? saveError.message
          : "Не удалось изменить роль",
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
        className="relative z-10 w-full max-w-md rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
          Изменить роль
        </h2>
        <p className="mt-1 text-sm text-[#5C6B63]">{user.email}</p>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">Роль</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
          >
            <option value="relative">Родственник</option>
            <option value="editor">Редактор</option>
            <option value="admin">Администратор</option>
          </select>
        </label>

        {needsAdminConfirm ? (
          <div className="mt-3 space-y-2 rounded-xl border border-[#E8C9C0] bg-[#FBF4F1] p-3 text-sm text-[#7A3E32]">
            <p>
              Администратор сможет редактировать и удалять людей, управлять ролями и выполнять импорт.
            </p>
            <label className="block">
              <span className="mb-1 block font-medium">
                Введите {ADMIN_CONFIRM}
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-xl border border-[#D9D0C3] px-3 py-2"
              />
            </label>
          </div>
        ) : null}

        {user.role === "admin" && role !== "admin" ? (
          <p className="mt-3 text-sm text-[#7A3E32]">
            Понижение администратора ограничено защитой последнего admin.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border px-4 text-sm">
            Отмена
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="min-h-11 flex-1 rounded-xl border border-[#2D4A3E] bg-[#2D4A3E] px-4 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? "Сохранение…" : `Сохранить (${roleLabel(role)})`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
