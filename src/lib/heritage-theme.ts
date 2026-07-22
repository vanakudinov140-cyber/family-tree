export type TreeVisualMode = "heritage" | "diagram";

export type HeritageDetailLevel = "overview" | "compact" | "full";

export const TREE_VISUAL_MODE_STORAGE_KEY = "family-tree-visual-mode";

/**
 * Layout box for heritage person cards.
 * Must fully contain portrait, name plaque, date, center mark, collapse control.
 */
export const HERITAGE_NODE_WIDTH = 200;
export const HERITAGE_NODE_HEIGHT = 178;
export const HERITAGE_NODE_VISUAL_PADDING_X = 10;
export const HERITAGE_NODE_VISUAL_PADDING_Y = 8;

/** Minimum clear space between person layout rectangles. */
export const PERSON_COLLISION_GAP = 18;
export const FAMILY_GROUP_GAP = 36;
export const HERITAGE_COMPONENT_GAP_X = 56;
export const HERITAGE_COMPONENT_GAP_Y = 48;

/** Zoom thresholds for adaptive card detail (heritage only). */
export const HERITAGE_OVERVIEW_ZOOM_MAX = 0.38;
export const HERITAGE_COMPACT_ZOOM_MAX = 0.72;

/**
 * Floor for «Вся семья» / fit overview — people stay medallion-readable.
 * Full width may require pan; do not shrink to dots.
 */
export const ALL_OVERVIEW_MIN_ZOOM = 0.55;
export const BRANCH_FIT_MIN_ZOOM = 0.58;
export const NEARBY_MIN_ZOOM = 0.80;
export const GENERATIONS_MIN_ZOOM = 0.70;
export const CENTER_READABLE_ZOOM = 0.92;

export const HERITAGE_TOKENS = {
  bg: "#F7F1E8",
  surface: "#FFFCF7",
  green: "#1F332A",
  greenSoft: "#3D5A4C",
  bark: "#5C4A3A",
  gold: "#B8953D",
  text: "#1A2E24",
  muted: "#4F5F56",
  shadow: "rgba(31, 51, 42, 0.16)",
  branch: "#4A6356",
  branchLight: "#7A8F82",
  branchSoft: "#5F7468",
  branchActive: "#2A4338",
  dimOpacity: 0.42,
  pathOpacity: 1,
} as const;

/** Future branch labels — do not invent «линия матери/отца» without confirmed logic. */
export type HeritageBranchLabel = {
  id: string;
  title: string;
  personIds: string[];
};

export function isTreeVisualMode(value: string | null): value is TreeVisualMode {
  return value === "heritage" || value === "diagram";
}

export function readStoredVisualMode(): TreeVisualMode {
  if (typeof window === "undefined") {
    return "heritage";
  }
  const raw = window.localStorage.getItem(TREE_VISUAL_MODE_STORAGE_KEY);
  return isTreeVisualMode(raw) ? raw : "heritage";
}

export function resolveHeritageDetailLevel(
  zoom: number,
  viewMode: "nearby" | "generations" | "branch" | "all",
): HeritageDetailLevel {
  if (viewMode === "nearby") {
    return "full";
  }
  if (viewMode === "generations") {
    return zoom < HERITAGE_COMPACT_ZOOM_MAX ? "compact" : "full";
  }
  if (viewMode === "branch") {
    if (zoom < HERITAGE_OVERVIEW_ZOOM_MAX) return "compact";
    if (zoom < HERITAGE_COMPACT_ZOOM_MAX) return "compact";
    return "full";
  }
  // all
  if (zoom < HERITAGE_OVERVIEW_ZOOM_MAX) return "overview";
  if (zoom < HERITAGE_COMPACT_ZOOM_MAX) return "compact";
  return "full";
}
