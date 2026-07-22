"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

const STORAGE_KEY = "family-tree-center-hint-dismissed";

export function TreeCenterHint() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      setVisible(dismissed !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="tree-center-hint pointer-events-auto absolute bottom-28 left-4 z-[200] max-w-[min(92vw,320px)] sm:bottom-auto sm:left-4 sm:top-[7.75rem]">
      {expanded ? (
        <div className="rounded-2xl border border-[#E0D6C6] bg-[#FFFCF8]/96 p-3 text-xs leading-relaxed text-[#3D4F45] shadow-[0_8px_22px_rgba(31,51,42,0.12)] backdrop-blur-md">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-medium text-[#1B4332]">Как пользоваться</p>
            <button
              type="button"
              className="rounded-lg p-1 text-[#5C6B63] hover:bg-[#F3EDE3]"
              aria-label="Закрыть подсказку"
              onClick={dismiss}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p>
            Нажмите на человека — открыть профиль.
            <br />
            «Сделать центром» — перестроить дерево вокруг него.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 rounded-full border border-[#E0D6C6] bg-[#FFFCF8]/95 px-2.5 py-1.5 text-[11px] font-medium text-[#3D4F45] shadow-sm hover:bg-[#FFF8EF]"
          title="Подсказка по управлению"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Клики и центр</span>
        </button>
      )}
    </div>
  );
}
