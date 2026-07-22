import type { Node } from "@xyflow/react";

import {
  countHiddenCollateralLineage,
  findConnectedComponents,
  pickPrimarySpouse,
  type BotanicalCollapsedBranch,
  buildPersonIndex,
} from "./botanical-tree-model";
import {
  BOTANICAL_COMPONENT_GAP,
  BOTANICAL_MEDALLION,
  BOTANICAL_NODE_HEIGHT,
  BOTANICAL_NODE_WIDTH,
  BOTANICAL_TREE_PADDING_BOTTOM,
  BOTANICAL_TREE_PADDING_SIDE,
  BOTANICAL_TREE_PADDING_TOP,
} from "./botanical-tree-theme";
import {
  assignPeopleToTreeAnchors,
  type PersonAnchorAssignment,
  type TreeOverflowGroup,
} from "./tree-anchor-layout";
import { getAnchorsForVariant } from "./tree-anchor-presets";
import {
  getTreeAssetDefinition,
  selectTreeAssetVariant,
  type TreeAssetDefinition,
  type TreeAssetVariant,
} from "./tree-asset-config";
import type { Person, PersonNodeData } from "@/types/family";
import type { TreeViewMode } from "./tree-visibility";

const MEDALLION_CENTER_Y = BOTANICAL_MEDALLION * 0.46;
const SECONDARY_SCALE = 0.42;
const SECONDARY_SLOT_WIDTH = 120;

export type TreeAssetComponentModel = {
  componentId: string;
  focusId: string;
  asset: TreeAssetDefinition;
  renderTreeAsset: boolean;
  imageX: number;
  imageY: number;
  renderedWidth: number;
  renderedHeight: number;
  assignments: PersonAnchorAssignment[];
  overflowGroups: TreeOverflowGroup[];
  collapsed: BotanicalCollapsedBranch[];
  unionDecor: Array<{ x: number; y: number; personA: string; personB: string }>;
};

export type DetachedTreeComponent = {
  componentId: string;
  focusId: string;
  personIds: string[];
  people: Person[];
};

export type TreeAssetLayoutResult = {
  components: TreeAssetComponentModel[];
  detachedComponents: DetachedTreeComponent[];
  nodes: Node<PersonNodeData>[];
  collapsedNodes: Node[];
  width: number;
  height: number;
};

type BuildOptions = {
  people: Person[];
  focusId: string | null;
  viewMode: TreeViewMode;
  expandedCollateral: Set<string>;
  viewportWidth: number;
  isMobile: boolean;
  /** Render detached components on canvas (e.g. «Показать всё»). */
  includeDetachedOnCanvas?: boolean;
  /** Render specific detached components below the main tree. */
  pinnedDetachedFocusIds?: Set<string>;
};

function anchorToNodePosition(
  imageX: number,
  imageY: number,
  renderedWidth: number,
  renderedHeight: number,
  anchorX: number,
  anchorY: number,
): { x: number; y: number } {
  const centerX = imageX + anchorX * renderedWidth;
  const centerY = imageY + anchorY * renderedHeight;
  return {
    x: centerX - BOTANICAL_NODE_WIDTH / 2,
    y: centerY - MEDALLION_CENTER_Y,
  };
}

function buildUnionDecor(
  assignments: PersonAnchorAssignment[],
  focusId: string,
  imageX: number,
  imageY: number,
  renderedWidth: number,
  renderedHeight: number,
  index: ReturnType<typeof buildPersonIndex>,
): TreeAssetComponentModel["unionDecor"] {
  const decor: TreeAssetComponentModel["unionDecor"] = [];
  const seen = new Set<string>();

  const primarySpouse = pickPrimarySpouse(focusId, index);
  if (primarySpouse) {
    const focusA = assignments.find((item) => item.personId === focusId);
    const focusB = assignments.find((item) => item.personId === primarySpouse);
    if (focusA && focusB && focusA.generation === focusB.generation) {
      const ax = imageX + focusA.anchor.x * renderedWidth;
      const ay = imageY + focusA.anchor.y * renderedHeight;
      const bx = imageX + focusB.anchor.x * renderedWidth;
      decor.push({
        x: (ax + bx) / 2,
        y: ay,
        personA: focusId,
        personB: primarySpouse,
      });
      seen.add(`${focusId}:${primarySpouse}`);
    }
  }

  for (const assignment of assignments) {
    if (!assignment.isSpouse) continue;
    for (const spouseId of index.spouseIds.get(assignment.personId) ?? []) {
      const partner = assignments.find((item) => item.personId === spouseId);
      if (!partner || assignment.personId > spouseId) continue;
      const key = `${assignment.personId}:${spouseId}`;
      if (seen.has(key)) continue;
      const ax = imageX + assignment.anchor.x * renderedWidth;
      const ay = imageY + assignment.anchor.y * renderedHeight;
      const bx = imageX + partner.anchor.x * renderedWidth;
      decor.push({ x: (ax + bx) / 2, y: ay, personA: assignment.personId, personB: spouseId });
      seen.add(key);
    }
  }

  return decor;
}

