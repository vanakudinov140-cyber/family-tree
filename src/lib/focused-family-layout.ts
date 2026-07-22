import type { Node } from "@xyflow/react";

import {
  BOTANICAL_NODE_HEIGHT,
  BOTANICAL_NODE_WIDTH,
  BOTANICAL_TREE_PADDING_BOTTOM,
  BOTANICAL_TREE_PADDING_SIDE,
  BOTANICAL_TREE_PADDING_TOP,
} from "./botanical-tree-theme";
import type { FocusedFamilyModel, FocusedFamilyUnit } from "./focused-family-model";
import {
  getTreeAssetDefinition,
  selectTreeAssetVariant,
  type TreeAssetDefinition,
} from "./tree-asset-config";
import type { TreeAssetComponentModel } from "./tree-asset-layout";
import type { Person, PersonNodeData } from "@/types/family";
import type { TreeViewMode } from "./tree-visibility";

export type FocusedPersonPlacement = {
  personId: string;
  x: number;
  y: number;
  unitId: string;
  rowIndex: number;
  isFocus: boolean;
  isSpouseOfFocus: boolean;
  relationLabel: string;
};

export type SoftLinkGeometry = {
  id: string;
  kind: "spouse" | "parent-child";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FocusedFamilyLayoutResult = {
  model: FocusedFamilyModel;
  placements: FocusedPersonPlacement[];
  nodes: Node<PersonNodeData>[];
  collapsedNodes: Node[];
  softLinks: SoftLinkGeometry[];
  /** Decorative PNG behind people — does not drive coordinates. */
  components: TreeAssetComponentModel[];
  width: number;
  height: number;
  focusCenter: { x: number; y: number };
};

const UNIT_GAP_DESKTOP = 28;
const UNIT_GAP_MOBILE = 14;
const PERSON_GAP_DESKTOP = 18;
const PERSON_GAP_MOBILE = 10;
const NODE_W = BOTANICAL_NODE_WIDTH;
const NODE_H = BOTANICAL_NODE_HEIGHT;
/** Include name plaque under medallion in collision boxes. */
const COLLISION_H = NODE_H + 52;
const COLLISION_GAP = 12;
const WRAP_STAGGER = COLLISION_H + COLLISION_GAP + 10;
const ROW_GAP_DESKTOP = COLLISION_H + 48;
const ROW_GAP_MOBILE = COLLISION_H + 36;

function unitWidth(unit: FocusedFamilyUnit, personGap: number): number {
  if (unit.personIds.length <= 1) return NODE_W;
  return (
    unit.personIds.length * NODE_W + (unit.personIds.length - 1) * personGap
  );
}

function distributeRow(
  units: FocusedFamilyUnit[],
  centerX: number,
  y: number,
  maxWidth: number,
  personGap: number,
  unitGap: number,
  depth = 0,
): Array<{ unit: FocusedFamilyUnit; x: number; y: number; rowOffset: number }> {
  if (units.length === 0) return [];

  const widths = units.map((unit) => unitWidth(unit, personGap));
  const total =
    widths.reduce((sum, w) => sum + w, 0) +
    unitGap * Math.max(0, units.length - 1);

  if (total <= maxWidth || units.length === 1 || depth >= 5) {
    let cursor = centerX - total / 2;
    return units.map((unit, index) => {
      const width = widths[index];
      const x = cursor + width / 2;
      cursor += width + unitGap;
      return { unit, x, y, rowOffset: 0 };
    });
  }

  const mid = Math.ceil(units.length / 2);
  const stagger = WRAP_STAGGER + depth * 12;
  const top = distributeRow(
    units.slice(0, mid),
    centerX,
    y - stagger / 2,
    maxWidth,
    personGap,
    unitGap,
    depth + 1,
  );
  const bottom = distributeRow(
    units.slice(mid),
    centerX,
    y + stagger / 2,
    maxWidth,
    personGap,
    unitGap,
    depth + 1,
  );
  return [
    ...top.map((item) => ({ ...item, rowOffset: -1 })),
    ...bottom.map((item) => ({ ...item, rowOffset: 1 })),
  ];
}

function placeUnitPeople(
  unit: FocusedFamilyUnit,
  unitCenterX: number,
  y: number,
  focusId: string,
  relations: FocusedFamilyModel["relations"],
  personGap: number,
): FocusedPersonPlacement[] {
  const count = unit.personIds.length;
  if (count === 0) return [];
  const total = count * NODE_W + (count - 1) * personGap;
  let cursor = unitCenterX - total / 2;
  return unit.personIds.map((personId) => {
    const x = cursor + NODE_W / 2;
    cursor += NODE_W + personGap;
    return {
      personId,
      x: x - NODE_W / 2,
      y: y - NODE_H * 0.35,
      unitId: unit.id,
      rowIndex: 0,
      isFocus: personId === focusId,
      isSpouseOfFocus:
        Boolean(relations.get(personId)?.kind === "spouse") &&
        personId !== focusId,
      relationLabel: relations.get(personId)?.label ?? "",
    };
  });
}

function rectanglesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap = COLLISION_GAP,
): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function resolvePlacementCollisions(
  placements: FocusedPersonPlacement[],
): FocusedPersonPlacement[] {
  const next = placements.map((item) => ({ ...item }));
  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const aBox = {
          x: next[i].x,
          y: next[i].y,
          w: NODE_W,
          h: COLLISION_H,
        };
        const bBox = {
          x: next[j].x,
          y: next[j].y,
          w: NODE_W,
          h: COLLISION_H,
        };
        if (!rectanglesOverlap(aBox, bBox)) continue;

        if (next[i].rowIndex !== next[j].rowIndex) {
          const lower =
            next[i].rowIndex > next[j].rowIndex ? i : j;
          const upper = lower === i ? j : i;
          const needed =
            next[upper].y + COLLISION_H + COLLISION_GAP - next[lower].y;
          if (needed > 0) {
            next[lower] = { ...next[lower], y: next[lower].y + needed };
            moved = true;
          }
          continue;
        }

        const move = next[i].isFocus ? j : next[j].isFocus ? i : j;
        const other = move === i ? j : i;
        const overlapX =
          NODE_W + COLLISION_GAP - Math.abs(next[move].x - next[other].x);
        const overlapY =
          COLLISION_H + COLLISION_GAP - Math.abs(next[move].y - next[other].y);
        const sameBand = Math.abs(next[move].y - next[other].y) < NODE_H * 0.45;

        if (!sameBand) {
          // Wrapped sub-row: push the lower plaque further down.
          const lower = next[move].y >= next[other].y ? move : other;
          const upper = lower === move ? other : move;
          const needed =
            next[upper].y + COLLISION_H + COLLISION_GAP - next[lower].y;
          if (needed > 0) {
            next[lower] = { ...next[lower], y: next[lower].y + needed };
            moved = true;
          }
          continue;
        }

        const direction = next[move].x >= next[other].x ? 1 : -1;
        next[move] = {
          ...next[move],
          x: next[move].x + direction * Math.max(overlapX, NODE_W * 0.3),
        };
        moved = true;
        void overlapY;
      }
    }
    if (!moved) break;
  }
  return next;
}

