"use client";

import { memo } from "react";
import { useStore } from "@xyflow/react";

import type { TreeAssetComponentModel } from "@/lib/tree-asset-layout";

const UNION_MIN_ZOOM = 0.55;

interface TreeUnionOverlayProps {
  components: TreeAssetComponentModel[];
}

function TreeUnionOverlayComponent({ components }: TreeUnionOverlayProps) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;

  if (zoom < UNION_MIN_ZOOM) {
    return null;
  }

  const unions = components.flatMap((component) => component.unionDecor);
  if (unions.length === 0) {
    return null;
  }

  return (
    <svg
      className="tree-union-overlay pointer-events-none absolute left-0 top-0 overflow-visible"
      style={{
        width: 1,
        height: 1,
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
      aria-hidden
    >
      {unions.map((decor) => (
        <g key={`${decor.personA}-${decor.personB}`}>
          <circle
            cx={decor.x}
            cy={decor.y}
            r={7}
            fill="#FFF9F0"
            stroke="#C4A052"
            strokeWidth={1.4}
            opacity={0.92}
          />
          <circle cx={decor.x} cy={decor.y} r={2.2} fill="#C4A052" />
        </g>
      ))}
    </svg>
  );
}

export const TreeUnionOverlay = memo(TreeUnionOverlayComponent);