function layoutSecondaryComponent(
  componentIds: string[],
  focusId: string,
  index: ReturnType<typeof buildPersonIndex>,
  expandedCollateral: Set<string>,
  offsetX: number,
  offsetY: number,
  componentId: string,
): {
  assignments: PersonAnchorAssignment[];
  overflowGroups: TreeOverflowGroup[];
  positions: Map<string, { x: number; y: number }>;
} {
  const visibleIds = new Set(componentIds);
  const anchors = getAnchorsForVariant("compact");
  const anchorResult = assignPeopleToTreeAnchors({
    people: [...index.byId.values()].filter((person) =>
      componentIds.includes(person.id),
    ),
    focusedPersonId: focusId,
    visiblePersonIds: visibleIds,
    anchors,
    expandedCollateral,
  });

  const positions = new Map<string, { x: number; y: number }>();
  anchorResult.assignments.forEach((assignment, slotIndex) => {
    const col = slotIndex % 3;
    const row = Math.floor(slotIndex / 3);
    positions.set(assignment.personId, {
      x: offsetX + col * SECONDARY_SLOT_WIDTH,
      y: offsetY + row * (BOTANICAL_NODE_HEIGHT + 24),
    });
  });

  anchorResult.overflowGroups.forEach((group, groupIndex) => {
    positions.set(`__overflow_${group.id}`, {
      x: offsetX + SECONDARY_SLOT_WIDTH * 3 + 8,
      y: offsetY + groupIndex * 36,
    });
  });

  return {
    assignments: anchorResult.assignments,
    overflowGroups: anchorResult.overflowGroups,
    positions,
  };
}

function resolveVariantWithEscalation(options: {
  people: Person[];
  focusId: string;
  visibleIds: Set<string>;
  viewMode: TreeViewMode;
  viewportWidth: number;
  isMobile: boolean;
  expandedCollateral: Set<string>;
}): {
  variant: TreeAssetVariant;
  asset: TreeAssetDefinition;
  anchorResult: ReturnType<typeof assignPeopleToTreeAnchors>;
} {
  const initial = selectTreeAssetVariant({
    visiblePeopleCount: options.visibleIds.size,
    viewMode: options.viewMode,
    viewportWidth: options.viewportWidth,
    isMobile: options.isMobile,
  });

  let variant = initial.variant;
  const assignForVariant = (nextVariant: TreeAssetVariant) => {
    const asset = getTreeAssetDefinition(nextVariant);
    return assignPeopleToTreeAnchors({
      people: options.people,
      focusedPersonId: options.focusId,
      visiblePersonIds: options.visibleIds,
      anchors: getAnchorsForVariant(nextVariant),
      expandedCollateral: options.expandedCollateral,
      collision: {
        renderedWidth: asset.naturalWidth,
        renderedHeight: asset.naturalHeight,
        viewMode: options.viewMode,
      },
    });
  };

  let anchorResult = assignForVariant(variant);

  const order: TreeAssetVariant[] = ["compact", "medium", "wide"];
  let index = order.indexOf(variant);
  while (anchorResult.overflowGroups.length > 0 && index < order.length - 1) {
    index += 1;
    variant = order[index];
    anchorResult = assignForVariant(variant);
  }

  return {
    variant,
    asset: getTreeAssetDefinition(variant),
    anchorResult,
  };
}

