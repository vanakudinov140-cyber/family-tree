"use client";

import type { TreeVisualMode } from "@/lib/heritage-theme";

interface TreeVisualModeSwitchProps {
  value: TreeVisualMode;
  onChange: (mode: TreeVisualMode) => void;
  compact?: boolean;
}

const OPTIONS: Array<{
  value: TreeVisualMode;
  label: string;
  title: string;
}> = [
  {
    value: "heritage",
    label: "Дерево",
    title: "Премиальный вид семейного дерева",
  },
  {
    value: "diagram",
    label: "Схема",
    title: "Техническая схема связей",
  },
];

export function TreeVisualModeSwitch({
  value,
  onChange,
  compact = false,
}: TreeVisualModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Визуальный режим дерева"
      className={[
        "flex gap-0.5 rounded-xl border border-[#E0D6C6] bg-[#FFFCF8]/95 p-0.5 shadow-[0_4px_14px_rgba(45,74,62,0.08)] backdrop-blur-sm",
        compact ? "text-[11px]" : "text-xs",
      ].join(" ")}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-lg px-2.5 py-1.5 font-medium transition",
              selected
                ? "bg-[var(--heritage-green,#2D4A3E)] text-[#F5F0E8]"
                : "text-[#2D4A3E] hover:bg-[#F3EDE3]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
