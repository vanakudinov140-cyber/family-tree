export type BotanicalDetailLevel = "overview" | "compact" | "full";

/** Layout box for medallion + decorative plaque. */
export const BOTANICAL_NODE_WIDTH = 118;
export const BOTANICAL_NODE_HEIGHT = 148;
export const BOTANICAL_MEDALLION = 84;
export const BOTANICAL_CENTRAL_MEDALLION = 90;
export const BOTANICAL_SELECTED_MEDALLION = 98;

export const BOTANICAL_GENERATION_STEP = 172;
export const BOTANICAL_SPOUSE_GAP = 24;
export const BOTANICAL_SIBLING_GAP = 44;
export const BOTANICAL_CLUSTER_GAP = 52;
export const BOTANICAL_COMPONENT_GAP = 140;

export const BOTANICAL_TREE_PADDING_TOP = 128;
export const BOTANICAL_TREE_PADDING_BOTTOM = 184;
export const BOTANICAL_TREE_PADDING_SIDE = 72;

export const BOTANICAL_OVERVIEW_ZOOM_MAX = 0.44;
export const BOTANICAL_COMPACT_ZOOM_MAX = 0.74;
export const BOTANICAL_ALL_MIN_ZOOM = 0.72;
export const BOTANICAL_BRANCH_MIN_ZOOM = 0.62;
export const BOTANICAL_NEARBY_MIN_ZOOM = 0.78;
export const BOTANICAL_GENERATIONS_MIN_ZOOM = 0.68;
export const BOTANICAL_CENTER_ZOOM = 0.92;

export const BOTANICAL_TOKENS = {
  bg: "#F4EBD9",
  paper: "#FFF9F0",
  bark: "#5C4330",
  barkDark: "#3D2E22",
  barkLight: "#8B6B4F",
  barkHighlight: "#B8956A",
  gold: "#C4A052",
  goldSoft: "#E0C88A",
  goldDeep: "#9A7838",
  leaf: "#7A9A6E",
  leafSoft: "#A8C49A",
  text: "#2A2418",
  muted: "#6B5E4E",
  union: "#C4A052",
  plaqueBorder: "#D4C4A8",
} as const;

export function resolveBotanicalDetailLevel(
  zoom: number,
  viewMode: "nearby" | "generations" | "branch" | "all",
): BotanicalDetailLevel {
  if (viewMode === "nearby") return "full";
  if (viewMode === "generations") {
    return zoom < BOTANICAL_COMPACT_ZOOM_MAX ? "compact" : "full";
  }
  if (viewMode === "branch") {
    return zoom < BOTANICAL_COMPACT_ZOOM_MAX ? "compact" : "full";
  }
  if (zoom < BOTANICAL_OVERVIEW_ZOOM_MAX) return "overview";
  if (zoom < BOTANICAL_COMPACT_ZOOM_MAX) return "compact";
  return "full";
}
