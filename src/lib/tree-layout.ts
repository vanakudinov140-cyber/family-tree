import type { Edge, Node } from "@xyflow/react";
import { Position } from "@xyflow/react";

import {
  edgeLabelForMeta,
  parentEdgeStyle,
  spouseEdgeStyle,
  type EdgeVisualMeta,
} from "@/lib/edge-styles";
import {
  getComponentBounds,
  logCollisionsInDev,
  resolveComponentCollisions,
  resolveGenerationCollisions,
  validateNoPersonNodeCollisions,
  type CollisionMetrics,
} from "@/lib/tree-collision";
import type {
  Confidence,
  ParentKind,
  Person,
  PersonNodeData,
  SpouseStatus,
} from "@/types/family";

export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 125;
/** Gap between spouses — tighter than sibling spacing. */
export const SPOUSE_GAP = 40;
export const UNION_GAP = SPOUSE_GAP;
/** Gap between sibling branches. */
export const SIBLING_GAP = 80;
export const PERSON_GAP = SIBLING_GAP;
/** Vertical gap I → II (~20% tighter than 168). */
export const GENERATION_GAP_FIRST = 134;
/** Vertical gap II → III (~15% tighter than 168). */
export const GENERATION_GAP_NEXT = 143;
export const GENERATION_GAP = GENERATION_GAP_FIRST;
export const TREE_TOP_PADDING = 28;
export const TREE_SIDE_PADDING = 48;
export const INITIAL_ZOOM = 1.0;
export const FOCUS_ZOOM = 1.0;
export const SEARCH_ZOOM_MIN = 0.9;
export const SEARCH_ZOOM_MAX = 1.1;
export const NEARBY_ZOOM = 1.0;
export const GENERATIONS_ZOOM = 0.96;
export const BRANCH_ZOOM = 0.85;
/** Padding for the explicit «Показать всё» action. */
export const FIT_PADDING = 0.14;
export const FIT_MAX_ZOOM = 1.0;
/** Absolute React Flow floor — overview actions clamp higher via ALL_OVERVIEW_MIN_ZOOM. */
export const FIT_MIN_ZOOM = 0.28;
/** Diagram «Вся семья» initial framing — keeps cards readable on desktop. */
export const DIAGRAM_ALL_MIN_ZOOM = 0.68;
/** Diagram «Показать всё» may zoom out further. */
export const DIAGRAM_ALL_FIT_MIN_ZOOM = 0.36;
export const COMPACT_ZOOM_THRESHOLD = 0.7;
import {
  DIAGRAM_EDGE_STROKE,
  DIAGRAM_EDGE_STROKE_WIDTH,
} from "@/lib/diagram-theme";

export const EDGE_STROKE = DIAGRAM_EDGE_STROKE;
export const EDGE_STROKE_WIDTH = DIAGRAM_EDGE_STROKE_WIDTH;

export interface LayoutSpacing {
  spouseGap: number;
  siblingGap: number;
  generationGapFirst: number;
  generationGapNext: number;
  componentGap: number;
  sidePadding: number;
  topPadding: number;
}

export interface LayoutNodeSize {
  width: number;
  height: number;
}

export const DEFAULT_LAYOUT_SPACING: LayoutSpacing = {
  spouseGap: SPOUSE_GAP,
  siblingGap: SIBLING_GAP,
  generationGapFirst: GENERATION_GAP_FIRST,
  generationGapNext: GENERATION_GAP_NEXT,
  componentGap: SIBLING_GAP,
  sidePadding: TREE_SIDE_PADDING,
  topPadding: TREE_TOP_PADDING,
};

/** Compact packing for heritage «Вся семья» — gaps relative to larger heritage boxes. */
export const HERITAGE_ALL_LAYOUT_SPACING: LayoutSpacing = {
  spouseGap: 24,
  siblingGap: 32,
  generationGapFirst: 36,
  generationGapNext: 40,
  componentGap: 48,
  sidePadding: 28,
  topPadding: 20,
};

export const HERITAGE_BRANCH_LAYOUT_SPACING: LayoutSpacing = {
  spouseGap: 28,
  siblingGap: 40,
  generationGapFirst: 44,
  generationGapNext: 48,
  componentGap: 56,
  sidePadding: 36,
  topPadding: 24,
};

export const HERITAGE_NEARBY_LAYOUT_SPACING: LayoutSpacing = {
  spouseGap: 32,
  siblingGap: 48,
  generationGapFirst: 48,
  generationGapNext: 52,
  componentGap: 56,
  sidePadding: 40,
  topPadding: 28,
};

export const DIAGRAM_NODE_SIZE: LayoutNodeSize = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
};

/** Active spacing / size for the current layout pass (single-threaded). */
let layoutSpacing: LayoutSpacing = DEFAULT_LAYOUT_SPACING;
let layoutNodeWidth = NODE_WIDTH;
let layoutNodeHeight = NODE_HEIGHT;

function spouseGap(): number {
  return layoutSpacing.spouseGap;
}

function siblingGap(): number {
  return layoutSpacing.siblingGap;
}

function componentGap(): number {
  return layoutSpacing.componentGap;
}

