"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { AdminAuditLogTab } from "@/components/admin/AdminAuditLogTab";
import { AdminProposalsTab } from "@/components/admin/AdminProposalsTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";

type AdminTab = "proposals" | "users" | "audit";

interface AdminCollaborationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminCollaborationDialog({
  isOpen,
  onClose,
}: AdminCollaborationDialogProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<AdminTab>("proposals");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const dialog = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-[#1B4332]/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#EDE8DF] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[#1B4332]">
            Администрирование
          </h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm">
            Закрыть
          </button>
        </div>

        <div className="flex gap-2 border-b border-[#EDE8DF] px-5 py-3">
          {(
            [
              ["proposals", `Предложения${pendingCount > 0 ? ` (${pendingCount})` : ""}`],
              ["users", "Пользователи"],
              ["audit", "Журнал"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-3 py-2 text-sm ${
                tab === key
                  ? "bg-[#2D4A3E] text-white"
                  : "border border-[#D9D0C3] bg-white text-[#2D4A3E]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "proposals" ? (
            <AdminProposalsTab onPendingCountChange={setPendingCount} />
          ) : null}
          {tab === "users" ? <AdminUsersTab /> : null}
          {tab === "audit" ? <AdminAuditLogTab /> : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
