/**
 * Run: npx tsx tests/focused-family-layout.selftest.ts
 */
import type { Person } from "../src/types/family";
import { buildFocusedFamilyModel } from "../src/lib/focused-family-model";
import {
  buildFocusedFamilyLayout,
  validateFocusedLayoutNoCollisions,
} from "../src/lib/focused-family-layout";

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

function person(id: string, extra: Partial<Person> = {}): Person {
  return {
    id,
    firstName: id,
    lastName: "",
    relationshipLabel: "",
    parentIds: [],
    childIds: [],
    ...extra,
  };
}

function linkParent(child: Person, parent: Person): void {
  child.parentIds = [...new Set([...(child.parentIds ?? []), parent.id])];
  parent.childIds = [...new Set([...(parent.childIds ?? []), child.id])];
}

function main(): void {
  const elder = person("elder");
  const c1 = person("c1");
  const c2 = person("c2");
  const c3 = person("c3");
  linkParent(c1, elder);
  linkParent(c2, elder);
  linkParent(c3, elder);
  const g1 = person("g1");
  const g2 = person("g2");
  const g3 = person("g3");
  linkParent(g1, c1);
  linkParent(g2, c2);
  linkParent(g3, c3);
  const people = [elder, c1, c2, c3, g1, g2, g3];

  const model = buildFocusedFamilyModel({
    focusId: "elder",
    people,
    viewMode: "generations",
  });
  const layout = buildFocusedFamilyLayout({
    model,
    people,
    viewportWidth: 1440,
    isMobile: false,
    viewMode: "generations",
  });

  const focus = layout.placements.find((item) => item.isFocus);
  assert(Boolean(focus), "focus placed");
  assert(
    Math.abs(focus!.x + 59 - layout.focusCenter.x) < 1,
    "focus center matches",
  );
  assert(
    Math.abs(focus!.x - (layout.width / 2 - 200)) < 400,
    "focus near horizontal center band",
  );
  assert(
    validateFocusedLayoutNoCollisions(layout.placements),
    "no collisions desktop",
  );

  const mobileLayout = buildFocusedFamilyLayout({
    model,
    people,
    viewportWidth: 390,
    isMobile: true,
    viewMode: "generations",
  });
  assert(
    validateFocusedLayoutNoCollisions(mobileLayout.placements),
    "no collisions mobile 390",
  );
  const mobileFocus = mobileLayout.placements.find((item) => item.isFocus);
  assert(Boolean(mobileFocus), "mobile focus placed");
  assert(
    Math.abs(mobileFocus!.x + 59 - mobileLayout.focusCenter.x) < 1,
    "mobile focus center matches",
  );
  assert(
    layout.placements.every(
      (item) => Number.isFinite(item.x) && Number.isFinite(item.y),
    ),
    "no NaN",
  );
  assert(layout.softLinks.length > 0, "soft links present");
  assert(layout.components[0]?.renderTreeAsset === true, "decorative tree");

  // Units grouped: children share a row
  const childYs = layout.placements
    .filter((item) => ["c1", "c2", "c3"].includes(item.personId))
    .map((item) => item.y);
  assert(childYs.length === 3, "all children placed");
  const childSpread = Math.max(...childYs) - Math.min(...childYs);
  assert(childSpread < 130, "children stay in family row band");

  const again = buildFocusedFamilyLayout({
    model,
    people,
    viewportWidth: 1440,
    isMobile: false,
    viewMode: "generations",
  });
  const key = (items: typeof layout.placements) =>
    items
      .map((item) => `${item.personId}:${item.x.toFixed(2)}:${item.y.toFixed(2)}`)
      .sort()
      .join("|");
  assert(key(layout.placements) === key(again.placements), "deterministic layout");

  // eslint-disable-next-line no-console
  console.log(`focused-family-layout.selftest: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
