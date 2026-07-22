"use client";

import { memo, useEffect, useState } from "react";
import { useStore } from "@xyflow/react";

import type { TreeAssetComponentModel } from "@/lib/tree-asset-layout";

interface AssetTreeLayerProps {
  components: TreeAssetComponentModel[];
}

function useTreeAssetLoaded(src: string): "loading" | "ready" | "missing" {
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setStatus("ready");
    };
    image.onerror = () => {
      if (!cancelled) {
        if (process.env.NODE_ENV === "development") {
          const fileName = src.split("/").pop() ?? src;
          console.warn(`Tree asset is not installed: ${fileName}`);
        }
        setStatus("missing");
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return status;
}

function TreeAssetInstance({
  component,
}: {
  component: TreeAssetComponentModel;
}) {
  const status = useTreeAssetLoaded(component.asset.src);
  const { imageX, imageY, renderedWidth, renderedHeight, asset } = component;

  if (!component.renderTreeAsset) {
    return null;
  }

  if (status !== "ready") {
    return null;
  }

  const groundCx = imageX + renderedWidth / 2;
  const groundCy = imageY + renderedHeight - 6;

  return (
    <g aria-hidden>
      <ellipse
        cx={groundCx}
        cy={groundCy}
        rx={renderedWidth * 0.34}
        ry={Math.max(10, renderedHeight * 0.035)}
        fill="rgba(92, 67, 48, 0.11)"
      />
      <ellipse
        cx={groundCx}
        cy={groundCy - 2}
        rx={renderedWidth * 0.22}
        ry={Math.max(6, renderedHeight * 0.018)}
        fill="rgba(92, 67, 48, 0.07)"
      />
      <image
        href={asset.src}
        x={imageX}
        y={imageY}
        width={renderedWidth}
        height={renderedHeight}
        preserveAspectRatio="xMidYMax meet"
      />
    </g>
  );
}

function AssetTreeLayerComponent({ components }: AssetTreeLayerProps) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;

  const hasTree = components.some((component) => component.renderTreeAsset);
  if (!hasTree) {
    return null;
  }

  return (
    <svg
      className="asset-tree-layer pointer-events-none absolute left-0 top-0 overflow-visible"
      style={{
        width: 1,
        height: 1,
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
      aria-hidden
    >
      {components.map((component) => (
        <TreeAssetInstance key={component.componentId} component={component} />
      ))}
    </svg>
  );
}

export const AssetTreeLayer = memo(AssetTreeLayerComponent);
