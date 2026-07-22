/**
 * Run: npx tsx tests/family-view-visibility.selftest.ts
 */
import type { Person } from "../src/types/family";
import {
  assertFamilyViewNesting,
  buildFamilyViewPersonIds,
  selectFamilyViewIds,
} from "../src/lib/family-view-visibility";
import { getVisiblePersonIds } from "../src/lib/tree-visibility";
import { getFocusedFamilyVisibleIds } from "../src/lib/focused-family-model";

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

/** Elder scenario from the task (no real names). */
function buildElderScenario(): Person[] {
  const elder = person("elder", { gender: "female" });
  const spouse = person("spouse", { gender: "male", spouseIds: ["elder"] });
  elder.spouseIds = ["spouse"];

  const child1 = person("child1", { gender: "male" });
  const child2 = person("child2", { gender: "female" });
  linkParent(child1, elder);
  linkParent(child2, elder);
  linkParent(child1, spouse);
  linkParent(child2, spouse);

  const child1Spouse = person("child1Spouse", {
    gender: "female",
    spouseIds: ["child1"],
  });
  child1.spouseIds = ["child1Spouse"];

  const child2Spouse = person("child2Spouse", {
    gender: "male",
    spouseIds: ["child2"],
  });
  child2.spouseIds = ["child2Spouse"];

  const g11 = person("g11");
  const g12 = person("g12");
  linkParent(g11, child1);
  linkParent(g12, child1);
  linkParent(g11, child1Spouse);
  linkParent(g12, child1Spouse);

  const g21 = person("g21");
  const g22 = person("g22");
  const g23 = person("g23");
  linkParent(g21, child2);
  linkParent(g22, child2);
  linkParent(g23, child2);
  linkParent(g21, child2Spouse);
  linkParent(g22, child2Spouse);
  linkParent(g23, child2Spouse);

  const isolated = person("isolated");

  return [
    elder,
    spouse,
    child1,
    child2,
    child1Spouse,
    child2Spouse,
    g11,
    g12,
    g21,
    g22,
    g23,
    isolated,
  ];
}

function main(): void {
  const people = buildElderScenario();
  const visibility = buildFamilyViewPersonIds({
    focusedPersonId: "elder",
    people,
  });

  const nesting = assertFamilyViewNesting(visibility);
  assert(nesting.ok, `nesting must hold: ${nesting.failures.join("; ")}`);

  // nearby: focus + spouse + two children
  assert(visibility.nearbyIds.size === 4, `nearby size 4, got ${visibility.nearbyIds.size}`);
  for (const id of ["elder", "spouse", "child1", "child2"]) {
    assert(visibility.nearbyIds.has(id), `nearby has ${id}`);
  }
  assert(!visibility.nearbyIds.has("g11"), "nearby excludes grandchildren");
  assert(!visibility.nearbyIds.has("child1Spouse"), "nearby excludes child spouses");
  assert(!visibility.nearbyIds.has("isolated"), "nearby excludes isolated");

  // generations: nearby + 5 grandchildren + child spouses
  assert(
    visibility.generationsIds.has("g11") &&
      visibility.generationsIds.has("g12") &&
      visibility.generationsIds.has("g21") &&
      visibility.generationsIds.has("g22") &&
      visibility.generationsIds.has("g23"),
    "generations has five grandchildren",
  );
  assert(
    visibility.generationsIds.has("child1Spouse") &&
      visibility.generationsIds.has("child2Spouse"),
    "generations has child spouses",
  );
  for (const id of visibility.nearbyIds) {
    assert(visibility.generationsIds.has(id), `generations keeps nearby ${id}`);
  }
  assert(!visibility.generationsIds.has("isolated"), "generations excludes isolated");

  // branch: full connected component (everyone except isolated)
  assert(
    visibility.branchIds.size === people.length - 1,
    `branch = connected component, got ${visibility.branchIds.size}`,
  );
  assert(!visibility.branchIds.has("isolated"), "branch excludes isolated");
  for (const id of visibility.generationsIds) {
    assert(visibility.branchIds.has(id), `branch keeps generations ${id}`);
  }

  // all: everyone loaded
  assert(
    visibility.allIds.size === people.length,
    `all = all people, got ${visibility.allIds.size}`,
  );
  assert(visibility.allIds.has("isolated"), "all includes isolated");
  for (const id of visibility.branchIds) {
    assert(visibility.allIds.has(id), `all keeps branch ${id}`);
  }

  // Strict size nesting
  assert(
    visibility.nearbyIds.size <= visibility.generationsIds.size,
    "nearby ≤ generations",
  );
  assert(
    visibility.generationsIds.size <= visibility.branchIds.size,
    "generations ≤ branch",
  );
  assert(
    visibility.branchIds.size <= visibility.allIds.size,
    "branch ≤ all",
  );

  // Tree and Scheme share the same IDs per mode
  for (const mode of ["nearby", "generations", "branch", "all"] as const) {
    const fromTree = getFocusedFamilyVisibleIds({
      focusId: "elder",
      people,
      viewMode: mode,
    });
    const fromScheme = getVisiblePersonIds({
      mode,
      focusId: "elder",
      people,
      collapsedPersonIds: new Set(),
    });
    const selected = selectFamilyViewIds(visibility, mode);
    assert(fromTree.size === selected.size, `tree ${mode} size`);
    assert(fromScheme.size === selected.size, `scheme ${mode} size`);
    for (const id of selected) {
      assert(fromTree.has(id), `tree ${mode} has ${id}`);
      assert(fromScheme.has(id), `scheme ${mode} has ${id}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `family-view-visibility.selftest: ${passed} passed, ${failed} failed`,
  );
  if (failed > 0) process.exit(1);
}

main();
