import type { Node } from "@xyflow/react";

import {
  BOTANICAL_NODE_HEIGHT,
  BOTANICAL_NODE_WIDTH,
} from "./botanical-tree-theme";
import { findConnectedComponents, buildPersonIndex } from "./botanical-tree-model";
import type { TreeAssetComponentModel } from "./tree-asset-layout";
import {
  type TreeIllustrationBounds,
  mergeTreeViewBounds,
} from "./tree-asset-bounds";
import { NODE_HEIGHT, NODE_WIDTH } from "./tree-layout";
import type { Person } from "@/types/family";

export type ViewBoundsRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TreeViewBoundsSet = {
  focusedTreeBounds: ViewBoundsRect | null;
  secondaryComponentsBounds: ViewBoundsRect | null;
  allContentBounds: ViewBoundsRect | null;
};

function readNodeSize(
  node: Node,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  const measuredW = node.measured?.width;
  const measuredH = node.measured?.height;
  const styleW = node.style?.width;
  const styleH = node.style?.height;

  const width =
    typeof measuredW === "number"
      ? measuredW
      : typeof styleW === "number"
        ? styleW
        : fallbackWidth;
  const height =
    typeof measuredH === "number"
      ? measuredH
      : typeof styleH === "number"
        ? styleH
        : fallbackHeight;

  return { width, height };
}

export function boundsFromNodes(
  nodes: Node[],
  fallbackWidth: number,
  fallbackHeight: number,
): ViewBoundsRect | null {
  if (nodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const { width, height } = readNodeSize(node, fallbackWidth, fallbackHeight);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function illustrationToRect(
  bounds: TreeIllustrationBounds | null,
): ViewBoundsRect | null {
  if (!bounds) {
    return null;
  }
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function mergeRects(
  a: ViewBoundsRect | null,
  b: ViewBoundsRect | null,
): ViewBoundsRect | null {
  if (!a) return b;
  if (!b) return a;
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function computeTreeViewBoundsSet(
  components: TreeAssetComponentModel[],
  personNodes: Node[],
  illustrationBounds: TreeIllustrationBounds | null,
): TreeViewBoundsSet {
  const mainComponent = components.find((component) => component.renderTreeAsset);
  const mainPersonIds = new Set(
    mainComponent?.assignments.map((assignment) => assignment.personId) ?? [],
  );

  const mainNodes = personNodes.filter((node) => mainPersonIds.has(node.id));
  const secondaryNodes = personNodes.filter((node) => !mainPersonIds.has(node.id));

  const focusedNodeBounds = boundsFromNodes(
    mainNodes,
    BOTANICAL_NODE_WIDTH,
    BOTANICAL_NODE_HEIGHT,
  );
  const focusedTreeBounds = mergeRects(
    focusedNodeBounds,
    illustrationToRect(illustrationBounds),
  );

  const secondaryComponentsBounds = boundsFromNodes(
    secondaryNodes,
    BOTANICAL_NODE_WIDTH,
    BOTANICAL_NODE_HEIGHT,
  );

  const allNodeBounds = boundsFromNodes(
    personNodes,
    BOTANICAL_NODE_WIDTH,
    BOTANICAL_NODE_HEIGHT,
  );
  const mergedAll = mergeTreeViewBounds(
    allNodeBounds ?? { x: 0, y: 0, width: 0, height: 0 },
    illustrationBounds,
  );
  const allContentBounds: ViewBoundsRect | null =
    allNodeBounds && mergedAll.width > 0 && mergedAll.height > 0
      ? mergedAll
      : allNodeBounds;

  return {
    focusedTreeBounds,
    secondaryComponentsBounds,
    allContentBounds,
  };
}

export function getFocusedComponentPersonIds(
  people: Person[],
  focusId: string | null,
): Set<string> {
  if (people.length === 0) {
    return new Set();
  }
  const index = buildPersonIndex(people);
  const components = findConnectedComponents(people, index);
  const effectiveFocus =
    focusId && index.byId.has(focusId) ? focusId : people[0]?.id ?? "";
  const match =
    components.find((memberIds) => memberIds.includes(effectiveFocus)) ??
    components[0];
  return new Set(match ?? []);
}

export function computeDiagramViewBoundsSet(
  personNodes: Node[],
  people: Person[],
  focusId: string | null,
): TreeViewBoundsSet {
  const focusedIds = getFocusedComponentPersonIds(people, focusId);
  const focusedNodes = personNodes.filter((node) => focusedIds.has(node.id));
  const secondaryNodes = personNodes.filter((node) => !focusedIds.has(node.id));

  const focusedTreeBounds = boundsFromNodes(
    focusedNodes,
    NODE_WIDTH,
    NODE_HEIGHT,
  );
  const secondaryComponentsBounds = boundsFromNodes(
    secondaryNodes,
    NODE_WIDTH,
    NODE_HEIGHT,
  );
  const allContentBounds = boundsFromNodes(
    personNodes,
    NODE_WIDTH,
    NODE_HEIGHT,
  );

  return {
    focusedTreeBounds,
    secondaryComponentsBounds,
    allContentBounds,
  };
}

export function computeCameraZoom(input: {
  bounds: ViewBoundsRect;
  containerWidth: number;
  containerHeight: number;
  heightFill: number;
  widthRatio: number;
  floorZoom: number;
  maxZoom: number;
}): number {
  const { bounds, containerWidth, containerHeight, heightFill, widthRatio } =
    input;
  if (bounds.width <= 0 || bounds.height <= 0) {
    return input.floorZoom;
  }

  const zoomByWidth = (containerWidth * widthRatio) / bounds.width;
  const zoomByHeight = (containerHeight * heightFill) / bounds.height;
  const fitted = Math.min(zoomByWidth, zoomByHeight);
  return Math.min(input.maxZoom, Math.max(input.floorZoom, fitted));
}

export function boundsCenter(bounds: ViewBoundsRect): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
