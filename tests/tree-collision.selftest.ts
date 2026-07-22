import {
  FAMILY_GROUP_GAP,
  HERITAGE_COMPONENT_GAP_X,
  HERITAGE_NODE_HEIGHT,
  HERITAGE_NODE_WIDTH,
  PERSON_COLLISION_GAP,
} from "../src/lib/heritage-theme";
import {
  findNodeCollisions,
  getNodeRect,
  rectanglesOverlap,
  resolveComponentCollisions,
  resolveGenerationCollisions,
  validateNoPersonNodeCollisions,
  type CollisionMetrics,
  type ComponentBounds,
} from "../src/lib/tree-collision";
import {
  HERITAGE_ALL_LAYOUT_SPACING,
  buildFamilyBlocks,
  buildLayoutedGraph,
} from "../src/lib/tree-layout";
import type { Person } from "../src/types/family";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function person(partial: {
  id: string;
  parentIds?: string[];
  childIds?: string[];
  spouseIds?: string[];
  firstName?: string;
  lastName?: string;
  middleName?: string;
}): Person {
  return {
    id: partial.id,
    firstName: partial.firstName ?? partial.id,
    middleName: partial.middleName,
    lastName: partial.lastName ?? "",
    relationshipLabel: "",
    parentIds: partial.parentIds ?? [],
    childIds: partial.childIds ?? [],
    spouseId: partial.spouseIds?.[0],
    spouseIds: partial.spouseIds,
  };
}

const heritageMetrics: CollisionMetrics = {
  width: HERITAGE_NODE_WIDTH,
  height: HERITAGE_NODE_HEIGHT,
  gapX: PERSON_COLLISION_GAP,
  gapY: PERSON_COLLISION_GAP,
};

function testSamePositionDetected(): void {
  const positions = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 0, y: 0 }],
  ]);
  const pairs = validateNoPersonNodeCollisions(positions, heritageMetrics);
  assert(pairs.length === 1, "same position must collide");
}

function testResolveSpreadsNeighbors(): void {
  const positions = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 40, y: 0 }],
  ]);
  resolveGenerationCollisions(positions, ["a", "b"], heritageMetrics);
  const a = positions.get("a")!;
  const b = positions.get("b")!;
  const rectA = getNodeRect("a", a, heritageMetrics);
  const rectB = getNodeRect("b", b, heritageMetrics);
  assert(
    !rectanglesOverlap(rectA, rectB, PERSON_COLLISION_GAP, PERSON_COLLISION_GAP),
    "neighbors must be separated after resolve",
  );
  assert(b.x >= a.x + HERITAGE_NODE_WIDTH + PERSON_COLLISION_GAP - 0.01, "b shifted right");
}

function testFiveSiblingsNoOverlap(): void {
  const people: Person[] = [
    person({ id: "p", childIds: ["c0", "c1", "c2", "c3", "c4"] }),
    ...[0, 1, 2, 3, 4].map((i) =>
      person({ id: `c${i}`, parentIds: ["p"] }),
    ),
  ];
  const { nodes } = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
    collisionGapX: PERSON_COLLISION_GAP,
    collisionGapY: PERSON_COLLISION_GAP,
    componentGapX: HERITAGE_COMPONENT_GAP_X,
  });
  const personNodes = nodes.filter((n) => n.type === "person");
  const positions = new Map(
    personNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
  const collisions = validateNoPersonNodeCollisions(positions, heritageMetrics);
  assert(collisions.length === 0, `siblings collided: ${collisions.length}`);
}

function testTwoFamiliesWithChildren(): void {
  const people: Person[] = [
    person({ id: "a1", spouseIds: ["a2"], childIds: ["ac1", "ac2", "ac3"] }),
    person({ id: "a2", spouseIds: ["a1"], childIds: ["ac1", "ac2", "ac3"] }),
    person({ id: "ac1", parentIds: ["a1", "a2"] }),
    person({ id: "ac2", parentIds: ["a1", "a2"] }),
    person({ id: "ac3", parentIds: ["a1", "a2"] }),
    person({ id: "b1", spouseIds: ["b2"], childIds: ["bc1", "bc2", "bc3"] }),
    person({ id: "b2", spouseIds: ["b1"], childIds: ["bc1", "bc2", "bc3"] }),
    person({ id: "bc1", parentIds: ["b1", "b2"] }),
    person({ id: "bc2", parentIds: ["b1", "b2"] }),
    person({ id: "bc3", parentIds: ["b1", "b2"] }),
  ];
  const { nodes } = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
    collisionGapX: PERSON_COLLISION_GAP,
    collisionGapY: PERSON_COLLISION_GAP,
    componentGapX: Math.max(HERITAGE_COMPONENT_GAP_X, FAMILY_GROUP_GAP),
  });
  const positions = new Map(
    nodes
      .filter((n) => n.type === "person")
      .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
  assert(
    validateNoPersonNodeCollisions(positions, heritageMetrics).length === 0,
    "two families must not collide",
  );
}