function nodeW(): number {
  return layoutNodeWidth;
}

function nodeH(): number {
  return layoutNodeHeight;
}

const ROMAN_NUMERALS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const;

export function generationLabelForIndex(generation: number): string {
  const roman = ROMAN_NUMERALS[generation];
  if (roman) {
    return `${roman} поколение`;
  }
  return `${generation + 1} поколение`;
}

/** @deprecated Use generationLabelForIndex — kept for call-site compatibility. */
export const GENERATION_LABELS = ROMAN_NUMERALS.map(
  (roman) => `${roman} поколение`,
);

interface MarriageUnit {
  partnerA: string;
  partnerB: string;
  children: LayoutBlock[];
}

interface LayoutBlock {
  /** People in this generation row, left → right. */
  memberIds: string[];
  /** Shared focus when multiple spouses share one person. */
  focusId: string;
  marriages: MarriageUnit[];
  /** Children attached only to focus (no co-parent among members). */
  soloChildren: LayoutBlock[];
}

interface MeasuredMarriage extends MarriageUnit {
  children: MeasuredBlock[];
  width: number;
}

interface MeasuredBlock extends Omit<LayoutBlock, "marriages" | "soloChildren"> {
  marriages: MeasuredMarriage[];
  soloChildren: MeasuredBlock[];
  width: number;
}

interface JunctionInfo {
  id: string;
  x: number;
  y: number;
  kind: "union" | "distributor" | "entry";
  parentIds: string[];
  targetIds: string[];
  visible?: boolean;
  spouseStatus?: SpouseStatus;
  confidence?: Confidence;
}

interface DirectLink {
  sourceId: string;
  targetId: string;
  relatedIds: string[];
  parentKind?: ParentKind;
  confidence?: Confidence;
}

