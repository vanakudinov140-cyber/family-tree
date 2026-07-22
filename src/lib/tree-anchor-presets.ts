import type { TreeAnchor } from "@/types/tree-anchor";
import type { TreeAssetVariant } from "./tree-asset-config";

/**
 * Normalized anchor coordinates tuned for 1536×1024 tree artwork.
 * y: 0 = crown top, 1 = root base. x: 0 = left, 1 = right.
 * Anchor marks the center of the medallion on a branch.
 */
export const COMPACT_TREE_ANCHORS: TreeAnchor[] = [
  // Great-grandparents (gen -3) — near roots, outer branches
  { id: "c-g3-l", generation: -3, x: 0.24, y: 0.86, side: "left", branchId: "paternal-deep" },
  { id: "c-g3-r", generation: -3, x: 0.76, y: 0.86, side: "right", branchId: "maternal-deep" },

  // Grandparents (gen -2)
  { id: "c-g2-pl", generation: -2, x: 0.2, y: 0.76, side: "left", branchId: "paternal", pairGroup: "pgp-l" },
  { id: "c-g2-pr", generation: -2, x: 0.32, y: 0.78, side: "left", branchId: "paternal", pairGroup: "pgp-l" },
  { id: "c-g2-ml", generation: -2, x: 0.68, y: 0.78, side: "right", branchId: "maternal", pairGroup: "mgp-r" },
  { id: "c-g2-mr", generation: -2, x: 0.8, y: 0.76, side: "right", branchId: "maternal", pairGroup: "mgp-r" },

  // Parents (gen -1) — lower main branches
  { id: "c-g1-f", generation: -1, x: 0.34, y: 0.66, side: "left", branchId: "paternal" },
  { id: "c-g1-m", generation: -1, x: 0.66, y: 0.66, side: "right", branchId: "maternal" },

  // Central couple (gen 0) — main fork for adult pairs
  {
    id: "c-g0-a",
    generation: 0,
    x: 0.44,
    y: 0.50,
    side: "center",
    branchId: "center",
    pairGroup: "central-couple-left",
  },
  {
    id: "c-g0-b",
    generation: 0,
    x: 0.56,
    y: 0.50,
    side: "center",
    branchId: "center",
    pairGroup: "central-couple-right",
  },

  // Focused child / single center (gen 0) — upper canopy fork
  {
    id: "c-focus-upper",
    generation: 0,
    x: 0.5,
    y: 0.36,
    side: "center",
    branchId: "focus",
    pairGroup: "single-focus-upper",
  },

  // Children (gen 1) — mid canopy
  { id: "c-g1-c1", generation: 1, x: 0.28, y: 0.38, side: "left", branchId: "children" },
  { id: "c-g1-c2", generation: 1, x: 0.42, y: 0.34, side: "center", branchId: "children" },
  { id: "c-g1-c3", generation: 1, x: 0.58, y: 0.34, side: "center", branchId: "children" },
  { id: "c-g1-c4", generation: 1, x: 0.72, y: 0.38, side: "right", branchId: "children" },

  // Grandchildren (gen 2) — upper canopy
  { id: "c-g2-c1", generation: 2, x: 0.38, y: 0.2, side: "center", branchId: "grandchildren" },
  { id: "c-g2-c2", generation: 2, x: 0.5, y: 0.16, side: "center", branchId: "grandchildren" },
  { id: "c-g2-c3", generation: 2, x: 0.62, y: 0.2, side: "center", branchId: "grandchildren" },

  // Siblings (gen 0) — lateral branches
  { id: "c-sib-l", generation: 0, x: 0.14, y: 0.54, side: "left", branchId: "collateral" },
  { id: "c-sib-r", generation: 0, x: 0.86, y: 0.54, side: "right", branchId: "collateral" },
];

