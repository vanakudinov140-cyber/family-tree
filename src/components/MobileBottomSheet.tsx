"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  children,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Закрыть панель"
        className="absolute inset-0 bg-[#1B4332]/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl animate-slide-up">
        <div className="sticky top-0 z-10 flex items-center justify-center border-b border-[#EDE8DF] bg-[#FFFCF7] px-4 py-3">
          <span className="h-1.5 w-12 rounded-full bg-[#D9D0C3]" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full text-[#2D4A3E] transition hover:bg-[#F3EEE4]"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto pb-8">{children}</div>
      </div>
    </div>
  );
}