function testTwoSpousesNoDuplicateNode(): void {
  const people: Person[] = [
    person({
      id: "hub",
      spouseIds: ["s1", "s2"],
      childIds: ["c1", "c2"],
    }),
    person({ id: "s1", spouseIds: ["hub"], childIds: ["c1"] }),
    person({ id: "s2", spouseIds: ["hub"], childIds: ["c2"] }),
    person({ id: "c1", parentIds: ["hub", "s1"] }),
    person({ id: "c2", parentIds: ["hub", "s2"] }),
  ];
  const { nodes } = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
    collisionGapX: PERSON_COLLISION_GAP,
    collisionGapY: PERSON_COLLISION_GAP,
  });
  const personNodes = nodes.filter((n) => n.type === "person");
  assert(personNodes.length === 5, "exactly one node per person");
  const ids = new Set(personNodes.map((n) => n.id));
  assert(ids.size === 5, "no duplicate person ids");
  const positions = new Map(
    personNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
  assert(
    validateNoPersonNodeCollisions(positions, heritageMetrics).length === 0,
    "children from two unions must not overlap",
  );
}

function testLongNamesDoNotChangeBox(): void {
  const people: Person[] = [
    person({
      id: "n1",
      firstName: "Надежда",
      middleName: "Валентиновна",
      lastName: "Третьякова",
      childIds: ["n2"],
    }),
    person({
      id: "n2",
      firstName: "Михаил",
      middleName: "Алексеевич",
      lastName: "Кудинов",
      parentIds: ["n1"],
    }),
  ];
  const { nodes } = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
  });
  for (const node of nodes.filter((n) => n.type === "person")) {
    assert(
      node.style?.width === HERITAGE_NODE_WIDTH,
      "width fixed for long names",
    );
    assert(
      node.style?.height === HERITAGE_NODE_HEIGHT,
      "height fixed for long names",
    );
  }
}

function testDetailLevelsShareSizeConstants(): void {
  assert(HERITAGE_NODE_WIDTH === 200, "stable heritage width");
  assert(HERITAGE_NODE_HEIGHT === 178, "stable heritage height");
}

function testComponentsSeparated(): void {
  const bounds: ComponentBounds[] = [
    { id: "c0", minX: 0, minY: 0, maxX: 400, maxY: 200 },
    { id: "c1", minX: 100, minY: 0, maxX: 500, maxY: 200 },
  ];
  const positions = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 200, y: 0 }],
    ["c", { x: 100, y: 0 }],
    ["d", { x: 300, y: 0 }],
  ]);
  const members = new Map([
    ["c0", ["a", "b"]],
    ["c1", ["c", "d"]],
  ]);
  resolveComponentCollisions(bounds, positions, members, HERITAGE_COMPONENT_GAP_X);
  assert(
    positions.get("c")!.x >= 400 + HERITAGE_COMPONENT_GAP_X - 0.01,
    "second component shifted past first",
  );
}

function testResolutionPreservesCountAndIdempotent(): void {
  const people: Person[] = [
    person({ id: "r", childIds: ["a", "b", "c"] }),
    person({ id: "a", parentIds: ["r"] }),
    person({ id: "b", parentIds: ["r"] }),
    person({ id: "c", parentIds: ["r"] }),
  ];
  const first = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
    collisionGapX: PERSON_COLLISION_GAP,
    collisionGapY: PERSON_COLLISION_GAP,
  });
  const second = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
    collisionGapX: PERSON_COLLISION_GAP,
    collisionGapY: PERSON_COLLISION_GAP,
  });
  assert(first.nodes.length === second.nodes.length, "node count stable");
  for (const node of first.nodes.filter((n) => n.type === "person")) {
    const other = second.nodes.find((n) => n.id === node.id);
    assert(Boolean(other), "same ids");
    assert(other!.position.x === node.position.x, "idempotent x");
    assert(other!.position.y === node.position.y, "idempotent y");
  }
}

function testParentCycleFinite(): void {
  const people = [
    person({ id: "a", parentIds: ["b"], childIds: ["b"] }),
    person({ id: "b", parentIds: ["a"], childIds: ["a"] }),
  ];
  const blocks = buildFamilyBlocks(people);
  assert(blocks.length >= 1, "cycle still builds blocks");
  const { nodes } = buildLayoutedGraph(people, {
    spacing: HERITAGE_ALL_LAYOUT_SPACING,
    nodeSize: { width: HERITAGE_NODE_WIDTH, height: HERITAGE_NODE_HEIGHT },
    resolveCollisions: true,
  });
  assert(nodes.filter((n) => n.type === "person").length === 2, "two people");
}

function testOverlapHelper(): void {
  const a = { id: "a", x: 0, y: 0, width: 100, height: 100 };
  const b = { id: "b", x: 90, y: 0, width: 100, height: 100 };
  assert(rectanglesOverlap(a, b, 20, 0), "gap creates overlap");
  assert(findNodeCollisions([a, b], 20, 0).length === 1, "finds pair");
}

function main(): void {
  testSamePositionDetected();
  testResolveSpreadsNeighbors();
  testFiveSiblingsNoOverlap();
  testTwoFamiliesWithChildren();
  testTwoSpousesNoDuplicateNode();
  testLongNamesDoNotChangeBox();
  testDetailLevelsShareSizeConstants();
  testComponentsSeparated();
  testResolutionPreservesCountAndIdempotent();
  testParentCycleFinite();
  testOverlapHelper();
  // eslint-disable-next-line no-console
  console.log("tree-collision tests passed");
}

main();
