import type { TreeAssetComponentModel } from "./tree-asset-layout";

export type TreeIllustrationBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function computeTreeIllustrationBounds(
  components: TreeAssetComponentModel[],
): TreeIllustrationBounds | null {
  const main = components.find((component) => component.renderTreeAsset);
  if (!main) {
    return null;
  }
  return {
    minX: main.imageX,
    minY: main.imageY,
    maxX: main.imageX + main.renderedWidth,
    maxY: main.imageY + main.renderedHeight,
  };
}

export function mergeTreeViewBounds(
  nodeBounds: { x: number; y: number; width: number; height: number },
  illustrationBounds: TreeIllustrationBounds | null,
): { x: number; y: number; width: number; height: number } {
  if (!illustrationBounds) {
    return nodeBounds;
  }
  const minX = Math.min(nodeBounds.x, illustrationBounds.minX);
  const minY = Math.min(nodeBounds.y, illustrationBounds.minY);
  const maxX = Math.max(
    nodeBounds.x + nodeBounds.width,
    illustrationBounds.maxX,
  );
  const maxY = Math.max(
    nodeBounds.y + nodeBounds.height,
    illustrationBounds.maxY,
  );
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function heritageHeightFill(
  viewMode: "nearby" | "generations" | "branch" | "all",
): number {
  switch (viewMode) {
    case "nearby":
      return 0.86;
    case "generations":
      return 0.84;
    case "branch":
      return 0.82;
    case "all":
      return 0.72;
    default:
      return 0.8;
  }
}

export function heritageWidthRatio(viewportWidth: number): number {
  if (viewportWidth >= 1366) return 0.9;
  if (viewportWidth >= 768) return 0.92;
  return 0.96;
}
