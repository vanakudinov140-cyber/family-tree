"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";

interface FamilyLoadingStateProps {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function FamilyLoadingState({
  isLoading,
  error,
  onRetry,
}: FamilyLoadingStateProps) {
  if (!isLoading && !error) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F3EDE3]/88 backdrop-blur-[2px]">
      <div className="mx-4 max-w-sm rounded-2xl border border-[#E0D6C6] bg-[#FFFCF8] px-6 py-5 text-center shadow-[0_12px_28px_rgba(45,74,62,0.12)]">
        {isLoading ? (
          <>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#2D4A3E]" />
            <p className="mt-3 text-sm font-medium text-[#1B4332]">
              Загружаем семейное дерево…
            </p>
            <p className="mt-1 text-xs text-[#6B776F]">
              Подготавливаем карточки и связи
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[#1B4332]">
              Не удалось загрузить данные
            </p>
            <p className="mt-2 text-xs leading-5 text-[#6B776F]">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2D4A3E] px-4 py-2.5 text-sm font-medium text-[#F5F0E8] transition hover:bg-[#1B4332]"
            >
              <RefreshCw className="h-4 w-4" />
              Повторить загрузку
            </button>
          </>
        )}
      </div>
    </div>
  );
}
