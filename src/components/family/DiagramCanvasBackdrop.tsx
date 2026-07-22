"use client";

import { memo } from "react";

import { DIAGRAM_TOKENS } from "@/lib/diagram-theme";

/** Warm ivory canvas — fixed to viewport, not pan/zoom. */
function DiagramCanvasBackdropComponent() {
  return (
    <div
      className="diagram-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${DIAGRAM_TOKENS.bgWarm} 0%, ${DIAGRAM_TOKENS.bg} 55%, #EBE3D6 100%)`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="diagram-paper-noise"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.93 0 0 0 0 0.90 0 0 0 0 0.86 0 0 0 0.028 0"
            />
          </filter>
          <radialGradient id="diagram-vignette" cx="50%" cy="42%" r="72%">
            <stop offset="55%" stopColor="#FAF6EF" stopOpacity="0" />
            <stop offset="100%" stopColor="#CFC5B4" stopOpacity="0.32" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={DIAGRAM_TOKENS.bgWarm} />
        <rect width="100%" height="100%" filter="url(#diagram-paper-noise)" />
        <rect width="100%" height="100%" fill="url(#diagram-vignette)" />
      </svg>
    </div>
  );
}

export const DiagramCanvasBackdrop = memo(DiagramCanvasBackdropComponent);
