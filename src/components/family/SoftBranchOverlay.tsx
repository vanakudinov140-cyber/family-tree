"use client";

import { memo } from "react";
import { useStore } from "@xyflow/react";

import type { SoftLinkGeometry } from "@/lib/focused-family-layout";

interface SoftBranchOverlayProps {
  links: SoftLinkGeometry[];
}

function SoftBranchOverlayComponent({ links }: SoftBranchOverlayProps) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;

  if (links.length === 0 || zoom < 0.45) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      style={{
        width: 1,
        height: 1,
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
      aria-hidden
    >
      {links.map((link) => {
        const mx = (link.x1 + link.x2) / 2;
        const my =
          link.kind === "spouse"
            ? (link.y1 + link.y2) / 2
            : Math.min(link.y1, link.y2) - 24;
        const path =
          link.kind === "spouse"
            ? `M ${link.x1} ${link.y1} Q ${mx} ${my - 8} ${link.x2} ${link.y2}`
            : `M ${link.x1} ${link.y1} Q ${mx} ${my} ${link.x2} ${link.y2}`;
        return (
          <path
            key={link.id}
            d={path}
            fill="none"
            stroke={link.kind === "spouse" ? "#C4A052" : "#8B6B4F"}
            strokeWidth={link.kind === "spouse" ? 1.6 : 1.35}
            strokeOpacity={0.45}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export const SoftBranchOverlay = memo(SoftBranchOverlayComponent);