export function buildAssetTreeLayout(
  options: BuildOptions,
): TreeAssetLayoutResult {
  const {
    people,
    focusId,
    viewMode,
    expandedCollateral,
    viewportWidth,
    isMobile,
    includeDetachedOnCanvas = false,
    pinnedDetachedFocusIds,
  } = options;

  const index = buildPersonIndex(people);
  const effectiveFocus =
    focusId && index.byId.has(focusId) ? focusId : people[0]?.id ?? "";

  if (people.length === 0 || !effectiveFocus) {
    return {
      components: [],
      detachedComponents: [],
      nodes: [],
      collapsedNodes: [],
      width: 800,
      height: 600,
    };
  }

  const components = findConnectedComponents(people, index);
  const models: TreeAssetComponentModel[] = [];
  const detachedComponents: DetachedTreeComponent[] = [];
  const allNodes: Node<PersonNodeData>[] = [];
  const allCollapsed: Node[] = [];

  let cursorX = BOTANICAL_TREE_PADDING_SIDE;
  const originY = BOTANICAL_TREE_PADDING_TOP;
  let mainTreeBottom = originY;
  let detachedStackIndex = 0;

  components.forEach((componentIds, componentIndex) => {
    const componentFocus = componentIds.includes(effectiveFocus)
      ? effectiveFocus
      : componentIds[0];
    const isMain = componentIds.includes(effectiveFocus);
    const visibleIds = new Set(componentIds);

    if (isMain) {
      const { asset, anchorResult } = resolveVariantWithEscalation({
        people,
        focusId: componentFocus,
        visibleIds,
        viewMode,
        viewportWidth,
        isMobile,
        expandedCollateral,
      });

      const imageX = cursorX;
      const imageY = originY;
      const renderedWidth = asset.naturalWidth;
      const renderedHeight = asset.naturalHeight;

      const displayIds = new Set(
        anchorResult.assignments.map((item) => item.personId),
      );
      const collapsed: BotanicalCollapsedBranch[] = [];
      for (const id of visibleIds) {
        if (displayIds.has(id)) continue;
        const hiddenCount = countHiddenCollateralLineage(
          id,
          visibleIds,
          index,
          displayIds,
        );
        if (hiddenCount <= 0) continue;
        const anchorPerson = anchorResult.assignments.find(
          (item) =>
            item.personId === componentFocus ||
            (index.spouseIds.get(componentFocus) ?? []).includes(item.personId),
        );
        if (!anchorPerson) continue;
        const pos = anchorToNodePosition(
          imageX,
          imageY,
          renderedWidth,
          renderedHeight,
          anchorPerson.anchor.x,
          anchorPerson.anchor.y,
        );
        collapsed.push({
          id: `collapsed-${id}`,
          anchorPersonId: id,
          hiddenCount,
          x: pos.x + BOTANICAL_NODE_WIDTH + 8,
          y: pos.y + 12,
          side: anchorPerson.side === "paternal" ? "paternal" : "maternal",
        });
      }

      for (const assignment of anchorResult.assignments) {
        if (!assignment.isSpouse || assignment.isCentral) continue;
        const hiddenCount = countHiddenCollateralLineage(
          assignment.personId,
          visibleIds,
          index,
          displayIds,
        );
        if (hiddenCount <= 0) continue;
        if (collapsed.some((entry) => entry.anchorPersonId === assignment.personId)) {
          continue;
        }
        const pos = anchorToNodePosition(
          imageX,
          imageY,
          renderedWidth,
          renderedHeight,
          assignment.anchor.x,
          assignment.anchor.y,
        );
        collapsed.push({
          id: `collapsed-${assignment.personId}`,
          anchorPersonId: assignment.personId,
          hiddenCount,
          x: pos.x + BOTANICAL_NODE_WIDTH + 8,
          y: pos.y + 12,
          side: assignment.side === "paternal" ? "paternal" : "maternal",
        });
      }

      models.push({
        componentId: `tree-${componentIndex}`,
        focusId: componentFocus,
        asset,
        renderTreeAsset: true,
        imageX,
        imageY,
        renderedWidth,
        renderedHeight,
        assignments: anchorResult.assignments,
        overflowGroups: anchorResult.overflowGroups,
        collapsed,
        unionDecor: buildUnionDecor(
          anchorResult.assignments,
          componentFocus,
          imageX,
          imageY,
          renderedWidth,
          renderedHeight,
          index,
        ),
      });

      for (const assignment of anchorResult.assignments) {
        const pos = anchorToNodePosition(
          imageX,
          imageY,
          renderedWidth,
          renderedHeight,
          assignment.anchor.x,
          assignment.anchor.y,
        );
        allNodes.push({
          id: assignment.personId,
          type: "person",
          position: pos,
          zIndex: assignment.isCentral ? 30 : 20,
          style: {
            width: BOTANICAL_NODE_WIDTH,
            height: BOTANICAL_NODE_HEIGHT,
          },
          data: {
            person: index.byId.get(assignment.personId)!,
            onSelect: () => undefined,
            detailLevel: "full",
            isBotanicalCentral: assignment.isCentral,
            isBotanicalSpouse: assignment.isSpouse,
            botanicalDisplayLevel: assignment.displayLevel,
            labelPlacement: assignment.labelPlacement ?? "bottom",
          },
          draggable: false,
        });
      }

      for (const group of anchorResult.overflowGroups) {
        const pos = anchorToNodePosition(
          imageX,
          imageY,
          renderedWidth,
          renderedHeight,
          group.x,
          group.y,
        );
        allCollapsed.push({
          id: group.id,
          type: "botanicalCollapsed",
          position: { x: pos.x, y: pos.y },
          zIndex: 25,
          data: {
            hiddenCount: group.personIds.length,
            anchorPersonId: group.personIds[0],
          },
          draggable: false,
          selectable: false,
          focusable: false,
        });
      }

      for (const branch of collapsed) {
        allCollapsed.push({
          id: branch.id,
          type: "botanicalCollapsed",
          position: { x: branch.x, y: branch.y },
          zIndex: 25,
          data: {
            hiddenCount: branch.hiddenCount,
            anchorPersonId: branch.anchorPersonId,
          },
          draggable: false,
          selectable: false,
          focusable: false,
        });
      }

      cursorX += renderedWidth + BOTANICAL_COMPONENT_GAP;
      mainTreeBottom = Math.max(mainTreeBottom, imageY + renderedHeight);
      return;
    }

    const shouldRenderDetached =
      viewMode !== "all" ||
      includeDetachedOnCanvas ||
      pinnedDetachedFocusIds?.has(componentFocus);

    if (!shouldRenderDetached) {
      detachedComponents.push({
        componentId: `tree-${componentIndex}`,
        focusId: componentFocus,
        personIds: componentIds,
        people: componentIds
          .map((personId) => index.byId.get(personId))
          .filter((person): person is Person => Boolean(person)),
      });
      return;
    }

    const detachedOffsetY =
      mainTreeBottom +
      120 +
      detachedStackIndex * (BOTANICAL_NODE_HEIGHT * 3 + 96);
    detachedStackIndex += 1;

    const secondary = layoutSecondaryComponent(
      componentIds,
      componentFocus,
      index,
      expandedCollateral,
      cursorX,
      detachedOffsetY,
      `tree-${componentIndex}`,
    );

    models.push({
      componentId: `tree-${componentIndex}`,
      focusId: componentFocus,
      asset: getTreeAssetDefinition("compact"),
      renderTreeAsset: false,
      imageX: cursorX,
      imageY: detachedOffsetY,
      renderedWidth: SECONDARY_SLOT_WIDTH * 3,
      renderedHeight: BOTANICAL_NODE_HEIGHT * 3,
      assignments: secondary.assignments,
      overflowGroups: secondary.overflowGroups,
      collapsed: [],
      unionDecor: [],
    });

    for (const assignment of secondary.assignments) {
      const pos = secondary.positions.get(assignment.personId);
      if (!pos) continue;
      allNodes.push({
        id: assignment.personId,
        type: "person",
        position: pos,
        zIndex: 15,
        style: {
          width: BOTANICAL_NODE_WIDTH * SECONDARY_SCALE,
          height: BOTANICAL_NODE_HEIGHT * SECONDARY_SCALE,
        },
        data: {
          person: index.byId.get(assignment.personId)!,
          onSelect: () => undefined,
          detailLevel: "compact",
          isBotanicalCentral: assignment.personId === componentFocus,
          isBotanicalSpouse: assignment.isSpouse,
          botanicalDisplayLevel: assignment.displayLevel,
        },
        draggable: false,
      });
    }

    for (const group of secondary.overflowGroups) {
      const pos = secondary.positions.get(`__overflow_${group.id}`);
      if (!pos) continue;
      allCollapsed.push({
        id: group.id,
        type: "botanicalCollapsed",
        position: pos,
        zIndex: 25,
        data: {
          hiddenCount: group.personIds.length,
          anchorPersonId: group.personIds[0],
        },
        draggable: false,
        selectable: false,
        focusable: false,
      });
    }

    cursorX += SECONDARY_SLOT_WIDTH * 4 + BOTANICAL_COMPONENT_GAP;
  });

  const maxX = Math.max(
    ...allNodes.map((node) => node.position.x + BOTANICAL_NODE_WIDTH),
    cursorX,
    800,
  );
  const maxY = Math.max(
    ...allNodes.map((node) => node.position.y + BOTANICAL_NODE_HEIGHT),
    600,
  );

  return {
    components: models,
    detachedComponents,
    nodes: allNodes,
    collapsedNodes: allCollapsed,
    width: maxX + BOTANICAL_TREE_PADDING_SIDE,
    height: maxY + BOTANICAL_TREE_PADDING_BOTTOM,
  };
}

export function validateTreeAssetLayout(
  result: TreeAssetLayoutResult,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const assignedAnchors = new Set<string>();

  for (const component of result.components) {
    for (const assignment of component.assignments) {
      if (assignedAnchors.has(assignment.anchorId)) {
        issues.push(`duplicate-anchor:${assignment.anchorId}`);
      }
      assignedAnchors.add(assignment.anchorId);
      if (
        assignment.anchor.x < 0 ||
        assignment.anchor.x > 1 ||
        assignment.anchor.y < 0 ||
        assignment.anchor.y > 1
      ) {
        issues.push(`anchor-range:${assignment.anchorId}`);
      }
    }
  }

  for (const node of result.nodes) {
    if (
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y)
    ) {
      issues.push(`invalid-node:${node.id}`);
    }
  }

  const mainAssets = result.components.filter((component) => component.renderTreeAsset);
  if (mainAssets.length > 1) {
    issues.push("multiple-main-assets");
  }

  return { valid: issues.length === 0, issues };
}
