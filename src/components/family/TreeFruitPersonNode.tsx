"use client";

import { memo, useEffect, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";

import { formatLifeYears } from "@/data/family";
import { getAvatarPalette, getInitials } from "@/lib/avatar";
import {
  BOTANICAL_CENTRAL_MEDALLION,
  BOTANICAL_MEDALLION,
  BOTANICAL_NODE_HEIGHT,
  BOTANICAL_NODE_WIDTH,
  BOTANICAL_SELECTED_MEDALLION,
  BOTANICAL_TOKENS,
  type BotanicalDetailLevel,
} from "@/lib/botanical-tree-theme";
import type { PersonNodeData } from "@/types/family";

function DecorativePlaque({
  name,
  years,
  relationLabel,
  emphasized,
  width,
  className = "",
}: {
  name: string;
  years: string | null;
  relationLabel?: string | null;
  emphasized: boolean;
  width: number;
  className?: string;
}) {
  const border = emphasized ? BOTANICAL_TOKENS.gold : BOTANICAL_TOKENS.plaqueBorder;
  return (
    <div
      className={[
        "relative flex min-h-[44px] flex-col items-center justify-center rounded-lg px-2.5 py-1.5 shadow-[0_3px_10px_rgba(61,46,34,0.1)]",
        className,
      ].join(" ")}
      style={{
        width,
        backgroundColor: BOTANICAL_TOKENS.paper,
        border: `1.2px solid ${border}`,
      }}
    >
      <span
        className="pointer-events-none absolute left-1 top-1 h-2 w-2 border-l border-t"
        style={{ borderColor: BOTANICAL_TOKENS.goldSoft }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-1 top-1 h-2 w-2 border-r border-t"
        style={{ borderColor: BOTANICAL_TOKENS.goldSoft }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-1 left-1 h-2 w-2 border-b border-l"
        style={{ borderColor: BOTANICAL_TOKENS.goldSoft }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-1 right-1 h-2 w-2 border-b border-r"
        style={{ borderColor: BOTANICAL_TOKENS.goldSoft }}
        aria-hidden
      />
      <span
        className="line-clamp-2 text-center text-[11px] font-semibold leading-tight"
        style={{ color: BOTANICAL_TOKENS.text }}
      >
        {name}
      </span>
      {years ? (
        <span
          className="mt-0.5 text-center text-[9px] leading-none"
          style={{ color: BOTANICAL_TOKENS.muted }}
        >
          {years}
        </span>
      ) : null}
      {relationLabel ? (
        <span
          className="mt-0.5 text-center text-[9px] font-medium leading-none tracking-wide"
          style={{ color: BOTANICAL_TOKENS.goldDeep }}
        >
          {relationLabel}
        </span>
      ) : null}
    </div>
  );
}

function TreeFruitPersonNodeComponent({
  data,
}: NodeProps<Node<PersonNodeData>>) {
  const {
    person,
    onSelect,
    isFocused,
    isSelected,
    isSearchFlash,
    isHoverRelated,
    isDimmed,
    detailLevel: detailLevelProp,
    isBotanicalCentral,
    botanicalDisplayLevel,
    labelPlacement = "bottom",
    relationToFocusLabel,
  } = data;

  const detailLevel: BotanicalDetailLevel =
    detailLevelProp === "overview" ||
    detailLevelProp === "compact" ||
    detailLevelProp === "full"
      ? detailLevelProp
      : "full";

  const emphasize = Boolean(isFocused || isSelected || isHoverRelated);
  const showPlaque =
    detailLevel !== "overview" || emphasize || isHoverRelated;

  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [person.photoUrl]);

  const palette = getAvatarPalette(person.id);
  const initials = getInitials(
    person.firstName,
    person.lastName || person.middleName || person.firstName,
  );
  const fullName = [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
  const lifeYears = formatLifeYears(person);
  const showPhoto = Boolean(person.photoUrl) && !photoFailed;

  let medallionSize = BOTANICAL_MEDALLION;
  if (isFocused || isSelected) {
    medallionSize = BOTANICAL_SELECTED_MEDALLION;
  } else if (isBotanicalCentral || botanicalDisplayLevel === "central") {
    medallionSize = BOTANICAL_CENTRAL_MEDALLION;
  }

  const plaqueWidth = Math.min(140, Math.max(100, Math.min(fullName.length * 5.2 + 40, 140)));
  const displayName =
    detailLevel === "overview"
      ? person.firstName
      : detailLevel === "compact"
        ? [person.firstName, person.lastName].filter(Boolean).join(" ")
        : truncateDisplayName(fullName, 2);

  const plaqueAbove = labelPlacement === "top";
  const ringColor = isFocused
    ? BOTANICAL_TOKENS.gold
    : isSelected
      ? BOTANICAL_TOKENS.goldDeep
      : BOTANICAL_TOKENS.plaqueBorder;

  return (
    <div
      className={[
        "tree-fruit-node pointer-events-auto relative flex flex-col items-center",
        plaqueAbove ? "justify-end" : "justify-start",
        isDimmed && !emphasize ? "opacity-[0.65]" : "opacity-100",
        isSearchFlash ? "heritage-search-flash" : "",
        emphasize ? "z-30" : "z-20",
      ].join(" ")}
      style={{
        width: BOTANICAL_NODE_WIDTH,
        height: BOTANICAL_NODE_HEIGHT,
      }}
    >
      <button
        type="button"
        className={[
          "nodrag nopan nowheel flex w-full flex-col items-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A052]/60",
          plaqueAbove ? "flex-col-reverse" : "",
        ].join(" ")}
        aria-label={`Открыть профиль: ${fullName}`}
        title={fullName}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(person.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span
          className="relative flex items-center justify-center"
          style={{ width: medallionSize + 12, height: medallionSize + 12 }}
        >
          {(isFocused || isSelected) && (
            <>
              <span
                className="absolute inset-0 rounded-full border-[3px]"
                style={{
                  borderColor: BOTANICAL_TOKENS.goldSoft,
                  boxShadow: "0 0 0 1px rgba(196,160,82,0.35)",
                }}
                aria-hidden
              />
              <span
                className="absolute inset-[4px] rounded-full border-2"
                style={{ borderColor: BOTANICAL_TOKENS.gold }}
                aria-hidden
              />
            </>
          )}
          <span
            className="relative flex items-center justify-center overflow-hidden rounded-full shadow-[0_8px_22px_rgba(61,46,34,0.22)]"
            style={{
              width: medallionSize,
              height: medallionSize,
              border: `3px solid ${ringColor}`,
              boxShadow: `0 0 0 2px ${BOTANICAL_TOKENS.paper}`,
              backgroundImage: showPhoto
                ? undefined
                : `linear-gradient(145deg, ${palette.from}, ${palette.to})`,
              backgroundColor: BOTANICAL_TOKENS.paper,
            }}
          >
            {showPhoto && person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photoUrl}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span
                className="text-base font-semibold tracking-wide"
                style={{ color: palette.foreground }}
              >
                {initials}
              </span>
            )}
          </span>
        </span>

        {showPlaque ? (
          <DecorativePlaque
            name={displayName}
            years={detailLevel === "full" ? lifeYears : null}
            relationLabel={
              detailLevel === "full" &&
              relationToFocusLabel &&
              relationToFocusLabel !== "центр"
                ? relationToFocusLabel
                : null
            }
            emphasized={emphasize}
            width={plaqueWidth}
            className={plaqueAbove ? "mb-2 mt-0" : "mt-2"}
          />
        ) : (
          emphasize && (
            <span
              className={[
                "max-w-[120px] truncate text-center text-[10px] font-semibold",
                plaqueAbove ? "mb-1" : "mt-1",
              ].join(" ")}
              style={{ color: BOTANICAL_TOKENS.text }}
            >
              {person.firstName}
            </span>
          )
        )}
      </button>
    </div>
  );
}

function truncateDisplayName(name: string, maxLines: number): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= maxLines) {
    return name;
  }
  if (maxLines <= 1) {
    return parts[0] ?? name;
  }
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export const TreeFruitPersonNode = memo(TreeFruitPersonNodeComponent);
