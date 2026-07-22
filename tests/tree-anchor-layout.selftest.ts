/**
 * Run: npx tsx tests/tree-anchor-layout.selftest.ts
 */
import type { Person } from "../src/types/family";
import {
  COMPACT_TREE_ANCHORS,
  MEDIUM_TREE_ANCHORS,
  WIDE_TREE_ANCHORS,
} from "../src/lib/tree-anchor-presets";
import {
  assignPeopleToTreeAnchors,
  validateAnchorCoordinates,
} from "../src/lib/tree-anchor-layout";
import {
  buildAssetTreeLayout,
  validateTreeAssetLayout,
} from "../src/lib/tree-asset-layout";
import {
  selectTreeAssetVariant,
  TREE_ASSET_DEFINITIONS,
} from "../src/lib/tree-asset-config";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function person(
  id: string,
  firstName: string,
  extra: Partial<Person> = {},
): Person {
  return {
    id,
    externalKey: id,
    firstName,
    lastName: "Alpha",
    gender: "unknown",
    parentIds: [],
    childIds: [],
    spouseIds: [],
    ...extra,
  };
}

function linkParents(child: Person, ...parents: Person[]): void {
  child.parentIds = parents.map((parent) => parent.id);
  for (const parent of parents) {
    parent.childIds = [...(parent.childIds ?? []), child.id];
  }
}

function linkSpouses(a: Person, b: Person): void {
  a.spouseIds = [...(a.spouseIds ?? []), b.id];
  b.spouseIds = [...(b.spouseIds ?? []), a.id];
  a.spouseId = b.id;
  b.spouseId = a.id;
}

function placementY(
  result: ReturnType<typeof buildAssetTreeLayout>,
  personId: string,
): number {
  const node = result.nodes.find((item) => item.id === personId);
  return node?.position.y ?? Number.NaN;
}

// 1. Anchor coordinates normalized
assert(
  validateAnchorCoordinates(COMPACT_TREE_ANCHORS),
  "compact anchors in 0..1 range",
);
assert(
  validateAnchorCoordinates(MEDIUM_TREE_ANCHORS),
  "medium anchors in 0..1 range",
);
assert(
  validateAnchorCoordinates(WIDE_TREE_ANCHORS),
  "wide anchors in 0..1 range",
);

