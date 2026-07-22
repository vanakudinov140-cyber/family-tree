"use client";

import {
  Expand,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  PanelTop,
  Plus,
  Scan,
  UnfoldVertical,
  UserRound,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { TreeVisualModeSwitch } from "@/components/family/TreeVisualModeSwitch";
import type { TreeVisualMode } from "@/lib/heritage-theme";
import type { TreeViewMode } from "@/lib/tree-visibility";

interface TreeToolbarProps {
  viewMode: TreeViewMode;
  /** Always fires, including when the mode is already active. */
  onModeActivate: (mode: TreeViewMode) => void;
  visualMode: TreeVisualMode;
  onVisualModeChange: (mode: TreeVisualMode) => void;
  focusLabel: string | null;
  focusLabelShort: string | null;
  modeCounts?: {
    nearby: number;
    generations: number;
    branch: number;
    all: number;
  } | null;
  shownCount?: number | null;
  totalCount?: number | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onCenterFocused: () => void;
  onFocusNearby: () => void;
  onExpandAll: () => void;
  hasCollapsedBranches: boolean;
  onToggleFullscreen: () => void;
  onToggleTreeOnly: () => void;
  isFullscreen: boolean;
  isTreeOnly: boolean;
  showMiniMapToggle?: boolean;
  miniMapVisible?: boolean;
  onToggleMiniMap?: () => void;
}

const MODE_OPTIONS: Array<{
  value: TreeViewMode;
  label: string;
  mobileLabel: string;
  title: string;
}> = [
  {
    value: "nearby",
    label: "Ближайшие",
    mobileLabel: "Близкие",
    title: "Показать ближайших родственников выбранного человека",
  },
  {
    value: "generations",
    label: "3 поколения",
    mobileLabel: "3 пок.",
    title: "Родители, человек с супругами и братьями/сёстрами, дети",
  },
  {
    value: "branch",
    label: "Вся ветка",
    mobileLabel: "Ветка",
    title: "Все предки и потомки выбранного человека без ограничения глубины",
  },
  {
    value: "all",
    label: "Вся семья",
    mobileLabel: "Все",
    title: "Показать всё семейное дерево",
  },
];

const chipClassName =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9D0C3] bg-[#FFFCF8] text-[#1F332A] shadow-[0_2px_10px_rgba(31,51,42,0.1)] transition hover:border-[#C4A962] hover:bg-[#F7F3ED] active:scale-95";

export function TreeToolbar({
  viewMode,
  onModeActivate,
  visualMode,
  onVisualModeChange,
  focusLabel,
  focusLabelShort,
  modeCounts = null,
  shownCount = null,
  totalCount = null,
  onZoomIn,
  onZoomOut,
  onFitView,
  onCenterFocused,
  onFocusNearby,
  onExpandAll,
  hasCollapsedBranches,
  onToggleFullscreen,
  onToggleTreeOnly,
  isFullscreen,
  isTreeOnly,
  showMiniMapToggle = false,
  miniMapVisible = false,
  onToggleMiniMap,
}: TreeToolbarProps) {
  const modeGroupId = useId();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modeMenuOpen]);

  const currentModeOption = MODE_OPTIONS.find(
    (option) => option.value === viewMode,
  );
  const currentModeCount =
    modeCounts == null
      ? null
      : viewMode === "nearby"
        ? modeCounts.nearby
        : viewMode === "generations"
          ? modeCounts.generations
          : viewMode === "branch"
            ? modeCounts.branch
            : modeCounts.all;
  const currentModeLabel =
    currentModeOption == null
      ? "Режим"
      : currentModeCount == null
        ? currentModeOption.mobileLabel
        : `${currentModeOption.mobileLabel} · ${currentModeCount}`;

  const showFocusHint =
    viewMode === "nearby" ||
    viewMode === "generations" ||
    viewMode === "branch";

  return (
    <div className="tree-toolbar pointer-events-none absolute inset-0 z-20">
      {/* Top-left: visual mode + view modes — height fits content only */}
      <div className="absolute top-3 left-3 flex max-w-[min(100%-1.5rem,420px)] flex-col items-start gap-1.5 sm:top-4 sm:left-4">
        <div className="pointer-events-auto w-fit">
          <TreeVisualModeSwitch
            value={visualMode}
            onChange={onVisualModeChange}
            compact
          />
        </div>

        <div className="pointer-events-auto hidden w-fit rounded-2xl border border-[#D9D0C3] bg-[#FFFCF8]/96 p-1 shadow-[0_4px_16px_rgba(31,51,42,0.1)] backdrop-blur-md sm:block">
          <div
            role="group"
            aria-label="Режим просмотра дерева"
            id={modeGroupId}
            className="flex flex-wrap gap-0.5"
          >
            {MODE_OPTIONS.map((option) => {
              const selected = viewMode === option.value;
              const count =
                modeCounts == null
                  ? null
                  : option.value === "nearby"
                    ? modeCounts.nearby
                    : option.value === "generations"
                      ? modeCounts.generations
                      : option.value === "branch"
                        ? modeCounts.branch
                        : modeCounts.all;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  title={option.title}
                  onClick={() => onModeActivate(option.value)}
                  className={[
                    "rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition",
                    selected
                      ? "bg-[#1F332A] text-[#F5F0E8]"
                      : "text-[#1F332A] hover:bg-[#F0EBE3]",
                  ].join(" ")}
                >
                  {count == null ? option.label : `${option.label} · ${count}`}
                </button>
              );
            })}
          </div>
          {shownCount != null && totalCount != null ? (
            <p className="mt-1 max-w-[280px] truncate px-1.5 pb-0.5 text-[10px] text-[#4F5F56]">
              Показано {shownCount} из {totalCount} человек
            </p>
          ) : null}
          {showFocusHint && focusLabel ? (
            <p
              className="mt-1 max-w-[280px] truncate px-1.5 pb-0.5 text-[10px] text-[#4F5F56]"
              title={focusLabel}
            >
              Центр: {focusLabel}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-auto relative w-fit sm:hidden">
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 rounded-xl border border-[#D9D0C3] bg-[#FFFCF8]/96 px-3 text-sm font-medium text-[#1F332A] shadow-[0_2px_10px_rgba(31,51,42,0.1)]"
            aria-expanded={modeMenuOpen}
            aria-haspopup="listbox"
            title="Режим просмотра"
            onClick={() => setModeMenuOpen((current) => !current)}
          >
            {currentModeLabel}
          </button>
          {showFocusHint && focusLabelShort ? (
            <p
              className="mt-1 max-w-[160px] truncate px-1 text-[10px] text-[#4F5F56]"
              title={focusLabel ?? undefined}
            >
              Центр: {focusLabelShort}
            </p>
          ) : null}
          {modeMenuOpen ? (
            <div
              role="listbox"
              aria-label="Режим просмотра"
              className="absolute top-full left-0 z-30 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-[#D9D0C3] bg-[#FFFCF8] shadow-lg"
            >
              {MODE_OPTIONS.map((option) => {
                const count =
                  modeCounts == null
                    ? null
                    : option.value === "nearby"
                      ? modeCounts.nearby
                      : option.value === "generations"
                        ? modeCounts.generations
                        : option.value === "branch"
                          ? modeCounts.branch
                          : modeCounts.all;
                return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={viewMode === option.value}
                  title={option.title}
                  className="block w-full px-3 py-2.5 text-left text-sm text-[#1F332A] hover:bg-[#F0EBE3]"
                  onClick={() => {
                    onModeActivate(option.value);
                    setModeMenuOpen(false);
                  }}
                >
                  {count == null
                    ? option.mobileLabel
                    : `${option.mobileLabel} · ${count}`}
                </button>
              );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom-left: compact action chips — no tall empty plate */}
      <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1.5 sm:bottom-4 sm:left-4">
        <div className="pointer-events-auto flex w-fit flex-col gap-1 rounded-2xl border border-[#D9D0C3] bg-[#FFFCF8]/96 p-1 shadow-[0_4px_16px_rgba(31,51,42,0.1)] backdrop-blur-md">
          <button
            type="button"
            onClick={onZoomIn}
            className={chipClassName}
            aria-label="Увеличить"
            title="Увеличить"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            className={chipClassName}
            aria-label="Уменьшить"
            title="Уменьшить"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        <div className="pointer-events-auto flex w-fit flex-col gap-1 rounded-2xl border border-[#D9D0C3] bg-[#FFFCF8]/96 p-1 shadow-[0_4px_16px_rgba(31,51,42,0.1)] backdrop-blur-md">
          <button
            type="button"
            onClick={onCenterFocused}
            className={chipClassName}
            aria-label="Показать центр"
            title="Показать центр"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onFocusNearby}
            className={chipClassName}
            aria-label="Ближайшие вокруг центра"
            title="Ближайшие"
          >
            <UserRound className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onFitView}
            className={chipClassName}
            aria-label="Обзор дерева"
            title="Обзор дерева"
          >
            <Scan className="h-4 w-4" />
          </button>
        </div>

        <div className="pointer-events-auto flex w-fit flex-col gap-1 rounded-2xl border border-[#D9D0C3] bg-[#FFFCF8]/96 p-1 shadow-[0_4px_16px_rgba(31,51,42,0.1)] backdrop-blur-md">
          {hasCollapsedBranches ? (
            <button
              type="button"
              onClick={onExpandAll}
              className={chipClassName}
              aria-label="Развернуть все ветки"
              title="Развернуть все"
            >
              <UnfoldVertical className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleTreeOnly}
            className={chipClassName}
            aria-label={isTreeOnly ? "Показать интерфейс" : "Только дерево"}
            title={isTreeOnly ? "Показать интерфейс" : "Только дерево"}
          >
            {isTreeOnly ? (
              <PanelTop className="h-4 w-4" />
            ) : (
              <Expand className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={chipClassName}
            aria-label={
              isFullscreen
                ? "Выйти из полноэкранного режима"
                : "Полноэкранный режим"
            }
            title={
              isFullscreen
                ? "Выйти из полноэкранного режима"
                : "Полноэкранный режим"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          {onToggleMiniMap ? (
            <button
              type="button"
              onClick={onToggleMiniMap}
              className={chipClassName}
              aria-label={
                miniMapVisible ? "Скрыть мини-карту" : "Показать мини-карту"
              }
              title={miniMapVisible ? "Скрыть мини-карту" : "Мини-карта"}
              aria-pressed={miniMapVisible}
            >
              <span className="text-[9px] font-semibold">карта</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
