"use client";

import type { RelationKind } from "@/lib/supabase/types";

const OPTIONS: Array<{
  kind: RelationKind;
  label: string;
  description: string;
}> = [
  {
    kind: "father",
    label: "Отец",
    description: "Новый человек — отец выбранного родственника",
  },
  {
    kind: "mother",
    label: "Мать",
    description: "Новый человек — мать выбранного родственника",
  },
  {
    kind: "spouse",
    label: "Супруг / супруга",
    description: "Создать супружескую связь",
  },
  {
    kind: "child",
    label: "Сын / дочь",
    description: "Выбранный человек станет родителем",
  },
  {
    kind: "sibling",
    label: "Брат / сестра",
    description: "Те же родители, что у выбранного человека",
  },
];

interface RelativeTypeSelectorProps {
  value: RelationKind | null;
  onChange: (kind: RelationKind) => void;
  disabled?: boolean;
}

export function RelativeTypeSelector({
  value,
  onChange,
  disabled = false,
}: RelativeTypeSelectorProps) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-[#1B4332]">
        Кем новый человек приходится выбранному родственнику?
      </p>
      {OPTIONS.map((option) => {
        const selected = value === option.kind;
        return (
          <button
            key={option.kind}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.kind)}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition",
              selected
                ? "border-[#2D4A3E] bg-[#2D4A3E] text-[#F5F0E8]"
                : "border-[#D9D0C3] bg-[#FAF7F1] text-[#2D4A3E] hover:border-[#C4A962]",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span
              className={[
                "mt-0.5 block text-xs",
                selected ? "text-[#E8DFD0]" : "text-[#6B776F]",
              ].join(" ")}
            >
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
