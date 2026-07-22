/**
 * Run: npx tsx tests/focused-family-model.selftest.ts
 */
import type { Person } from "../src/types/family";
import {
  buildFocusedFamilyModel,
  getDirectChildren,
  getDirectGrandchildren,
  getSiblingsOfPerson,
} from "../src/lib/focused-family-model";
import { buildPersonIndex, getVisiblePersonIds } from "../src/lib/tree-visibility";

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

function buildElderFamily(): Person[] {
  const elder = person("elder", { gender: "female" });
  const spouse = person("spouse", { gender: "male", spouseIds: ["elder"] });
  elder.spouseIds = ["spouse"];
  const c1 = person("c1", { gender: "female" });
  const c2 = person("c2", { gender: "male" });
  const c3 = person("c3", { gender: "female" });
  linkParent(c1, elder);
  linkParent(c2, elder);
  linkParent(c3, elder);
  linkParent(c1, spouse);
  linkParent(c2, spouse);
  linkParent(c3, spouse);
  const g11 = person("g11");
  const g12 = person("g12");
  const g21 = person("g21");
  const g31 = person("g31", { gender: "female" });
  linkParent(g11, c1);
  linkParent(g12, c1);
  linkParent(g21, c2);
  linkParent(g31, c3);
  return [elder, spouse, c1, c2, c3, g11, g12, g21, g31];
}

function main(): void {
  const elderPeople = buildElderFamily();
  const elderModel = buildFocusedFamilyModel({
    focusId: "elder",
    people: elderPeople,
    viewMode: "generations",
  });
  assert(elderModel.scenario === "elder-three", "elder scenario");
  assert(elderModel.personIds.has("c1"), "all child c1");
  assert(elderModel.personIds.has("c2"), "all child c2");
  assert(elderModel.personIds.has("c3"), "all child c3");
  assert(elderModel.personIds.has("g11"), "grandchild via c1");
  assert(elderModel.personIds.has("g21"), "grandchild via c2");
  assert(elderModel.personIds.has("g31"), "grandchild via c3 daughter line");

  const index = buildPersonIndex(elderPeople);
  assert(getDirectChildren("elder", index).length === 3, "3 direct children");
  assert(
    getDirectGrandchildren("elder", index).length === 4,
    "grandchildren through all lines",
  );

  // Adult with siblings
  const parent = person("parent", { childIds: ["focus", "bro", "sis"] });
  const focus = person("focus", {
    parentIds: ["parent"],
    childIds: ["kid"],
    spouseIds: ["sp"],
  });
  const bro = person("bro", { gender: "male", parentIds: ["parent"] });
  const sis = person("sis", { gender: "female", parentIds: ["parent"] });
  const sp = person("sp", { spouseIds: ["focus"], childIds: ["kid"] });
  const kid = person("kid", { parentIds: ["focus", "sp"] });
  const niece = person("niece", { parentIds: ["bro"] });
  bro.childIds = ["niece"];
  const adultPeople = [parent, focus, bro, sis, sp, kid, niece];
  const adult = buildFocusedFamilyModel({
    focusId: "focus",
    people: adultPeople,
    viewMode: "generations",
  });
  assert(adult.scenario === "adult-three", "adult scenario");
  assert(adult.personIds.has("bro") && adult.personIds.has("sis"), "siblings");
  assert(adult.personIds.has("kid"), "own child");
  assert(!adult.personIds.has("niece"), "no sibling children");

  const siblings = getSiblingsOfPerson({
    personId: "focus",
    people: adultPeople,
  });
  assert(siblings.includes("bro") && siblings.includes("sis"), "sibling helper");
  assert(siblings.length === 2, "no duplicate siblings");

  // Child with grandparents
  const gp = person("gp", { childIds: ["parent2"] });
  const parent2 = person("parent2", {
    parentIds: ["gp"],
    childIds: ["child"],
  });
  const child = person("child", { parentIds: ["parent2"] });
  const childModel = buildFocusedFamilyModel({
    focusId: "child",
    people: [gp, parent2, child],
    viewMode: "generations",
  });
  assert(childModel.scenario === "child-three", "child scenario");
  assert(childModel.personIds.has("gp"), "grandparents visible");

  // Tree/Scheme same visible set
  const visible = getVisiblePersonIds({
    mode: "generations",
    focusId: "elder",
    people: elderPeople,
    collapsedPersonIds: new Set(),
  });
  assert(visible.size === elderModel.personIds.size, "same visible size");
  for (const id of elderModel.personIds) {
    assert(visible.has(id), `scheme visible has ${id}`);
  }

  // Deterministic + cycle safe
  const a = person("a", { parentIds: ["b"], childIds: ["b"] });
  const b = person("b", { parentIds: ["a"], childIds: ["a"] });
  const cycled = buildFocusedFamilyModel({
    focusId: "a",
    people: [a, b],
    viewMode: "nearby",
  });
  assert(cycled.personIds.has("a"), "cycle finite");

  const first = [...elderModel.personIds].sort().join("|");
  const second = [
    ...buildFocusedFamilyModel({
      focusId: "elder",
      people: elderPeople,
      viewMode: "generations",
    }).personIds,
  ]
    .sort()
    .join("|");
  assert(first === second, "deterministic");

  // Performance
  const many: Person[] = [];
  for (let i = 0; i < 300; i += 1) {
    many.push(
      person(`p${i}`, {
        parentIds: i > 0 ? [`p${i - 1}`] : [],
        childIds: i < 299 ? [`p${i + 1}`] : [],
      }),
    );
  }
  const started = Date.now();
  buildFocusedFamilyModel({
    focusId: "p150",
    people: many,
    viewMode: "branch",
  });
  assert(Date.now() - started < 3000, "300 people under 3s");

  // eslint-disable-next-line no-console
  console.log(`focused-family-model.selftest: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
