"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp, Crosshair } from "lucide-react";

import { formatLifeYears } from "@/data/family";
import { getAvatarPalette, getInitials } from "@/lib/avatar";
import { DIAGRAM_TOKENS } from "@/lib/diagram-theme";
import type { PersonNodeData } from "@/types/family";

function PersonNodeComponent({ data }: NodeProps<Node<PersonNodeData>>) {
  const {
    person,
    onSelect,
    isHighlighted,
    isFocused,
    isSelected,
    isSearchFlash,
    isRelated,
    isDimmed,
    isCompact,
    isCollapsed,
    hiddenDescendantCount = 0,
    canCollapse,
    onToggleCollapse,
  } = data;
  const palette = getAvatarPalette(person.id);
  const initials = getInitials(
    person.firstName,
    person.lastName || person.middleName || person.firstName,
  );
  const lifeYears = formatLifeYears(person);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const fullName = [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPhotoFailed(false);
  }, [person.photoUrl]);

  const showCenterMark = Boolean(isFocused);
  const activeRing = isFocused || isSelected || isHighlighted;
  const showPhoto = Boolean(person.photoUrl) && !photoFailed;

  return (
    <div
      className={[
        "group relative pointer-events-auto transition-all ease-out",
        reduceMotion ? "duration-0" : "duration-300",
        activeRing ? "z-20" : "z-10",
        isRelated && !activeRing ? "z-10" : "",
        isDimmed ? "opacity-[0.65]" : "opacity-100",
        isSearchFlash && !reduceMotion ? "person-search-flash" : "",
      ].join(" ")}
    >
      <Handle
        id="family-in"
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
      <Handle
        id="spouse-left"
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
      <Handle
        id="spouse-right"
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />

      <button
        type="button"
        className={[
          "person-card nodrag nopan nowheel flex h-[125px] w-[230px] items-center gap-3.5 rounded-[20px] border bg-[#FFFCF8] text-left",
          "pointer-events-auto cursor-pointer",
          "shadow-[0_10px_26px_rgba(31,51,42,0.11)] transition-all ease-out",
          reduceMotion ? "duration-0" : "duration-300",
          "hover:-translate-y-0.5 hover:border-[#CFC4B2] hover:shadow-[0_16px_34px_rgba(31,51,42,0.15)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A962]/75",
          isCompact ? "px-3 py-2.5" : "px-3.5 py-3",
          isFocused || (isSelected && isFocused)
            ? "border-[#1F332A] shadow-[0_0_0_3px_rgba(31,51,42,0.22),0_14px_32px_rgba(31,51,42,0.18)]"
            : isSelected
              ? "border-[#2D4A3E]/90 shadow-[0_0_0_2px_rgba(45,74,62,0.16),0_12px_28px_rgba(31,51,42,0.14)]"
              : isHighlighted || isSearchFlash
                ? "border-[#2D4A3E] shadow-[0_0_0_3px_rgba(45,74,62,0.2),0_14px_32px_rgba(31,51,42,0.16)]"
                : isRelated
                  ? "border-[#B8953D]/75 shadow-[0_0_0_2px_rgba(184,149,61,0.22),0_10px_26px_rgba(31,51,42,0.11)]"
                  : "border-[#D9CEBD]",
          person.isCurrentUser && !activeRing && !isRelated
            ? "ring-2 ring-[#C4A962]/35"
            : "",
        ].join(" ")}
        aria-label={`Открыть профиль: ${person.firstName} ${person.lastName}`}
        aria-current={isFocused ? "true" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(person.id);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          className={[
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#EDE4D6] shadow-[inset_0_1px_2px_rgba(31,51,42,0.06)] transition-all",
            reduceMotion ? "duration-0" : "duration-300",
            isCompact ? "h-[58px] w-[58px]" : "h-[72px] w-[72px]",
          ].join(" ")}
          style={{
            backgroundImage: `linear-gradient(145deg, ${palette.from}, ${palette.to})`,
          }}
        >
          {showPhoto && person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.photoUrl}
              alt={fullName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span
              className={[
                "font-semibold tracking-wide transition-all",
                reduceMotion ? "duration-0" : "duration-300",
                isCompact ? "text-base" : "text-xl",
              ].join(" ")}
              style={{ color: palette.foreground }}
            >
              {initials}
            </span>
          )}
        </div>

        <div className="relative min-w-0 flex-1 pr-1">
          {showCenterMark ? (
            <span
              className="absolute -top-0.5 right-0 inline-flex items-center gap-0.5 rounded-full bg-[#2D4A3E] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[#F5F0E8]"
              title="Центр просмотра"
            >
              <Crosshair className="h-2.5 w-2.5" aria-hidden />
              Центр
            </span>
          ) : person.isCurrentUser ? (
            <span
              className="absolute -top-0.5 right-0 inline-flex items-center gap-0.5 rounded-full bg-[#2D4A3E]/85 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[#F5F0E8]"
              title="Вы в дереве"
            >
              Вы
            </span>
          ) : null}
          <p
            className={[
              "font-semibold leading-snug tracking-tight transition-all",
              reduceMotion ? "duration-0" : "duration-300",
              isCompact ? "text-[14px]" : "text-[15px] sm:text-[16px]",
              showCenterMark || person.isCurrentUser ? "pr-12" : "",
            ].join(" ")}
            style={{ color: DIAGRAM_TOKENS.text }}
          >
            <span className="block truncate">{person.firstName}</span>
            <span className="block truncate">
              {person.lastName || person.middleName}
            </span>
          </p>
          {lifeYears ? (
            <p
              className="mt-1 text-[11px] leading-none"
              style={{ color: DIAGRAM_TOKENS.textMuted }}
            >
              {lifeYears}
            </p>
          ) : null}
          <span
            className={[
              "mt-2 block text-[11px] font-medium tracking-wide transition-all",
              reduceMotion ? "duration-0" : "duration-300",
              isCompact
                ? "max-h-0 overflow-hidden opacity-0"
                : "max-h-6 opacity-100",
            ].join(" ")}
            style={{ color: DIAGRAM_TOKENS.gold }}
          >
            {person.relationshipLabel}
          </span>
        </div>
      </button>

      {canCollapse && onToggleCollapse ? (
        <button
          type="button"
          className={[
            "nodrag nopan nowheel absolute -bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#D9D0C3] bg-[#FFFCF8] px-2 py-0.5 text-[10px] font-medium text-[#2D4A3E] shadow-sm",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A962]/70",
          ].join(" ")}
          title={isCollapsed ? "Развернуть ветку" : "Свернуть ветку"}
          aria-label={
            isCollapsed
              ? `Развернуть ветку: ${person.firstName}`
              : `Свернуть ветку: ${person.firstName}`
          }
          aria-pressed={isCollapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(person.id);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          {isCollapsed ? (
            <ChevronDown className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronUp className="h-3 w-3" aria-hidden />
          )}
          {isCollapsed && hiddenDescendantCount > 0
            ? `+${hiddenDescendantCount}`
            : isCollapsed
              ? "Развернуть"
              : "Свернуть"}
        </button>
      ) : null}

      <Handle
        id="family-out"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