/** Medium — extra slots on outer branches. */
export const MEDIUM_TREE_ANCHORS: TreeAnchor[] = [
  ...COMPACT_TREE_ANCHORS,
  { id: "m-g3-ll", generation: -3, x: 0.12, y: 0.88, side: "left", branchId: "paternal-deep" },
  { id: "m-g3-rr", generation: -3, x: 0.88, y: 0.88, side: "right", branchId: "maternal-deep" },
  { id: "m-g2-pl2", generation: -2, x: 0.1, y: 0.77, side: "left", branchId: "paternal" },
  { id: "m-g2-mr2", generation: -2, x: 0.9, y: 0.77, side: "right", branchId: "maternal" },
  { id: "m-g1-fl", generation: -1, x: 0.26, y: 0.67, side: "left", branchId: "paternal" },
  { id: "m-g1-fr", generation: -1, x: 0.4, y: 0.69, side: "left", branchId: "paternal" },
  { id: "m-g1-ml", generation: -1, x: 0.6, y: 0.69, side: "right", branchId: "maternal" },
  { id: "m-g1-mr", generation: -1, x: 0.74, y: 0.67, side: "right", branchId: "maternal" },
  { id: "m-g1-c5", generation: 1, x: 0.18, y: 0.4, side: "left", branchId: "children" },
  { id: "m-g1-c6", generation: 1, x: 0.82, y: 0.4, side: "right", branchId: "children" },
  { id: "m-g1-c7", generation: 1, x: 0.5, y: 0.28, side: "center", branchId: "children" },
  { id: "m-g2-c4", generation: 2, x: 0.28, y: 0.14, side: "left", branchId: "grandchildren" },
  { id: "m-g2-c5", generation: 2, x: 0.72, y: 0.14, side: "right", branchId: "grandchildren" },
  { id: "m-sib-l2", generation: 0, x: 0.08, y: 0.55, side: "left", branchId: "collateral" },
  { id: "m-sib-r2", generation: 0, x: 0.92, y: 0.55, side: "right", branchId: "collateral" },
];

/** Wide — outermost branches for large families. */
export const WIDE_TREE_ANCHORS: TreeAnchor[] = [
  ...MEDIUM_TREE_ANCHORS,
  { id: "w-g3-l2", generation: -3, x: 0.06, y: 0.9, side: "left", branchId: "paternal-deep" },
  { id: "w-g3-r2", generation: -3, x: 0.94, y: 0.9, side: "right", branchId: "maternal-deep" },
  { id: "w-g2-pl3", generation: -2, x: 0.06, y: 0.79, side: "left", branchId: "paternal" },
  { id: "w-g2-pr3", generation: -2, x: 0.22, y: 0.81, side: "left", branchId: "paternal" },
  { id: "w-g2-ml3", generation: -2, x: 0.78, y: 0.81, side: "right", branchId: "maternal" },
  { id: "w-g2-mr3", generation: -2, x: 0.94, y: 0.79, side: "right", branchId: "maternal" },
  { id: "w-g1-f2", generation: -1, x: 0.18, y: 0.68, side: "left", branchId: "paternal" },
  { id: "w-g1-m2", generation: -1, x: 0.82, y: 0.68, side: "right", branchId: "maternal" },
  { id: "w-g1-c8", generation: 1, x: 0.12, y: 0.42, side: "left", branchId: "children" },
  { id: "w-g1-c9", generation: 1, x: 0.88, y: 0.42, side: "right", branchId: "children" },
  { id: "w-g1-c10", generation: 1, x: 0.36, y: 0.3, side: "left", branchId: "children" },
  { id: "w-g1-c11", generation: 1, x: 0.64, y: 0.3, side: "right", branchId: "children" },
  { id: "w-g2-c6", generation: 2, x: 0.2, y: 0.1, side: "left", branchId: "grandchildren" },
  { id: "w-g2-c7", generation: 2, x: 0.8, y: 0.1, side: "right", branchId: "grandchildren" },
  { id: "w-g2-c8", generation: 2, x: 0.5, y: 0.08, side: "center", branchId: "grandchildren" },
];

export function getAnchorsForVariant(variant: TreeAssetVariant): TreeAnchor[] {
  if (variant === "compact") return COMPACT_TREE_ANCHORS;
  if (variant === "medium") return MEDIUM_TREE_ANCHORS;
  return WIDE_TREE_ANCHORS;
}