function generationGap(generation: number): number {
  return generation === 0
    ? layoutSpacing.generationGapFirst
    : layoutSpacing.generationGapNext;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function personSpouseIds(person: Person): string[] {
  if (person.spouseIds && person.spouseIds.length > 0) {
    return uniqueIds(person.spouseIds);
  }
  return person.spouseId ? [person.spouseId] : [];
}

function orderCouple(
  a: string,
  b: string,
  byId: Map<string, Person>,
): [string, string] {
  const dateA = byId.get(a)?.birthDate;
  const dateB = byId.get(b)?.birthDate;
  if (dateA && dateB) {
    const yearA = new Date(dateA).getFullYear();
    const yearB = new Date(dateB).getFullYear();
    return yearA <= yearB ? [a, b] : [b, a];
  }
  return a <= b ? [a, b] : [b, a];
}

function membersWidth(memberCount: number): number {
  if (memberCount <= 1) {
    return nodeW();
  }
  return nodeW() * memberCount + spouseGap() * (memberCount - 1);
}

function resolveSpouseMeta(
  a: string,
  b: string,
  byId: Map<string, Person>,
): { status: SpouseStatus; confidence: Confidence } {
  const person = byId.get(a);
  const link = person?.spouseLinks?.find((item) => item.spouseId === b);
  if (link) {
    return { status: link.status, confidence: link.confidence };
  }
  const other = byId.get(b);
  const reverse = other?.spouseLinks?.find((item) => item.spouseId === a);
  if (reverse) {
    return { status: reverse.status, confidence: reverse.confidence };
  }
  return { status: "unknown", confidence: "confirmed" };
}

function resolveParentMeta(
  parentId: string,
  childId: string,
  byId: Map<string, Person>,
): { kind: ParentKind; confidence: Confidence } {
  const child = byId.get(childId);
  const link = child?.parentLinks?.find((item) => item.parentId === parentId);
  if (link) {
    return { kind: link.kind, confidence: link.confidence };
  }
  return { kind: "biological", confidence: "confirmed" };
}

function childCoParents(
  childId: string,
  byId: Map<string, Person>,
): string[] {
  return byId.get(childId)?.parentIds ?? [];
}

export function buildFamilyBlocks(people: Person[]): LayoutBlock[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const visited = new Set<string>();

  function buildPersonBlock(personId: string): LayoutBlock | null {
    if (visited.has(personId)) {
      return null;
    }

    const person = byId.get(personId);
    if (!person) {
      return null;
    }

    const availableSpouses = personSpouseIds(person).filter(
      (spouseId) => byId.has(spouseId) && !visited.has(spouseId),
    );

    // Single spouse — keep classic couple layout.
    if (availableSpouses.length === 1) {
      const partnerId = availableSpouses[0];
      const memberIds = orderCouple(personId, partnerId, byId);
      memberIds.forEach((id) => visited.add(id));

      const sharedChildIds = uniqueIds(
        memberIds.flatMap((id) => byId.get(id)?.childIds ?? []),
      ).filter((childId) => {
        const parents = childCoParents(childId, byId);
        return memberIds.every((memberId) => parents.includes(memberId))
          || parents.some((parentId) => memberIds.includes(parentId));
      });

      // Prefer children who list at least one member as parent.
      const childIds = uniqueIds(
        memberIds.flatMap((id) => byId.get(id)?.childIds ?? []),
      ).filter((childId) =>
        childCoParents(childId, byId).some((parentId) =>
          memberIds.includes(parentId),
        ),
      );

      void sharedChildIds;

      const children = childIds
        .map((childId) => buildPersonBlock(childId))
        .filter((block): block is LayoutBlock => block !== null);

      return {
        memberIds,
        focusId: personId,
        marriages: [
          {
            partnerA: memberIds[0],
            partnerB: memberIds[1],
            children,
          },
        ],
        soloChildren: [],
      };
    }

    // Multiple spouses: Spouse1 — Person — Spouse2 (no spouse-to-spouse link).
    if (availableSpouses.length >= 2) {
      const sortedSpouses = [...availableSpouses].sort((a, b) => {
        const statusRank = (id: string) => {
          const link = person.spouseLinks?.find((item) => item.spouseId === id);
          if (link?.status === "current") return 0;
          if (link?.status === "unknown") return 1;
          return 2;
        };
        const rankDiff = statusRank(a) - statusRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.localeCompare(b);
      });

      const leftCount = Math.floor(sortedSpouses.length / 2);
      const left = sortedSpouses.slice(0, leftCount).reverse();
      const right = sortedSpouses.slice(leftCount);
      const memberIds = [...left, personId, ...right];

      memberIds.forEach((id) => visited.add(id));

      const assignedChildren = new Set<string>();
      const marriages: MarriageUnit[] = sortedSpouses.map((spouseId) => {
        const shared = uniqueIds([
          ...(byId.get(personId)?.childIds ?? []),
          ...(byId.get(spouseId)?.childIds ?? []),
        ]).filter((childId) => {
          if (assignedChildren.has(childId)) return false;
          const parents = childCoParents(childId, byId);
          return parents.includes(personId) && parents.includes(spouseId);
        });

        shared.forEach((id) => assignedChildren.add(id));

        const children = shared
          .map((childId) => buildPersonBlock(childId))
          .filter((block): block is LayoutBlock => block !== null);

        return {
          partnerA: personId,
          partnerB: spouseId,
          children,
        };
      });

      // Stepchildren of a spouse (other parent may be outside this row).
      for (const spouseId of sortedSpouses) {
        const stepKids = (byId.get(spouseId)?.childIds ?? []).filter(
          (childId) => {
            if (assignedChildren.has(childId)) return false;
            const parents = childCoParents(childId, byId);
            return parents.includes(spouseId) && !parents.includes(personId);
          },
        );

        if (stepKids.length === 0) continue;

        stepKids.forEach((id) => assignedChildren.add(id));
        const children = stepKids
          .map((childId) => buildPersonBlock(childId))
          .filter((block): block is LayoutBlock => block !== null);

        // Attach under the spouse alone via a marriage with focus still listed
        // for union placement near that spouse — use spouse + optional other parent.
        const otherParents = uniqueIds(
          stepKids.flatMap((childId) =>
            childCoParents(childId, byId).filter(
              (parentId) => parentId !== spouseId && byId.has(parentId),
            ),
          ),
        ).filter((parentId) => !visited.has(parentId));

        if (otherParents.length === 1) {
          const otherId = otherParents[0];
          visited.add(otherId);
          // Insert other parent adjacent to spouse in the row.
          const spouseIndex = memberIds.indexOf(spouseId);
          if (spouseIndex === 0) {
            memberIds.unshift(otherId);
          } else if (spouseIndex === memberIds.length - 1) {
            memberIds.push(otherId);
          } else if (spouseIndex < memberIds.indexOf(personId)) {
            memberIds.splice(spouseIndex, 0, otherId);
          } else {
            memberIds.splice(spouseIndex + 1, 0, otherId);
          }

          marriages.push({
            partnerA: spouseId,
            partnerB: otherId,
            children,
          });
        } else {
          marriages.push({
            partnerA: spouseId,
            partnerB: spouseId,
            children,
          });
        }
      }

      const soloChildIds = (byId.get(personId)?.childIds ?? []).filter(
        (childId) => !assignedChildren.has(childId),
      );
      soloChildIds.forEach((id) => assignedChildren.add(id));
      const soloChildren = soloChildIds
        .map((childId) => buildPersonBlock(childId))
        .filter((block): block is LayoutBlock => block !== null);

      return {
        memberIds,
        focusId: personId,
        marriages,
        soloChildren,
      };
    }

    // No spouse in this block.
    visited.add(personId);
    const childIds = uniqueIds(person.childIds ?? []);
    const soloChildren = childIds
      .map((childId) => buildPersonBlock(childId))
      .filter((block): block is LayoutBlock => block !== null);

    return {
      memberIds: [personId],
      focusId: personId,
      marriages: [],
      soloChildren,
    };
  }

  /**
   * Layout roots for the current people subset:
   * - no parent present in this subset;
   * - not merely a spouse of someone who does have a parent in-subset
   *   (otherwise the spouse "steals" the bloodline and truncates generations).
   */
  function isLayoutRoot(person: Person): boolean {
    const hasParentInSet = (person.parentIds ?? []).some((parentId) =>
      byId.has(parentId),
    );
    if (hasParentInSet) {
      return false;
    }

    for (const spouseId of personSpouseIds(person)) {
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      const spouseHasParentInSet = (spouse.parentIds ?? []).some((parentId) =>
        byId.has(parentId),
      );
      if (spouseHasParentInSet) {
        return false;
      }
    }

    return true;
  }

  const roots = people.filter(isLayoutRoot);
  const rootBlocks: LayoutBlock[] = [];

  for (const root of roots) {
    if (visited.has(root.id)) {
      continue;
    }
    const block = buildPersonBlock(root.id);
    if (block) {
      rootBlocks.push(block);
    }
  }

  for (const person of people) {
    if (!visited.has(person.id)) {
      const block = buildPersonBlock(person.id);
      if (block) {
        rootBlocks.push(block);
      }
    }
  }

  return rootBlocks;
}

function measureBlock(block: LayoutBlock): MeasuredBlock {
  const gap = siblingGap();
  const marriages: MeasuredMarriage[] = block.marriages.map((marriage) => {
    const children = marriage.children.map(measureBlock);
    const childrenWidth =
      children.length === 0
        ? 0
        : children.reduce((sum, child) => sum + child.width, 0) +
          gap * (children.length - 1);
    return {
      ...marriage,
      children,
      width: Math.max(membersWidth(2), childrenWidth),
    };
  });

  const soloChildren = block.soloChildren.map(measureBlock);
  const rowWidth = membersWidth(block.memberIds.length);

  const marriagesWidth =
    marriages.length === 0
      ? 0
      : marriages.reduce((sum, marriage) => sum + marriage.width, 0) +
        gap * Math.max(marriages.length - 1, 0);

  const soloWidth =
    soloChildren.length === 0
      ? 0
      : soloChildren.reduce((sum, child) => sum + child.width, 0) +
        gap * (soloChildren.length - 1);

  const contentParts = [marriagesWidth, soloWidth].filter((value) => value > 0);
  const contentWidth =
    contentParts.length === 0
      ? 0
      : contentParts.reduce((sum, value) => sum + value, 0) +
        gap * (contentParts.length - 1);

  return {
    memberIds: block.memberIds,
    focusId: block.focusId,
    marriages,
    soloChildren,
    width: Math.max(rowWidth, contentWidth, nodeW()),
  };
}

function bloodChildInBlock(
  child: MeasuredBlock,
  parentIds: string[],
  byId: Map<string, Person>,
): string {
  if (child.memberIds.length === 1) {
    return child.memberIds[0];
  }
  const bloodChildId = child.memberIds.find((memberId) =>
    byId
      .get(memberId)
      ?.parentIds.some((parentId) => parentIds.includes(parentId)),
  );
  return bloodChildId ?? child.memberIds[0];
}

function placeChildrenGroup(
  children: MeasuredBlock[],
  left: number,
  childTop: number,
  parentIds: string[],
  sourceId: string,
  coupleCenterX: number,
  parentTop: number,
  gap: number,
  positions: Map<string, { x: number; y: number }>,
  junctions: JunctionInfo[],
  directLinks: DirectLink[],
  generationYs: Map<number, number>,
  generation: number,
  byId: Map<string, Person>,
): void {
  if (children.length === 0) {
    return;
  }

  const childrenWidth =
    children.reduce((sum, child) => sum + child.width, 0) +
    siblingGap() * (children.length - 1);
  let childLeft = left;
  const childTargets: string[] = [];

  for (const child of children) {
    placeBlock(
      child,
      childLeft,
      childTop,
      positions,
      junctions,
      directLinks,
      generationYs,
      generation + 1,
      byId,
    );
    childTargets.push(bloodChildInBlock(child, parentIds, byId));
    childLeft += child.width + siblingGap();
  }

  const relatedParentIds = [...parentIds];

  if (childTargets.length === 1) {
    const childId = childTargets[0];
    const meta =
      parentIds.length === 1
        ? resolveParentMeta(parentIds[0], childId, byId)
        : resolveParentMeta(parentIds[0], childId, byId);
    directLinks.push({
      sourceId,
      targetId: childId,
      relatedIds: uniqueIds([...relatedParentIds, childId]),
      parentKind: meta.kind,
      confidence: meta.confidence,
    });
    return;
  }

  const distributorId = `j-dist-${parentIds.join("__")}-${sourceId}`;
  junctions.push({
    id: distributorId,
    x: coupleCenterX,
    y: parentTop + nodeH() + gap / 2,
    kind: "distributor",
    parentIds: [sourceId],
    targetIds: childTargets,
  });

  // Annotate distributor→child edges later via relatedIds only;
  // parent kind applied when edges are built if single-parent meta needed.
  void childrenWidth;
}

function placeBlock(
  block: MeasuredBlock,
  left: number,
  top: number,
  positions: Map<string, { x: number; y: number }>,
  junctions: JunctionInfo[],
  directLinks: DirectLink[],
  generationYs: Map<number, number>,
  generation: number,
  byId: Map<string, Person>,
): void {
  const rowWidth = membersWidth(block.memberIds.length);
  const membersLeft = left + (block.width - rowWidth) / 2;
  const width = nodeW();
  const height = nodeH();

  generationYs.set(generation, top);

  block.memberIds.forEach((memberId, index) => {
    positions.set(memberId, {
      x: membersLeft + index * (width + spouseGap()),
      y: top,
    });
  });

  const gap = generationGap(generation);
  const childTop = top + height + gap;

  const marriagesWithChildren = block.marriages.filter(
    (marriage) => marriage.children.length > 0,
  );
  const marriagesWidth =
    marriagesWithChildren.length === 0
      ? 0
      : marriagesWithChildren.reduce((sum, marriage) => sum + marriage.width, 0) +
        siblingGap() * Math.max(marriagesWithChildren.length - 1, 0);
  const soloWidth =
    block.soloChildren.length === 0
      ? 0
      : block.soloChildren.reduce((sum, child) => sum + child.width, 0) +
        siblingGap() * (block.soloChildren.length - 1);
  const contentParts = [marriagesWidth, soloWidth].filter((value) => value > 0);
  const contentWidth =
    contentParts.length === 0
      ? 0
      : contentParts.reduce((sum, value) => sum + value, 0) +
        siblingGap() * (contentParts.length - 1);
  let contentCursor = left + Math.max(0, (block.width - contentWidth) / 2);

  // Place marriage unions between partners; children laid out sequentially
  // so sibling unions never share the same horizontal strip.
  for (const marriage of block.marriages) {
    if (marriage.partnerA === marriage.partnerB) {
      const soloParent = marriage.partnerA;
      const parentPos = positions.get(soloParent);
      if (!parentPos) continue;

      if (marriage.children.length > 0) {
        placeChildrenGroup(
          marriage.children,
          contentCursor,
          childTop,
          [soloParent],
          soloParent,
          parentPos.x + width / 2,
          top,
          gap,
          positions,
          junctions,
          directLinks,
          generationYs,
          generation,
          byId,
        );
        contentCursor += marriage.width + siblingGap();
      }
      continue;
    }

    const posA = positions.get(marriage.partnerA);
    const posB = positions.get(marriage.partnerB);
    if (!posA || !posB) continue;

    const leftPartner =
      posA.x <= posB.x ? marriage.partnerA : marriage.partnerB;
    const rightPartner =
      leftPartner === marriage.partnerA
        ? marriage.partnerB
        : marriage.partnerA;
    const leftPos = positions.get(leftPartner)!;
    const rightPos = positions.get(rightPartner)!;
    const unionX =
      (leftPos.x + width / 2 + rightPos.x + width / 2) / 2;
    const unionId = `j-union-${[leftPartner, rightPartner].sort().join("__")}`;

    const spouseMeta = resolveSpouseMeta(leftPartner, rightPartner, byId);

    if (!junctions.some((junction) => junction.id === unionId)) {
      junctions.push({
        id: unionId,
        x: unionX,
        y: top + height / 2,
        kind: "union",
        parentIds: [leftPartner, rightPartner],
        targetIds: [],
        visible: true,
        spouseStatus: spouseMeta.status,
        confidence: spouseMeta.confidence,
      });
    }

    if (marriage.children.length === 0) {
      continue;
    }

    const marriageCenterX = contentCursor + marriage.width / 2;
    placeChildrenGroup(
      marriage.children,
      contentCursor,
      childTop,
      [leftPartner, rightPartner],
      unionId,
      marriageCenterX,
      top,
      gap,
      positions,
      junctions,
      directLinks,
      generationYs,
      generation,
      byId,
    );
    contentCursor += marriage.width + siblingGap();
  }

  if (block.soloChildren.length > 0) {
    const focusPos = positions.get(block.focusId);
    if (focusPos) {
      placeChildrenGroup(
        block.soloChildren,
        contentCursor,
        childTop,
        [block.focusId],
        block.focusId,
        focusPos.x + width / 2,
        top,
        gap,
        positions,
        junctions,
        directLinks,
        generationYs,
        generation,
        byId,
      );
    }
  }
}

export function buildLayoutedGraph(
  people: Person[],
  options?: {
    spacing?: LayoutSpacing;
    nodeSize?: LayoutNodeSize;
    resolveCollisions?: boolean;
    collisionGapX?: number;
    collisionGapY?: number;
    componentGapX?: number;
  },
): {
  nodes: Node<PersonNodeData>[];
  junctionNodes: Node[];
  generationNodes: Node[];
  edges: Edge[];
} {
  const previousSpacing = layoutSpacing;
  const previousWidth = layoutNodeWidth;
  const previousHeight = layoutNodeHeight;
  layoutSpacing = options?.spacing ?? DEFAULT_LAYOUT_SPACING;
  layoutNodeWidth = options?.nodeSize?.width ?? NODE_WIDTH;
  layoutNodeHeight = options?.nodeSize?.height ?? NODE_HEIGHT;

  try {
    return buildLayoutedGraphWithActiveSpacing(people, {
      resolveCollisions: options?.resolveCollisions ?? false,
      collisionGapX: options?.collisionGapX ?? spouseGap(),
      collisionGapY: options?.collisionGapY ?? Math.max(12, generationGap(1) * 0.25),
      componentGapX: options?.componentGapX ?? componentGap(),
    });
  } finally {
    layoutSpacing = previousSpacing;
    layoutNodeWidth = previousWidth;
    layoutNodeHeight = previousHeight;
  }
}

function rebuildUnionsFromPositions(
  junctions: JunctionInfo[],
  positions: Map<string, { x: number; y: number }>,
): void {
  const width = nodeW();
  const height = nodeH();
  for (const junction of junctions) {
    if (junction.kind !== "union" || junction.parentIds.length !== 2) {
      continue;
    }
    const [a, b] = junction.parentIds;
    const posA = positions.get(a);
    const posB = positions.get(b);
    if (!posA || !posB) continue;
    junction.x = (posA.x + width / 2 + posB.x + width / 2) / 2;
    junction.y = posA.y + height / 2;
  }
}

function applyCollisionResolution(
  positions: Map<string, { x: number; y: number }>,
  junctions: JunctionInfo[],
  rootMemberIds: string[][],
  options: {
    collisionGapX: number;
    collisionGapY: number;
    componentGapX: number;
  },
): void {
  const metrics: CollisionMetrics = {
    width: nodeW(),
    height: nodeH(),
    gapX: options.collisionGapX,
    gapY: options.collisionGapY,
  };

  const generationBuckets = new Map<number, string[]>();
  for (const [id, point] of positions) {
    const key = Math.round(point.y);
    const bucket = generationBuckets.get(key) ?? [];
    bucket.push(id);
    generationBuckets.set(key, bucket);
  }

  for (const ids of generationBuckets.values()) {
    resolveGenerationCollisions(positions, ids, metrics);
  }

  // Second pass: exact-position duplicates across any generation.
  const byKey = new Map<string, string[]>();
  for (const [id, point] of positions) {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    const list = byKey.get(key) ?? [];
    list.push(id);
    byKey.set(key, list);
  }
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i += 1) {
      const point = positions.get(ids[i]);
      if (!point) continue;
      point.x += (nodeW() + options.collisionGapX) * i;
    }
  }

  // One more generation sweep after duplicate split.
  for (const ids of generationBuckets.values()) {
    resolveGenerationCollisions(positions, ids, metrics);
  }

  const memberIdsByComponent = new Map<string, string[]>();
  const componentBounds = [];
  for (let index = 0; index < rootMemberIds.length; index += 1) {
    const members = rootMemberIds[index];
    const id = `component-${index}`;
    memberIdsByComponent.set(id, members);
    const bounds = getComponentBounds(id, members, positions, {
      width: nodeW(),
      height: nodeH(),
    });
    if (bounds) componentBounds.push(bounds);
  }
  resolveComponentCollisions(
    componentBounds,
    positions,
    memberIdsByComponent,
    options.componentGapX,
  );

  rebuildUnionsFromPositions(junctions, positions);

  const remaining = validateNoPersonNodeCollisions(positions, metrics);
  const generationByPerson = new Map<string, number>();
  for (const [id, point] of positions) {
    generationByPerson.set(id, Math.round(point.y));
  }
  logCollisionsInDev(remaining, generationByPerson);
}

