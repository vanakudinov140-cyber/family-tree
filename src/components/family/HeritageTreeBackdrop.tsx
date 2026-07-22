"use client";

import { memo } from "react";

import { HERITAGE_TOKENS } from "@/lib/heritage-theme";

/** Warm ivory parchment — fixed to viewport, not pan/zoom. */
function HeritageTreeBackdropComponent() {
  return (
    <div
      className="heritage-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, #FFF9F0 0%, ${HERITAGE_TOKENS.bg} 48%, #EBE2D4 100%)`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="heritage-paper-noise"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.92 0 0 0 0 0.88 0 0 0 0 0.82 0 0 0 0.035 0"
            />
          </filter>
          <radialGradient id="heritage-vignette" cx="50%" cy="40%" r="78%">
            <stop offset="50%" stopColor="#FFF9F0" stopOpacity="0" />
            <stop offset="100%" stopColor="#D4CABB" stopOpacity="0.38" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={HERITAGE_TOKENS.bg} />
        <rect width="100%" height="100%" filter="url(#heritage-paper-noise)" />
        <rect width="100%" height="100%" fill="url(#heritage-vignette)" />
      </svg>
    </div>
  );
}

export const HeritageTreeBackdrop = memo(HeritageTreeBackdropComponent);
