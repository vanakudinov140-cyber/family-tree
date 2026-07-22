"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PersonProfileModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  personId?: string | null;
}

export function PersonProfileModal({
  isOpen,
  title,
  onClose,
  children,
  personId = null,
}: PersonProfileModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#1B4332]/40 backdrop-blur-[1px]"
        aria-label="Закрыть фон полного профиля"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-person-id={personId ?? undefined}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-[#EDE8DF] px-4 py-3">
          <h2
            id={titleId}
            className="text-lg font-semibold text-[#1B4332]"
          >
            {title}
          </h2>
          <button
            type="button"
            className="nodrag nopan flex h-10 w-10 items-center justify-center rounded-full text-[#2D4A3E] hover:bg-[#F3EEE4]"
            aria-label="Закрыть полный профиль"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