// 2. Focus gets central anchor
{
  const hero = person("h", "Hero", { gender: "male" });
  const result = assignPeopleToTreeAnchors({
    people: [hero],
    focusedPersonId: "h",
    visiblePersonIds: new Set(["h"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const focus = result.assignments.find((item) => item.personId === "h");
  assert(focus?.anchor.side === "center", "focus uses center anchor");
}

// 3. Spouse adjacent anchor
{
  const hero = person("h", "Hero", { gender: "male" });
  const spouse = person("s", "Spouse", { gender: "female" });
  linkSpouses(hero, spouse);
  const result = assignPeopleToTreeAnchors({
    people: [hero, spouse],
    focusedPersonId: "h",
    visiblePersonIds: new Set(["h", "s"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const focus = result.assignments.find((item) => item.personId === "h");
  const partner = result.assignments.find((item) => item.personId === "s");
  assert(Boolean(focus && partner), "couple assigned");
  assert(
    focus!.anchor.pairGroup === "central-couple-left" &&
      partner!.anchor.pairGroup === "central-couple-right",
    "spouse uses central couple anchors",
  );
  assert(result.composition === "couple-with-lineages", "couple composition");
}

// 4. Child above parents
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const mother = person("m", "Mother", { gender: "female", birthYear: 1972 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkSpouses(father, mother);
  linkParents(child, father, mother);
  const people = [father, mother, child];
  const layout = buildAssetTreeLayout({
    people,
    focusId: "c",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1200,
    isMobile: false,
  });
  assert(placementY(layout, "c") < placementY(layout, "f"), "child above father");
  assert(placementY(layout, "c") < placementY(layout, "m"), "child above mother");
}

// 5. Age does not change generation ordering
{
  const older = person("o", "Older", { birthYear: 1990 });
  const younger = person("y", "Younger", { birthYear: 2005 });
  linkParents(younger, older);
  linkParents(older);
  const result = assignPeopleToTreeAnchors({
    people: [older, younger],
    focusedPersonId: "y",
    visiblePersonIds: new Set(["o", "y"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const parent = result.assignments.find((item) => item.personId === "o");
  const child = result.assignments.find((item) => item.personId === "y");
  assert(
    (parent?.generation ?? 0) < (child?.generation ?? 0),
    "parent generation lower than child",
  );
}

// 6. One anchor per person
{
  const hero = person("h", "Hero");
  const spouse = person("s", "Spouse");
  linkSpouses(hero, spouse);
  const result = assignPeopleToTreeAnchors({
    people: [hero, spouse],
    focusedPersonId: "h",
    visiblePersonIds: new Set(["h", "s"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const anchorIds = result.assignments.map((item) => item.anchorId);
  assert(
    new Set(anchorIds).size === anchorIds.length,
    "unique anchor per person",
  );
}

// 7. Overflow when anchors exhausted
{
  const root = person("root", "Root", { birthYear: 1940 });
  const people: Person[] = [root];
  const ids = new Set<string>(["root"]);
  for (let i = 0; i < 29; i += 1) {
    const child = person(`c${i}`, `Child${i}`, { birthYear: 1970 + i });
    linkParents(child, root);
    people.push(child);
    ids.add(child.id);
  }
  const result = assignPeopleToTreeAnchors({
    people,
    focusedPersonId: "root",
    visiblePersonIds: ids,
    anchors: COMPACT_TREE_ANCHORS,
  });
  assert(result.overflowGroups.length > 0, "overflow groups created");
}

// 8. Variant escalation in layout
{
  const root = person("root", "Root", { birthYear: 1940 });
  const people: Person[] = [root];
  for (let i = 0; i < 17; i += 1) {
    const child = person(`p${i}`, `Child${i}`, { birthYear: 1960 + i });
    linkParents(child, root);
    people.push(child);
  }
  const layout = buildAssetTreeLayout({
    people,
    focusId: "root",
    viewMode: "branch",
    expandedCollateral: new Set(),
    viewportWidth: 1400,
    isMobile: false,
  });
  const main = layout.components.find((component) => component.renderTreeAsset);
  assert(
    main?.asset.variant === "medium" || main?.asset.variant === "wide",
    "large family uses medium or wide asset",
  );
}

// 9. Single main asset per connected component
{
  const a = person("a", "Alpha");
  const b = person("b", "Beta");
  const layout = buildAssetTreeLayout({
    people: [a, b],
    focusId: "a",
    viewMode: "all",
    expandedCollateral: new Set(),
    viewportWidth: 1400,
    isMobile: false,
  });
  const mains = layout.components.filter((component) => component.renderTreeAsset);
  assert(mains.length === 1, "one main tree asset");
}

// 10. Layout validation — no NaN
{
  const hero = person("h", "Hero");
  const layout = buildAssetTreeLayout({
    people: [hero],
    focusId: "h",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 800,
    isMobile: true,
  });
  const validation = validateTreeAssetLayout(layout);
  assert(validation.valid, `layout valid: ${validation.issues.join(", ")}`);
}

// 11. Deterministic layout
{
  const hero = person("h", "Hero");
  const spouse = person("s", "Spouse");
  linkSpouses(hero, spouse);
  const people = [hero, spouse];
  const first = buildAssetTreeLayout({
    people,
    focusId: "h",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1024,
    isMobile: false,
  });
  const second = buildAssetTreeLayout({
    people,
    focusId: "h",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1024,
    isMobile: false,
  });
  assert(
    JSON.stringify(first.nodes.map((node) => node.position)) ===
      JSON.stringify(second.nodes.map((node) => node.position)),
    "deterministic node positions",
  );
}

// 12. Asset variant selection
{
  const compact = selectTreeAssetVariant({
    visiblePeopleCount: 5,
    viewMode: "nearby",
    viewportWidth: 390,
    isMobile: true,
  });
  const wide = selectTreeAssetVariant({
    visiblePeopleCount: 40,
    viewMode: "all",
    viewportWidth: 1600,
    isMobile: false,
  });
  assert(compact.variant === "compact", "nearby mobile uses compact");
  assert(wide.variant === "wide", "all mode uses wide for large tree");
}

// 13. Expected asset paths
assert(
  TREE_ASSET_DEFINITIONS.compact.src === "/tree-assets/tree-compact.png",
  "compact asset path",
);
assert(
  TREE_ASSET_DEFINITIONS.medium.src === "/tree-assets/tree-medium.png",
  "medium asset path",
);
assert(
  TREE_ASSET_DEFINITIONS.wide.src === "/tree-assets/tree-wide.png",
  "wide asset path",
);
assert(
  TREE_ASSET_DEFINITIONS.compact.naturalWidth === 1536,
  "compact natural width",
);
assert(
  TREE_ASSET_DEFINITIONS.compact.naturalHeight === 1024,
  "compact natural height",
);

// 14. Performance — 300 people
{
  const people: Person[] = [];
  for (let i = 0; i < 300; i += 1) {
    people.push(person(`perf-${i}`, `Member${i}`, { birthYear: 1900 + (i % 100) }));
  }
  const started = performance.now();
  const layout = buildAssetTreeLayout({
    people,
    focusId: "perf-0",
    viewMode: "all",
    expandedCollateral: new Set(),
    viewportWidth: 1600,
    isMobile: false,
  });
  const elapsed = performance.now() - started;
  assert(elapsed < 2000, `300 people under 2s (${elapsed.toFixed(0)}ms)`);
  assert(layout.nodes.length > 0, "300 people produce nodes");
}

// 15. Paternal / maternal sides (couple with shared child)
{
  const focus = person("f", "Focus", { gender: "male", birthYear: 1980 });
  const spouse = person("s", "Spouse", { gender: "female", birthYear: 1982 });
  const child = person("c", "Child", { birthYear: 2010 });
  const father = person("pf", "Father", { gender: "male", birthYear: 1950 });
  const mother = person("sm", "Mother", { gender: "female", birthYear: 1955 });
  linkSpouses(focus, spouse);
  linkParents(child, focus, spouse);
  linkParents(focus, father);
  linkParents(spouse, mother);
  const result = assignPeopleToTreeAnchors({
    people: [focus, spouse, child, father, mother],
    focusedPersonId: "f",
    visiblePersonIds: new Set(["f", "s", "c", "pf", "sm"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const paternal = result.assignments.find((item) => item.personId === "pf");
  const maternal = result.assignments.find((item) => item.personId === "sm");
  assert(paternal?.lineageKey === "focus-lineage", "focus parent on left lineage");
  assert(maternal?.lineageKey === "spouse-lineage", "spouse parent on right lineage");
  assert(paternal?.anchor.side === "left", "focus parent uses left anchor");
  assert(maternal?.anchor.side === "right", "spouse parent uses right anchor");
}

// 16. Child center — father left, mother right
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const mother = person("m", "Mother", { gender: "female", birthYear: 1972 });
  const child = person("c", "Child", { birthYear: 2000 });
  const pgf = person("pgf", "PGF", { gender: "male", birthYear: 1940 });
  const pgm = person("pgm", "PGM", { gender: "female", birthYear: 1942 });
  const mgf = person("mgf", "MGF", { gender: "male", birthYear: 1945 });
  const mgm = person("mgm", "MGM", { gender: "female", birthYear: 1947 });
  linkSpouses(father, mother);
  linkParents(child, father, mother);
  linkParents(father, pgf, pgm);
  linkParents(mother, mgf, mgm);
  const people = [father, mother, child, pgf, pgm, mgf, mgm];
  const ids = new Set(people.map((item) => item.id));
  const result = assignPeopleToTreeAnchors({
    people,
    focusedPersonId: "c",
    visiblePersonIds: ids,
    anchors: WIDE_TREE_ANCHORS,
  });
  assert(result.composition === "single-with-parents", "child uses single-with-parents");
  const fatherAssign = result.assignments.find((item) => item.personId === "f");
  const motherAssign = result.assignments.find((item) => item.personId === "m");
  assert(fatherAssign?.lineageKey === "parent-left-lineage", "father left lineage");
  assert(motherAssign?.lineageKey === "parent-right-lineage", "mother right lineage");
  assert(fatherAssign?.anchor.side === "left", "father on left anchor");
  assert(motherAssign?.anchor.side === "right", "mother on right anchor");
  for (const id of ["pgf", "pgm"]) {
    const item = result.assignments.find((entry) => entry.personId === id);
    assert(item?.anchor.side === "left", `paternal ancestor ${id} stays left`);
  }
  for (const id of ["mgf", "mgm"]) {
    const item = result.assignments.find((entry) => entry.personId === id);
    assert(item?.anchor.side === "right", `maternal ancestor ${id} stays right`);
  }
}

// 17. Focused child above parents
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const mother = person("m", "Mother", { gender: "female", birthYear: 1972 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkSpouses(father, mother);
  linkParents(child, father, mother);
  const layout = buildAssetTreeLayout({
    people: [father, mother, child],
    focusId: "c",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1200,
    isMobile: false,
  });
  assert(placementY(layout, "c") < placementY(layout, "f"), "child above father");
  assert(placementY(layout, "c") < placementY(layout, "m"), "child above mother");
  const focusAssign = layout.components[0]?.assignments.find(
    (item) => item.personId === "c",
  );
  assert(
    focusAssign?.anchor.pairGroup === "single-focus-upper",
    "child uses upper focus anchor",
  );
}

// 18. Grandparents below parents
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const pgf = person("pgf", "PGF", { gender: "male", birthYear: 1940 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkParents(child, father);
  linkParents(father, pgf);
  const layout = buildAssetTreeLayout({
    people: [father, pgf, child],
    focusId: "c",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1200,
    isMobile: false,
  });
  assert(
    placementY(layout, "f") < placementY(layout, "pgf"),
    "parent above grandparent",
  );
}

// 19. Shared ancestor not duplicated
{
  const shared = person("sh", "Shared", { gender: "male", birthYear: 1930 });
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const mother = person("m", "Mother", { gender: "female", birthYear: 1972 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkParents(father, shared);
  linkParents(mother, shared);
  linkParents(child, father, mother);
  const result = assignPeopleToTreeAnchors({
    people: [shared, father, mother, child],
    focusedPersonId: "c",
    visiblePersonIds: new Set(["sh", "f", "m", "c"]),
    anchors: WIDE_TREE_ANCHORS,
  });
  const sharedAssignments = result.assignments.filter(
    (item) => item.personId === "sh",
  );
  assert(sharedAssignments.length === 1, "shared ancestor assigned once");
}

// 20. Unknown gender parents — stable order
{
  const p1 = person("p1", "P1", { gender: "unknown", externalKey: "aaa" });
  const p2 = person("p2", "P2", { gender: "unknown", externalKey: "bbb" });
  const child = person("c", "Child", { birthYear: 2000 });
  linkParents(child, p1, p2);
  const first = assignPeopleToTreeAnchors({
    people: [p1, p2, child],
    focusedPersonId: "c",
    visiblePersonIds: new Set(["p1", "p2", "c"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const second = assignPeopleToTreeAnchors({
    people: [p1, p2, child],
    focusedPersonId: "c",
    visiblePersonIds: new Set(["p1", "p2", "c"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const leftFirst = first.assignments.find(
    (item) => item.lineageKey === "parent-left-lineage",
  );
  const leftSecond = second.assignments.find(
    (item) => item.lineageKey === "parent-left-lineage",
  );
  assert(leftFirst?.personId === leftSecond?.personId, "stable parent order");
}

// 21. Overflow stays on lineage side
{
  const child = person("c", "Child", { birthYear: 2000 });
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  linkParents(child, father);
  const people: Person[] = [child, father];
  const ids = new Set<string>(["c", "f"]);
  for (let i = 0; i < 8; i += 1) {
    const ancestor = person(`pl${i}`, `PL${i}`, {
      gender: "male",
      birthYear: 1900 + i,
    });
    if (i === 0) {
      linkParents(father, ancestor);
    } else {
      linkParents(people[people.length - 1], ancestor);
    }
    people.push(ancestor);
    ids.add(ancestor.id);
  }
  const result = assignPeopleToTreeAnchors({
    people,
    focusedPersonId: "c",
    visiblePersonIds: ids,
    anchors: COMPACT_TREE_ANCHORS,
  });
  const leftOverflow = result.overflowGroups.filter(
    (group) => group.lineageKey === "parent-left-lineage",
  );
  assert(leftOverflow.length > 0, "left lineage overflow exists");
  assert(
    leftOverflow.every((group) => group.x < 0.55),
    "left overflow stays on left half",
  );
}

// 22. Couple children above pair
{
  const focus = person("f", "Focus", { gender: "male", birthYear: 1980 });
  const spouse = person("s", "Spouse", { gender: "female", birthYear: 1982 });
  const child = person("c", "Child", { birthYear: 2010 });
  linkSpouses(focus, spouse);
  linkParents(child, focus, spouse);
  const layout = buildAssetTreeLayout({
    people: [focus, spouse, child],
    focusId: "f",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1200,
    isMobile: false,
  });
  assert(placementY(layout, "c") < placementY(layout, "f"), "child above couple");
  assert(placementY(layout, "c") < placementY(layout, "s"), "child above spouse");
}

// 23. Center switch recalculates lineage
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkParents(child, father);
  const childView = assignPeopleToTreeAnchors({
    people: [father, child],
    focusedPersonId: "c",
    visiblePersonIds: new Set(["f", "c"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  const fatherView = assignPeopleToTreeAnchors({
    people: [father, child],
    focusedPersonId: "f",
    visiblePersonIds: new Set(["f", "c"]),
    anchors: COMPACT_TREE_ANCHORS,
  });
  assert(
    childView.assignments.find((item) => item.personId === "c")?.lineageKey ===
      "focus",
    "child is focus when centered",
  );
  assert(
    fatherView.assignments.find((item) => item.personId === "c")?.lineageKey ===
      "descendant",
    "child is descendant when parent centered",
  );
}

// 24. No central medallion collisions
{
  const father = person("f", "Father", { gender: "male", birthYear: 1970 });
  const mother = person("m", "Mother", { gender: "female", birthYear: 1972 });
  const child = person("c", "Child", { birthYear: 2000 });
  linkSpouses(father, mother);
  linkParents(child, father, mother);
  const layout = buildAssetTreeLayout({
    people: [father, mother, child],
    focusId: "c",
    viewMode: "nearby",
    expandedCollateral: new Set(),
    viewportWidth: 1200,
    isMobile: false,
  });
  const validation = validateTreeAssetLayout(layout);
  assert(validation.valid, `no collisions: ${validation.issues.join(", ")}`);
}

console.log(`\nTree anchor layout self-test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
