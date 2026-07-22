function BotanicalLegendItem({
  label,
  accent = "#6D5540",
}: {
  label: string;
  accent?: string;
}) {
  return (
    <li className="flex items-center gap-3 text-sm text-[#233328]">
      <svg width="44" height="18" viewBox="0 0 44 18" aria-hidden>
        <path
          d="M2 14 C 14 3, 30 3, 42 14"
          fill="none"
          stroke={accent}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
    </li>
  );
}

export function OrganicTreeLegend() {
  return (
    <ul className="space-y-2.5">
      <BotanicalLegendItem label="Корни и ствол — старшие поколения" accent="#5C4A38" />
      <BotanicalLegendItem label="Ветви — линии семьи и братьев" accent="#7A6550" />
      <BotanicalLegendItem label="Крона — младшие поколения" accent="#8FA87A" />
      <li className="flex items-center gap-3 text-sm text-[#233328]">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#D4B87A] bg-[#FFF9F0] text-[10px] font-semibold text-[#5C4A38]"
          aria-hidden
        >
          АБ
        </span>
        <span>Медальон — портрет и имя человека</span>
      </li>
      <li className="flex items-center gap-3 text-sm text-[#233328]">
        <svg width="44" height="18" viewBox="0 0 44 18" aria-hidden>
          <circle cx="14" cy="9" r="6" fill="#FFF9F0" stroke="#B48D48" strokeWidth="1.5" />
          <circle cx="30" cy="9" r="6" fill="#FFF9F0" stroke="#B48D48" strokeWidth="1.5" />
          <circle cx="22" cy="9" r="2" fill="#B48D48" />
        </svg>
        <span>Знак между медальонами — супруги</span>
      </li>
      <li className="flex items-center gap-3 text-sm text-[#233328]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#B5C9A0] bg-[#FFF9F0]/95 px-2 py-0.5 text-[10px] font-medium text-[#1F332A]">
          +12
        </span>
        <span>Свёрнутая родня — нажмите, чтобы раскрыть</span>
      </li>
      <li className="text-xs leading-relaxed text-[#5C6A60]">
        Точные типы связей смотрите во вкладке «Схема» или в профиле человека.
      </li>
    </ul>
  );
}
