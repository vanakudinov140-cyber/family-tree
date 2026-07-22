import type { TreeViewMode } from "./tree-visibility";

export type TreeAssetVariant = "compact" | "medium" | "wide";

export interface TreeAssetDefinition {
  variant: TreeAssetVariant;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  minPeople: number;
  maxPeople: number;
}

/** Measured from installed PNG assets (1536×1024, RGBA). */
export const TREE_ASSET_NATURAL_WIDTH = 1536;
export const TREE_ASSET_NATURAL_HEIGHT = 1024;

export const TREE_ASSET_DEFINITIONS: Record<TreeAssetVariant, TreeAssetDefinition> = {
  compact: {
    variant: "compact",
    src: "/tree-assets/tree-compact.png",
    naturalWidth: TREE_ASSET_NATURAL_WIDTH,
    naturalHeight: TREE_ASSET_NATURAL_HEIGHT,
    minPeople: 1,
    maxPeople: 10,
  },
  medium: {
    variant: "medium",
    src: "/tree-assets/tree-medium.png",
    naturalWidth: TREE_ASSET_NATURAL_WIDTH,
    naturalHeight: TREE_ASSET_NATURAL_HEIGHT,
    minPeople: 11,
    maxPeople: 25,
  },
  wide: {
    variant: "wide",
    src: "/tree-assets/tree-wide.png",
    naturalWidth: TREE_ASSET_NATURAL_WIDTH,
    naturalHeight: TREE_ASSET_NATURAL_HEIGHT,
    minPeople: 26,
    maxPeople: 50,
  },
};

export const TREE_ASSET_VARIANT_ORDER: TreeAssetVariant[] = [
  "compact",
  "medium",
  "wide",
];

export function getTreeAssetDefinition(
  variant: TreeAssetVariant,
): TreeAssetDefinition {
  return TREE_ASSET_DEFINITIONS[variant];
}

export function variantForPeopleCount(count: number): TreeAssetVariant {
  if (count <= TREE_ASSET_DEFINITIONS.compact.maxPeople) {
    return "compact";
  }
  if (count <= TREE_ASSET_DEFINITIONS.medium.maxPeople) {
    return "medium";
  }
  return "wide";
}

export function nextLargerVariant(
  variant: TreeAssetVariant,
): TreeAssetVariant | null {
  const index = TREE_ASSET_VARIANT_ORDER.indexOf(variant);
  if (index < 0 || index >= TREE_ASSET_VARIANT_ORDER.length - 1) {
    return null;
  }
  return TREE_ASSET_VARIANT_ORDER[index + 1];
}

export function selectTreeAssetVariant(options: {
  visiblePeopleCount: number;
  viewMode: TreeViewMode;
  viewportWidth: number;
  isMobile: boolean;
}): TreeAssetDefinition {
  const { visiblePeopleCount, viewMode } = options;

  let variant: TreeAssetVariant;
  switch (viewMode) {
    case "nearby":
      variant = "compact";
      break;
    case "generations":
      variant =
        visiblePeopleCount <= TREE_ASSET_DEFINITIONS.compact.maxPeople
          ? "compact"
          : "medium";
      break;
    case "branch":
      variant = "medium";
      break;
    case "all":
      variant = "wide";
      break;
    default:
      variant = "compact";
  }

  return getTreeAssetDefinition(variant);
}

export function treeAssetFileName(definition: TreeAssetDefinition): string {
  return definition.src.split("/").pop() ?? definition.src;
}
