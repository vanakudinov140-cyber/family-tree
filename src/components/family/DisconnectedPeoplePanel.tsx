"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2Off, UserRound, X } from "lucide-react";

import { getFullName } from "@/data/family";
import type { DetachedTreeComponent } from "@/lib/tree-asset-layout";
import type { Person } from "@/types/family";

interface DisconnectedPeoplePanelProps {
  detachedComponents: DetachedTreeComponent[];
  onOpenProfile: (personId: string) => void;
  onMakeCenter: (personId: string) => void;
  onShowComponent: (focusId: string) => void;
}

export function DisconnectedPeoplePanel({
  detachedComponents,
  onOpenProfile,
  onMakeCenter,
  onShowComponent,
}: DisconnectedPeoplePanelProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const peopleCount = detachedComponents.reduce(
    (sum, component) => sum + component.personIds.length,
    0,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (peopleCount === 0) {
    return null;
  }

  const button = (
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#E8D4A8] bg-[#FFF6E8]/95 px-3 py-1.5 text-xs font-medium text-[#7A5A1E] shadow-[0_4px_14px_rgba(122,90,30,0.12)] transition-colors hover:bg-[#FFF0DA]"
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Люди без связи с основной семьёй"
    >
      <Link2Off className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Не связаны с основной семьёй:</span>
      <span>
        {peopleCount} {peopleCount === 1 ? "человек" : "человек"}
      </span>
    </button>
  );

  const panel =
    mounted && open
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            className="fixed right-4 top-[4.5rem] z-[220] w-[min(92vw,360px)] rounded-2xl border border-[#E0D6C6] bg-[#FFFCF8]/98 p-4 shadow-[0_12px_32px_rgba(31,51,42,0.14)] backdrop-blur-md sm:right-6"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2
                  id={titleId}
                  className="text-sm font-semibold text-[#1B4332]"
                >
                  Не связаны с основной семьёй
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#5A6B62]">
                  Эти люди не входят в компонент выбранного центра. Откройте
                  профиль или перейдите к их группе на холсте.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-[#5C6B63] hover:bg-[#F3EDE3]"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[min(50vh,320px)] space-y-3 overflow-y-auto overscroll-contain">
              {detachedComponents.map((component) => (
                <li
                  key={component.componentId}
                  className="rounded-xl border border-[#E8E0D4] bg-[#FAF6EF] p-3"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8A7A55]">
                    {component.personIds.length === 1
                      ? "Один человек"
                      : `Группа · ${component.personIds.length} чел.`}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {component.people.map((person) => (
                      <li
                        key={person.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 truncate text-sm text-[#1B4332]">
                          {getFullName(person)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#2D4A3E] hover:bg-[#EEF4EF]"
                            onClick={() => {
                              onOpenProfile(person.id);
                              setOpen(false);
                            }}
                          >
                            Профиль
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#2D4A3E] hover:bg-[#EEF4EF]"
                            onClick={() => {
                              onMakeCenter(person.id);
                              setOpen(false);
                            }}
                            title="Сделать центром просмотра"
                          >
                            <UserRound className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-[#7A5A1E] underline-offset-2 hover:underline"
                    onClick={() => {
                      onShowComponent(component.focusId);
                      setOpen(false);
                    }}
                  >
                    Показать группу на холсте
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {button}
      {panel}
    </>
  );
}
