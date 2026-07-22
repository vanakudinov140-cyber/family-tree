"use client";

import { memo, useCallback, useEffect, useState, type MouseEvent } from "react";
import { useStore } from "@xyflow/react";

import type { TreeAssetComponentModel } from "@/lib/tree-asset-layout";
import { logTreeAnchorDebugTable } from "@/lib/tree-anchor-layout";
import { getAnchorsForVariant } from "@/lib/tree-anchor-presets";
import { buildPersonIndex } from "@/lib/botanical-tree-model";
import type { Person } from "@/types/family";

interface TreeDebugOverlayProps {
  components: TreeAssetComponentModel[];
  people: Person[];
  enabled: boolean;
}

function TreeDebugOverlayComponent({
  components,
  people,
  enabled,
}: TreeDebugOverlayProps) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;
  const index = buildPersonIndex(people);

  const handleImageClick = useCallback(
    (
      event: MouseEvent<SVGRectElement>,
      component: TreeAssetComponentModel,
    ) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const clampedX = Math.min(1, Math.max(0, x));
      const clampedY = Math.min(1, Math.max(0, y));
      console.log(
        `Tree coordinate: { x: ${clampedX.toFixed(2)}, y: ${clampedY.toFixed(2)} }`,
      );
    },
    [],
  );

  const main = components.find((component) => component.renderTreeAsset);

  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== "development" || !main) return;
    logTreeAnchorDebugTable(main.assignments);
  }, [enabled, main]);

  if (!enabled || process.env.NODE_ENV !== "development") {
    return null;
  }

  if (!main) {
    return null;
  }

  const anchors = getAnchorsForVariant(main.asset.variant);
  const assignmentByAnchor = new Map(
    main.assignments.map((item) => [item.anchorId, item]),
  );

  return (
    <svg
      className="tree-debug-overlay absolute left-0 top-0 overflow-visible"
      style={{
        width: 1,
        height: 1,
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        transformOrigin: "0 0",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {components
        .filter((component) => component.renderTreeAsset)
        .map((component) => {
          const { imageX, imageY, renderedWidth, renderedHeight } = component;
          const variantAnchors =
            component.componentId === main.componentId
              ? anchors
              : getAnchorsForVariant(component.asset.variant);

          return (
            <g key={`debug-${component.componentId}`}>
              <rect
                x={imageX}
                y={imageY}
                width={renderedWidth}
                height={renderedHeight}
                fill="transparent"
                stroke="#E74C3C"
                strokeWidth={2}
                strokeDasharray="8 6"
                style={{ pointerEvents: "all", cursor: "crosshair" }}
                onClick={(event) => handleImageClick(event, component)}
              />
              {variantAnchors.map((anchor) => {
                const cx = imageX + anchor.x * renderedWidth;
                const cy = imageY + anchor.y * renderedHeight;
                const assignment = assignmentByAnchor.get(anchor.id);
                const person = assignment
                  ? index.byId.get(assignment.personId)
                  : undefined;
                const label = [
                  anchor.id,
                  `g${anchor.generation}`,
                  anchor.side,
                  anchor.pairGroup ?? "-",
                  person?.firstName ?? "—",
                  `${anchor.x.toFixed(2)},${anchor.y.toFixed(2)}`,
                ].join(" · ");

                return (
                  <g key={anchor.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="#FF3366"
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                    <text
                      x={cx + 8}
                      y={cy - 8}
                      fontSize={10}
                      fill="#1A1A1A"
                      stroke="#FFFFFF"
                      strokeWidth={3}
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              {component.assignments.map((assignment) => {
                const cx =
                  imageX + assignment.anchor.x * renderedWidth;
                const cy =
                  imageY + assignment.anchor.y * renderedHeight;
                const person = index.byId.get(assignment.personId);
                const nodeLabel = [
                  assignment.personId.slice(0, 8),
                  `g${assignment.generation}`,
                  assignment.lineageKey,
                  assignment.anchorId,
                  assignment.anchor.side,
                  person?.firstName ?? "?",
                ].join(" · ");

                return (
                  <text
                    key={`node-debug-${assignment.personId}`}
                    x={cx + 8}
                    y={cy + 14}
                    fontSize={9}
                    fill="#004488"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    paintOrder="stroke"
                    style={{ pointerEvents: "none" }}
                  >
                    {nodeLabel}
                  </text>
                );
              })}
            </g>
          );
        })}
    </svg>
  );
}

export const TreeDebugOverlay = memo(TreeDebugOverlayComponent);

export function useTreeDebugEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      setEnabled(false);
      return;
    }
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get("treeDebug") === "1");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  return enabled;
}