export function buildFocusedFamilyLayout(input: {
  model: FocusedFamilyModel;
  people: Person[];
  viewportWidth: number;
  isMobile: boolean;
  viewMode: TreeViewMode;
}): FocusedFamilyLayoutResult {
  const { model, people, viewportWidth, isMobile, viewMode } = input;
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const personGap = isMobile ? PERSON_GAP_MOBILE : PERSON_GAP_DESKTOP;
  const unitGap = isMobile ? UNIT_GAP_MOBILE : UNIT_GAP_DESKTOP;
  const rowGap = isMobile ? ROW_GAP_MOBILE : ROW_GAP_DESKTOP;

  // On mobile use real viewport width so rows wrap instead of overflowing.
  const contentWidth = Math.max(
    isMobile ? Math.max(320, viewportWidth - 16) : 640,
    viewportWidth - (isMobile ? 16 : 120),
  );
  const centerX = contentWidth / 2 + BOTANICAL_TREE_PADDING_SIDE;
  const startY = BOTANICAL_TREE_PADDING_TOP + 40;

  const placements: FocusedPersonPlacement[] = [];
  let cursorY = startY;

  // Heritage art: younger generations visually higher → levels already ordered top→bottom.
  for (const level of model.levels) {
    const distributed = distributeRow(
      level.units,
      centerX,
      cursorY,
      contentWidth * (isMobile ? 0.96 : 0.92),
      personGap,
      unitGap,
    );
    let levelMaxY = cursorY;
    for (const item of distributed) {
      const unitPlacements = placeUnitPeople(
        item.unit,
        item.x,
        item.y,
        model.focusId,
        model.relations,
        personGap,
      );
      for (const placement of unitPlacements) {
        placements.push({
          ...placement,
          rowIndex: level.rowIndex,
        });
        levelMaxY = Math.max(levelMaxY, placement.y + COLLISION_H);
      }
    }
    cursorY = Math.max(cursorY + rowGap, levelMaxY + 28);
  }

  let resolved = resolvePlacementCollisions(placements);

  // Ensure focus near horizontal center of composition.
  const focusPlacement = resolved.find((item) => item.isFocus);
  if (focusPlacement) {
    const dx = centerX - NODE_W / 2 - focusPlacement.x;
    if (Math.abs(dx) > 8) {
      // Shift only the focus row slightly toward center if focus drifted.
      resolved = resolved.map((item) =>
        item.rowIndex === focusPlacement.rowIndex
          ? { ...item, x: item.x + dx * 0.85 }
          : item,
      );
      resolved = resolvePlacementCollisions(resolved);
    }
  }

  const focusFinal =
    resolved.find((item) => item.isFocus) ??
    ({
      personId: model.focusId,
      x: centerX - NODE_W / 2,
      y: startY + rowGap,
      unitId: "focus",
      rowIndex: 0,
      isFocus: true,
      isSpouseOfFocus: false,
      relationLabel: "центр",
    } satisfies FocusedPersonPlacement);

  const nodes: Node<PersonNodeData>[] = [];
  for (const placement of resolved) {
    const person = peopleById.get(placement.personId);
    if (!person) continue;
    nodes.push({
      id: placement.personId,
      type: "person",
      position: { x: placement.x, y: placement.y },
      zIndex: placement.isFocus ? 40 : 20,
      style: { width: NODE_W, height: NODE_H },
      data: {
        person,
        onSelect: () => undefined,
        detailLevel: "full",
        isBotanicalCentral: placement.isFocus,
        isBotanicalSpouse: placement.isSpouseOfFocus,
        botanicalDisplayLevel: placement.isFocus
          ? "central"
          : placement.isSpouseOfFocus
            ? "primary"
            : "normal",
        labelPlacement: "bottom",
        relationToFocusLabel: placement.relationLabel,
      },
      draggable: false,
    });
  }

  const byId = new Map(resolved.map((item) => [item.personId, item]));
  const softLinks: SoftLinkGeometry[] = [];
  for (const link of model.softLinks) {
    const a = byId.get(link.sourceId);
    const b = byId.get(link.targetId);
    if (!a || !b) continue;
    softLinks.push({
      id: link.id,
      kind: link.kind,
      x1: a.x + NODE_W / 2,
      y1: a.y + NODE_H * 0.35,
      x2: b.x + NODE_W / 2,
      y2: b.y + NODE_H * 0.35,
    });
  }

  const maxX = Math.max(
    ...resolved.map((item) => item.x + NODE_W),
    centerX + 400,
    800,
  );
  const maxY = Math.max(
    ...resolved.map((item) => item.y + NODE_H),
    cursorY + 120,
    600,
  );

  const asset = selectDecorativeAsset(resolved.length, viewMode, viewportWidth, isMobile);
  const treeWidth = asset.naturalWidth;
  const treeHeight = asset.naturalHeight;
  const imageX = focusFinal.x + NODE_W / 2 - treeWidth / 2;
  const imageY = Math.max(0, focusFinal.y + NODE_H / 2 - treeHeight * 0.55);

  const components: TreeAssetComponentModel[] = [
    {
      componentId: "decorative-tree",
      focusId: model.focusId,
      asset,
      renderTreeAsset: true,
      imageX,
      imageY,
      renderedWidth: treeWidth,
      renderedHeight: treeHeight,
      assignments: [],
      overflowGroups: [],
      collapsed: [],
      unionDecor: [],
    },
  ];

  // Branch cards as collapsed-style nodes for branch/all modes
  const collapsedNodes: Node[] = [];
  if (viewMode === "branch" || viewMode === "all") {
    let cardY = maxY + 48;
    for (const card of model.branchCards) {
      if (card.peopleCount <= 1 && viewMode === "branch") continue;
      // Skip cards whose people are all already on canvas for branch core
      const missing = card.personIds.filter((id) => !byId.has(id));
      if (viewMode === "branch" && missing.length === 0) continue;
      collapsedNodes.push({
        id: card.id,
        type: "botanicalCollapsed",
        position: { x: centerX - 70, y: cardY },
        zIndex: 25,
        data: {
          hiddenCount: card.peopleCount,
          anchorPersonId: card.rootPersonId,
          branchTitle: card.title,
        },
        draggable: false,
        selectable: true,
        focusable: true,
      });
      cardY += 44;
    }
  }

  return {
    model,
    placements: resolved,
    nodes,
    collapsedNodes,
    softLinks,
    components,
    width: maxX + BOTANICAL_TREE_PADDING_SIDE,
    height: Math.max(maxY, cardBottom(collapsedNodes)) + BOTANICAL_TREE_PADDING_BOTTOM,
    focusCenter: {
      x: focusFinal.x + NODE_W / 2,
      y: focusFinal.y + NODE_H * 0.35,
    },
  };
}

function cardBottom(nodes: Node[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((node) => node.position.y + 40));
}

function selectDecorativeAsset(
  peopleCount: number,
  viewMode: TreeViewMode,
  viewportWidth: number,
  isMobile: boolean,
): TreeAssetDefinition {
  const selected = selectTreeAssetVariant({
    visiblePeopleCount: Math.max(1, peopleCount),
    viewMode,
    viewportWidth,
    isMobile,
  });
  return getTreeAssetDefinition(selected.variant);
}

export function validateFocusedLayoutNoCollisions(
  placements: FocusedPersonPlacement[],
): boolean {
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      if (
        rectanglesOverlap(
          {
            x: placements[i].x,
            y: placements[i].y,
            w: NODE_W,
            h: COLLISION_H,
          },
          {
            x: placements[j].x,
            y: placements[j].y,
            w: NODE_W,
            h: COLLISION_H,
          },
        )
      ) {
        return false;
      }
    }
  }
  return true;
}