function collectBlockPersonIds(block: MeasuredBlock): string[] {
  const ids = new Set<string>(block.memberIds);
  const visit = (child: MeasuredBlock) => {
    child.memberIds.forEach((id) => ids.add(id));
    child.marriages.forEach((marriage) =>
      marriage.children.forEach(visit),
    );
    child.soloChildren.forEach(visit);
  };
  block.marriages.forEach((marriage) => marriage.children.forEach(visit));
  block.soloChildren.forEach(visit);
  return [...ids];
}

function buildLayoutedGraphWithActiveSpacing(
  people: Person[],
  collisionOptions: {
    resolveCollisions: boolean;
    collisionGapX: number;
    collisionGapY: number;
    componentGapX: number;
  },
): {
  nodes: Node<PersonNodeData>[];
  junctionNodes: Node[];
  generationNodes: Node[];
  edges: Edge[];
} {
  const byId = new Map(people.map((person) => [person.id, person]));
  // Largest connected components first for denser left packing.
  const blocks = buildFamilyBlocks(people)
    .map(measureBlock)
    .sort((a, b) => b.width - a.width);
  const positions = new Map<string, { x: number; y: number }>();
  const junctions: JunctionInfo[] = [];
  const directLinks: DirectLink[] = [];
  const generationYs = new Map<number, number>();

  const sidePad = layoutSpacing.sidePadding;
  const topPad = layoutSpacing.topPadding;
  let cursorX = sidePad;
  const startY = topPad;
  const rootMemberIds: string[][] = [];

  for (const block of blocks) {
    placeBlock(
      block,
      cursorX,
      startY,
      positions,
      junctions,
      directLinks,
      generationYs,
      0,
      byId,
    );
    rootMemberIds.push(collectBlockPersonIds(block));
    cursorX += block.width + componentGap();
  }

  if (collisionOptions.resolveCollisions) {
    applyCollisionResolution(
      positions,
      junctions,
      rootMemberIds,
      collisionOptions,
    );
  }

  // Place anyone missing from the layout tree without stacking on one point.
  let missingIndex = 0;
  for (const person of people) {
    if (positions.has(person.id)) continue;
    positions.set(person.id, {
      x: sidePad + missingIndex * (nodeW() + spouseGap()),
      y: startY + (generationYs.size + 1) * (nodeH() + generationGap(1)),
    });
    missingIndex += 1;
  }

  // Normalize so the tree sits near the top-left with consistent padding.
  const positionList = [...positions.values()];
  const allXs = [
    ...positionList.map((point) => point.x),
    ...junctions.map((junction) => junction.x),
  ];
  const allYs = [
    ...positionList.map((point) => point.y),
    ...junctions.map((junction) => junction.y),
    ...generationYs.values(),
  ];
  const minX = allXs.length > 0 ? Math.min(...allXs) : 0;
  const minY = allYs.length > 0 ? Math.min(...allYs) : 0;
  const shiftX = sidePad - minX;
  const shiftY = topPad - minY;

  if (shiftX !== 0 || shiftY !== 0) {
    for (const [id, point] of positions) {
      positions.set(id, { x: point.x + shiftX, y: point.y + shiftY });
    }
    for (const junction of junctions) {
      junction.x += shiftX;
      junction.y += shiftY;
    }
    for (const [generation, y] of generationYs) {
      generationYs.set(generation, y + shiftY);
    }
  }

  if (collisionOptions.resolveCollisions) {
    // Final idempotent sweep after normalize.
    applyCollisionResolution(
      positions,
      junctions,
      rootMemberIds,
      collisionOptions,
    );
  }

  const nodes: Node<PersonNodeData>[] = people.map((person) => {
    const position = positions.get(person.id) ?? {
      x: sidePad,
      y: topPad,
    };

    return {
      id: person.id,
      type: "person",
      position,
      zIndex: 10,
      style: {
        width: nodeW(),
        height: nodeH(),
      },
      data: {
        person,
        onSelect: () => undefined,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
    };
  });

  const junctionNodes: Node[] = junctions.map((junction) => ({
    id: junction.id,
    type: junction.kind === "union" ? "union" : "junction",
    position: {
      x: junction.x - (junction.kind === "union" ? 9 : 0),
      y: junction.y - (junction.kind === "union" ? 9 : 0),
    },
    zIndex: junction.kind === "union" ? 20 : 1,
    data: { kind: junction.kind },
    draggable: false,
    selectable: false,
    focusable: false,
    connectable: false,
  }));

  const personXs = [...positions.values()].map((point) => point.x);
  const labelX =
    (personXs.length > 0 ? Math.min(...personXs) : sidePad) - 132;

  const generationNodes: Node[] = [...generationYs.entries()].map(
    ([generation, y]) => ({
      id: `generation-label-${generation}`,
      type: "generationLabel",
      position: { x: labelX, y: y + 8 },
      zIndex: 0,
      data: {
        label: generationLabelForIndex(generation),
      },
      draggable: false,
      selectable: false,
      focusable: false,
      connectable: false,
    }),
  );

  const edges: Edge[] = [];
  const drawnSpouses = new Set<string>();

  for (const junction of junctions) {
    if (junction.kind !== "union" || junction.parentIds.length !== 2) {
      continue;
    }

    const [leftCandidate, rightCandidate] = junction.parentIds;
    const leftId =
      (positions.get(leftCandidate)?.x ?? 0) <=
      (positions.get(rightCandidate)?.x ?? 0)
        ? leftCandidate
        : rightCandidate;
    const rightId = leftId === leftCandidate ? rightCandidate : leftCandidate;
    const key = [leftId, rightId].sort().join("::");
    if (drawnSpouses.has(key)) {
      continue;
    }
    drawnSpouses.add(key);

    const style = spouseEdgeStyle(junction.spouseStatus, junction.confidence);
    const label = edgeLabelForMeta({
      spouseStatus: junction.spouseStatus,
      confidence: junction.confidence,
    });

    edges.push({
      id: `spouse-l-${key}`,
      source: leftId,
      target: junction.id,
      sourceHandle: "spouse-right",
      targetHandle: "spouse-left",
      type: "straight",
      zIndex: 5,
      style,
      label,
      labelStyle: label
        ? { fill: "#5A6B62", fontSize: 10, fontWeight: 600 }
        : undefined,
      labelBgStyle: label
        ? { fill: "#FFFCF7", fillOpacity: 0.85 }
        : undefined,
      data: {
        kind: "spouse",
        spouseStatus: junction.spouseStatus,
        confidence: junction.confidence,
        relatedIds: [leftId, rightId],
      } satisfies EdgeVisualMeta,
    });

    edges.push({
      id: `spouse-r-${key}`,
      source: junction.id,
      target: rightId,
      sourceHandle: "spouse-right",
      targetHandle: "spouse-left",
      type: "straight",
      zIndex: 5,
      style,
      data: {
        kind: "spouse",
        spouseStatus: junction.spouseStatus,
        confidence: junction.confidence,
        relatedIds: [leftId, rightId],
      } satisfies EdgeVisualMeta,
    });
  }

  for (const link of directLinks) {
    const style = parentEdgeStyle(link.parentKind, link.confidence);
    const label = edgeLabelForMeta({
      parentKind: link.parentKind,
      confidence: link.confidence,
    });

    edges.push({
      id: `direct-${link.sourceId}-${link.targetId}`,
      source: link.sourceId,
      target: link.targetId,
      sourceHandle: "family-out",
      targetHandle: "family-in",
      type: "straight",
      zIndex: 4,
      style,
      label,
      labelStyle: label
        ? { fill: "#5A6B62", fontSize: 10, fontWeight: 600 }
        : undefined,
      labelBgStyle: label
        ? { fill: "#FFFCF7", fillOpacity: 0.85 }
        : undefined,
      data: {
        kind: "direct-child",
        parentKind: link.parentKind,
        confidence: link.confidence,
        relatedIds: link.relatedIds,
      } satisfies EdgeVisualMeta,
    });
  }

  for (const junction of junctions) {
    if (junction.kind !== "distributor") {
      continue;
    }

    const relatedIds = uniqueIds([
      ...junction.parentIds.flatMap((id) => {
        if (id.startsWith("j-union-")) {
          return id.replace("j-union-", "").split("__");
        }
        return [id];
      }),
      ...junction.targetIds.flatMap((targetId) => {
        if (targetId.startsWith("j-union-") || targetId.startsWith("j-entry-")) {
          return targetId
            .replace("j-union-", "")
            .replace("j-entry-", "")
            .split("__");
        }
        return [targetId];
      }),
    ]);

    for (const parentId of junction.parentIds) {
      // Prefer meta from first child if available.
      const firstChild = junction.targetIds[0];
      const parentPersonId = parentId.startsWith("j-union-")
        ? parentId.replace("j-union-", "").split("__")[0]
        : parentId;
      const meta = firstChild
        ? resolveParentMeta(parentPersonId, firstChild, byId)
        : { kind: "biological" as const, confidence: "confirmed" as const };
      const style = parentEdgeStyle(meta.kind, meta.confidence);

      edges.push({
        id: `pd-${parentId}-${junction.id}`,
        source: parentId,
        target: junction.id,
        sourceHandle: "family-out",
        targetHandle: "family-in",
        type: "smoothstep",
        zIndex: 4,
        style,
        data: {
          kind: "parent-junction",
          parentKind: meta.kind,
          confidence: meta.confidence,
          relatedIds,
        } satisfies EdgeVisualMeta,
      });
    }

    for (const targetId of junction.targetIds) {
      const parentPersonId = junction.parentIds[0]?.startsWith("j-union-")
        ? junction.parentIds[0].replace("j-union-", "").split("__")[0]
        : junction.parentIds[0];
      const meta = parentPersonId
        ? resolveParentMeta(parentPersonId, targetId, byId)
        : { kind: "biological" as const, confidence: "confirmed" as const };
      const style = parentEdgeStyle(meta.kind, meta.confidence);
      const label = edgeLabelForMeta({
        parentKind: meta.kind,
        confidence: meta.confidence,
      });

      edges.push({
        id: `dt-${junction.id}-${targetId}`,
        source: junction.id,
        target: targetId,
        sourceHandle: "family-out",
        targetHandle: "family-in",
        type: "smoothstep",
        zIndex: 4,
        style,
        label,
        labelStyle: label
          ? { fill: "#5A6B62", fontSize: 10, fontWeight: 600 }
          : undefined,
        labelBgStyle: label
          ? { fill: "#FFFCF7", fillOpacity: 0.85 }
          : undefined,
        data: {
          kind: "junction-child",
          parentKind: meta.kind,
          confidence: meta.confidence,
          relatedIds,
        } satisfies EdgeVisualMeta,
      });
    }
  }

  return { nodes, junctionNodes, generationNodes, edges };
}

export function applyNodeData(
  nodes: Node<PersonNodeData>[],
  dataById: Map<string, PersonNodeData>,
): Node<PersonNodeData>[] {
  return nodes.map((node) => ({
    ...node,
    data: dataById.get(node.id) ?? node.data,
  }));
}

/** Parents, spouses and children — used for soft highlight on selection. */
export function getRelatedPersonIds(
  personId: string,
  peopleList: Person[],
): Set<string> {
  const person = peopleList.find((item) => item.id === personId);
  if (!person) {
    return new Set();
  }

  const related = new Set<string>([personId]);
  person.parentIds.forEach((id) => related.add(id));
  person.childIds.forEach((id) => related.add(id));
  personSpouseIds(person).forEach((id) => related.add(id));

  return related;
}

export function isEdgeRelatedToPerson(
  edge: Edge,
  personId: string | null,
  relatedIds: Set<string> | null,
): boolean {
  if (!personId || !relatedIds) {
    return false;
  }

  const edgePeople =
    (edge.data as { relatedIds?: string[] } | undefined)?.relatedIds ?? [];

  if (edgePeople.includes(personId)) {
    return true;
  }

  const overlapCount = edgePeople.filter((id) => relatedIds.has(id)).length;
  return overlapCount >= 2;
}
