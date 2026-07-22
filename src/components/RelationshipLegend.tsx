"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

import { OrganicTreeLegend } from "@/components/family/OrganicTreeLegend";
import type { TreeVisualMode } from "@/lib/heritage-theme";

function DiagramLegendContent() {
  return (
    <ul className="space-y-3 text-sm text-[#2D4A3E]">
      <li className="flex items-center gap-3">
        <span className="h-0 w-10 border-t-2 border-solid border-[#7E9186]" />
        <span>Родной родитель</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="h-0 w-10 border-t-2 border-dashed border-[#7E9186]" />
        <span>Усыновление</span>
      </li>
      <li className="flex items-center gap-3">
        <span
          className="h-0 w-10 border-t-2 border-[#A8B5AD]"
          style={{ borderStyle: "dotted" }}
        />
        <span>Отчим / мачеха</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="h-0 w-8 border-t-2 border-dashed border-[#7E9186]" />
          <span className="text-[10px] text-[#6B776F]">опека</span>
        </span>
        <span>Опека</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="h-0 w-10 border-t-2 border-solid border-[#7E9186]" />
        <span>Супруги</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="h-0 w-10 border-t-2 border-solid border-[#A8B5AD]" />
        <span>Бывшие супруги</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="h-0 w-8 border-t-2 border-dashed border-[#7E9186]" />
          <span className="text-[10px] text-[#6B776F]">?</span>
        </span>
        <span>Неподтверждённая связь</span>
      </li>
    </ul>
  );
}

interface RelationshipLegendProps {
  visualMode?: TreeVisualMode;
}

export function RelationshipLegend({
  visualMode = "diagram",
}: RelationshipLegendProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const content =
    visualMode === "heritage" ? (
      <OrganicTreeLegend />
    ) : (
      <DiagramLegendContent />
    );

  const panel =
    mounted && open
      ? createPortal(
          isMobile ? (
            <div className="fixed inset-0 z-[240] flex flex-col justify-end">
              <button
                type="button"
                className="absolute inset-0 bg-[#1B4332]/25"
                aria-label="Закрыть легенду"
                onClick={() => setOpen(false)}
              />
              <div className="relative rounded-t-2xl border border-[#E0D6C6] bg-[#FFFCF8] p-5 shadow-[0_-8px_28px_rgba(45,74,62,0.14)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1B4332]">
                    Типы связей
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-2 text-[#5C6B63] hover:bg-[#F3EDE3]"
                    aria-label="Закрыть"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {content}
              </div>
            </div>
          ) : (
            <div className="fixed bottom-5 left-20 z-[230] w-72 rounded-2xl border border-[#E0D6C6] bg-[#FFFCF8]/96 p-4 shadow-[0_10px_28px_rgba(45,74,62,0.12)] backdrop-blur-md sm:left-24">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1B4332]">
                  Типы связей
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[#5C6B63] hover:bg-[#F3EDE3]"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {content}
            </div>
          ),
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="absolute top-4 right-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E0D6C6] bg-[#FFFCF8]/95 px-3 text-sm font-medium text-[#2D4A3E] shadow-[0_4px_14px_rgba(45,74,62,0.08)] backdrop-blur-sm transition hover:border-[#C4A962] sm:top-5 sm:right-5"
        aria-expanded={open}
      >
        <Info className="h-4 w-4" />
        Типы связей
      </button>
      {panel}
    </>
  );
}
