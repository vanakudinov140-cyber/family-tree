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
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.dataset.mobileProfileSheet = "1";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      delete document.documentElement.dataset.mobileProfileSheet;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[600] md:hidden">
      <button
        type="button"
        aria-label="Закрыть панель"
        className="absolute inset-0 bg-[#1B4332]/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Профиль"
        className="mobile-profile-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-2xl animate-slide-up"
        onTouchMove={(event) => {
          // Keep React Flow / page from receiving the gesture; do not preventDefault.
          event.stopPropagation();
        }}
      >
        <div className="relative z-10 flex shrink-0 items-center justify-center border-b border-[#EDE8DF] bg-[#FFFCF7] px-4 py-3">
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
        <div
          data-profile-scroll="sheet"
          className="mobile-profile-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y pb-[calc(24px+env(safe-area-inset-bottom,0px))]"
          onTouchMove={(event) => {
            event.stopPropagation();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
