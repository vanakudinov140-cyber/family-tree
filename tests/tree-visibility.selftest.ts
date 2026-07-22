import type { Person } from "@/types/family";
import {
  buildPersonIndex,
  getAncestorIds,
  getBranchPersonIds,
  getDescendantIds,
  getGenerationsPersonIds,
  getNearbyPersonIds,
  getThreeGenerationPersonIds,
  getThreeGenerationWindow,
  getVisiblePersonIds,
  computeRelativeGenerations,
  chooseThreeGenerationLevels,
} from "../src/lib/tree-visibility";
import { buildFamilyBlocks } from "../src/lib/tree-layout";

function person(partial: {
  id: string;
  parentIds?: string[];
  childIds?: string[];
  spouseIds?: string[];
  spouseId?: string;
}): Person {
  return {
    id: partial.id,
    firstName: partial.id,
    lastName: "",
    relationshipLabel: "",
    parentIds: partial.parentIds ?? [],
    childIds: partial.childIds ?? [],
    spouseId: partial.spouseId ?? partial.spouseIds?.[0],
    spouseIds: partial.spouseIds,
  };
}

/** Tatiana → Mikhail (+Anna) → Ivan (+Dina) → Demid */
function buildFourGenerationFamily(): Person[] {
  return [
    person({ id: "tatiana", childIds: ["mikhail"] }),
    person({
      id: "mikhail",
      parentIds: ["tatiana"],
      childIds: ["ivan"],
      spouseIds: ["anna"],
    }),
    person({
      id: "anna",
      childIds: ["ivan"],
      spouseIds: ["mikhail"],
    }),
    person({
      id: "ivan",
      parentIds: ["mikhail", "anna"],
      childIds: ["demid"],
      spouseIds: ["dina"],
    }),
    person({
      id: "dina",
      parentIds: ["outsider-parent"], // outside branch when focused on tatiana
      childIds: ["demid"],
      spouseIds: ["ivan"],
    }),
    person({
      id: "demid",
      parentIds: ["ivan", "dina"],
    }),
  ];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function countLayoutDepth(people: Person[]): number {
  const blocks = buildFamilyBlocks(people);
  function depth(block: {
    marriages: Array<{ children: unknown[] }>;
    soloChildren: unknown[];
  }): number {
    const childBlocks = [
      ...block.marriages.flatMap((m) => m.children),
      ...block.soloChildren,
    ] as Array<{
      marriages: Array<{ children: unknown[] }>;
      soloChildren: unknown[];
    }>;
    if (childBlocks.length === 0) return 1;
    return 1 + Math.max(...childBlocks.map(depth));
  }
  if (blocks.length === 0) return 0;
  return Math.max(...blocks.map(depth));
}

function testFourGenerationsBranchVisibility(): void {
  const people = buildFourGenerationFamily();
  const index = buildPersonIndex(people);

  const fromTatiana = getBranchPersonIds("tatiana", index);
  assert(fromTatiana.has("tatiana"), "branch from tatiana includes self");
  assert(fromTatiana.has("mikhail"), "branch includes mikhail");
  assert(fromTatiana.has("ivan"), "branch includes ivan");
  assert(fromTatiana.has("demid"), "branch includes demid");
  assert(fromTatiana.has("anna"), "branch includes spouse anna");

  const fromDemid = getBranchPersonIds("demid", index);
  assert(fromDemid.has("tatiana"), "demid branch includes tatiana");
  assert(fromDemid.has("mikhail"), "demid branch includes mikhail");
  assert(fromDemid.has("ivan"), "demid branch includes ivan");
}

function testLayoutShowsFourGenerations(): void {
  const people = buildFourGenerationFamily().filter((p) =>
    ["tatiana", "mikhail", "anna", "ivan", "dina", "demid"].includes(p.id),
  );
  // Simulate filtered branch: dina's outsider parent not present
  const sanitized = people.map((p) =>
    p.id === "dina" ? { ...p, parentIds: [] } : p,
  );
  const depth = countLayoutDepth(sanitized);
  assert(
    depth >= 4,
    `layout depth should be >= 4 for Tatiana→…→Demid, got ${depth}`,
  );

  const blocks = buildFamilyBlocks(sanitized);
  const tatianaBlock = blocks.find((b) => b.memberIds.includes("tatiana"));
  assert(Boolean(tatianaBlock), "tatiana should be a layout root block");
  assert(
    !blocks.some(
      (b) => b.focusId === "anna" && !b.memberIds.includes("mikhail"),
    ),
    "anna must not steal mikhail as a separate root",
  );
}

function testGenerationsModeIncludesGrandparents(): void {
  const people = buildFourGenerationFamily();
  const index = buildPersonIndex(people);
  const gens = getThreeGenerationPersonIds("demid", index);
  assert(gens.has("demid"), "generations includes focus");
  assert(gens.has("ivan"), "generations includes parent");
  assert(gens.has("dina"), "generations includes parent spouse");
  assert(gens.has("mikhail"), "generations includes grandparent");
  assert(gens.has("anna"), "generations includes grandparent spouse");
  assert(!gens.has("tatiana"), "generations excludes great-grandparent");
  assert(!gens.has("outsider-parent"), "generations excludes unrelated parent");
}

function testGenerationsModeIncludesSiblingsForChildFocus(): void {
  const sibling = person({ id: "sibling", parentIds: ["ivan", "dina"] });
  // Keep parent↔child links consistent for index.childIds
  const people = buildFourGenerationFamily().map((p) => {
    if (p.id === "ivan" || p.id === "dina") {
      return { ...p, childIds: [...(p.childIds ?? []), "sibling"] };
    }
    return p;
  });
  people.push(sibling);
  const index = buildPersonIndex(people);
  const gens = getThreeGenerationPersonIds("demid", index);
  assert(gens.has("sibling"), "child-three includes focus siblings");
}

function testAdultGenerationsExcludesNieces(): void {
  const people = [
    person({ id: "parent", childIds: ["focus", "sibling"] }),
    person({
      id: "focus",
      parentIds: ["parent"],
      childIds: ["child"],
      spouseIds: ["spouse"],
    }),
    person({ id: "spouse", spouseIds: ["focus"], childIds: ["child"] }),
    person({ id: "sibling", parentIds: ["parent"], childIds: ["niece"] }),
    person({ id: "child", parentIds: ["focus", "spouse"] }),
    person({ id: "niece", parentIds: ["sibling"] }),
  ];
  const gens = getThreeGenerationPersonIds("focus", buildPersonIndex(people));
  assert(gens.has("sibling"), "adult includes sibling");
  assert(gens.has("child"), "adult includes own child");
  assert(!gens.has("niece"), "adult excludes sibling children");
}

function testThreeGenerationWindowScenarios(): void {
  // A: parents + grandparents, no children → [-2,-1,0]
  {
    const people = buildFourGenerationFamily().filter((p) =>
      ["demid", "ivan", "dina", "mikhail", "anna"].includes(p.id),
    );
    const sanitized = people.map((p) =>
      p.id === "demid" ? { ...p, childIds: [] } : p,
    );
    const window = getThreeGenerationWindow({
      focusedPersonId: "demid",
      people: sanitized,
    });
    assert(
      window.levels.join(",") === "-2,-1,0",
      `A levels expected -2,-1,0 got ${window.levels.join(",")}`,
    );
  }

  // B: parents + children → [-1,0,+1]
  {
    const people = [
      person({ id: "parent", childIds: ["focus"], spouseIds: ["parent-spouse"] }),
      person({ id: "parent-spouse", childIds: ["focus"], spouseIds: ["parent"] }),
      person({
        id: "focus",
        parentIds: ["parent", "parent-spouse"],
        childIds: ["child"],
        spouseIds: ["spouse"],
      }),
      person({ id: "spouse", spouseIds: ["focus"] }),
      person({ id: "child", parentIds: ["focus", "spouse"] }),
    ];
    const window = getThreeGenerationWindow({
      focusedPersonId: "focus",
      people,
    });
    assert(
      window.levels.join(",") === "-1,0,1",
      `B levels expected -1,0,1 got ${window.levels.join(",")}`,
    );
    assert(window.personIds.has("parent"), "B has parent");
    assert(window.personIds.has("child"), "B has child");
  }

  // C: no parents, children + grandchildren → [0,+1,+2]
  {
    const people = [
      person({ id: "elder", childIds: ["mid"] }),
      person({ id: "mid", parentIds: ["elder"], childIds: ["young"] }),
      person({ id: "young", parentIds: ["mid"] }),
    ];
    const window = getThreeGenerationWindow({
      focusedPersonId: "elder",
      people,
    });
    assert(
      window.levels.join(",") === "0,1,2",
      `C levels expected 0,1,2 got ${window.levels.join(",")}`,
    );
    assert(window.personIds.has("elder"), "C has focus");
    assert(window.personIds.has("mid"), "C has child");
    assert(window.personIds.has("young"), "C has grandchild");
  }

  // D: only parents → [-1,0]
  {
    const people = [
      person({ id: "parent", childIds: ["child"] }),
      person({ id: "child", parentIds: ["parent"] }),
    ];
    const window = getThreeGenerationWindow({
      focusedPersonId: "child",
      people,
    });
    assert(
      window.levels.join(",") === "-1,0",
      `D levels expected -1,0 got ${window.levels.join(",")}`,
    );
  }

  // E: only children → [0,+1]
  {
    const people = [
      person({ id: "parent", childIds: ["child"] }),
      person({ id: "child", parentIds: ["parent"] }),
    ];
    const window = getThreeGenerationWindow({
      focusedPersonId: "parent",
      people,
    });
    assert(
      window.levels.join(",") === "0,1",
      `E levels expected 0,1 got ${window.levels.join(",")}`,
    );
  }

  // F: isolated → [0]
  {
    const window = getThreeGenerationWindow({
      focusedPersonId: "alone",
      people: [person({ id: "alone" })],
    });
    assert(window.levels.join(",") === "0", "F isolated level 0");
    assert(window.personIds.size === 1, "F one person");
  }
}

function testTatianaLikeGenerationsShowsDescendants(): void {
  const people = buildFourGenerationFamily();
  const window = getThreeGenerationWindow({
    focusedPersonId: "tatiana",
    people,
  });
  assert(window.personIds.has("tatiana"), "tatiana visible");
  assert(window.personIds.has("mikhail"), "child visible");
  assert(window.personIds.has("ivan"), "grandchild visible");
  assert(!window.personIds.has("demid"), "great-grandchild excluded from 3-gen window");
  assert(
    window.levels.join(",") === "0,1,2",
    `tatiana levels 0,1,2 got ${window.levels.join(",")}`,
  );
}

function testDemidLikeGenerationsShowsAncestors(): void {
  const people = buildFourGenerationFamily();
  const window = getThreeGenerationWindow({
    focusedPersonId: "demid",
    people,
  });
  assert(window.personIds.has("mikhail"), "grandparent visible for demid");
  assert(window.personIds.has("ivan"), "parent visible for demid");
  assert(
    window.levels.join(",") === "-2,-1,0",
    `demid levels -2,-1,0 got ${window.levels.join(",")}`,
  );
}

function testTreeAndSchemeShareGenerationsVisibleSet(): void {
  const people = buildFourGenerationFamily();
  const fromWindow = getThreeGenerationWindow({
    focusedPersonId: "tatiana",
    people,
  }).personIds;
  const fromVisible = getVisiblePersonIds({
    mode: "generations",
    focusId: "tatiana",
    people,
    collapsedPersonIds: new Set(),
  });
  assert(fromWindow.size === fromVisible.size, "same size for tree/scheme");
  for (const id of fromWindow) {
    assert(fromVisible.has(id), `visible missing ${id}`);
  }
}

function testGenerationsExcludesUncles(): void {
  const father = person({
    id: "father",
    parentIds: ["gp"],
    childIds: ["child"],
  });
  const gp = person({ id: "gp", childIds: ["father", "uncle"] });
  const uncle = person({ id: "uncle", parentIds: ["gp"] });
  const child = person({ id: "child", parentIds: ["father"] });
  const visible = getThreeGenerationPersonIds(
    "child",
    buildPersonIndex([father, gp, uncle, child]),
  );
  assert(visible.has("gp"), "grandparent included");
  assert(!visible.has("uncle"), "uncle not auto-included");
}

function testGenerationsNoDuplicateIds(): void {
  const people = buildFourGenerationFamily();
  const ids = [...getThreeGenerationPersonIds("ivan", buildPersonIndex(people))];
  assert(ids.length === new Set(ids).size, "no duplicate person ids");
}

function testGenerationsDeterministic(): void {
  const people = buildFourGenerationFamily();
  const a = [...getThreeGenerationPersonIds("ivan", buildPersonIndex(people))].sort();
  const b = [...getThreeGenerationPersonIds("ivan", buildPersonIndex(people))].sort();
  assert(a.join("|") === b.join("|"), "generations result deterministic");
}

function testThreeGenerationLineageSides(): void {
  const father = person({
    id: "father",
    gender: "male",
    parentIds: ["pgf", "pgm"],
    childIds: ["child"],
    spouseIds: ["mother"],
  });
  const mother = person({
    id: "mother",
    gender: "female",
    parentIds: ["mgf", "mgm"],
    childIds: ["child"],
    spouseIds: ["father"],
  });
  const child = person({
    id: "child",
    parentIds: ["father", "mother"],
  });
  const pgf = person({
    id: "pgf",
    gender: "male",
    childIds: ["father"],
    spouseIds: ["pgm"],
  });
  const pgm = person({
    id: "pgm",
    gender: "female",
    childIds: ["father"],
    spouseIds: ["pgf"],
  });
  const mgf = person({
    id: "mgf",
    gender: "male",
    childIds: ["mother"],
    spouseIds: ["mgm"],
  });
  const mgm = person({
    id: "mgm",
    gender: "female",
    childIds: ["mother"],
    spouseIds: ["mgf"],
  });
  const uncle = person({
    id: "uncle",
    gender: "male",
    parentIds: ["pgf", "pgm"],
  });
  const people = [father, mother, child, pgf, pgm, mgf, mgm, uncle];
  const visible = getThreeGenerationPersonIds("child", buildPersonIndex(people));
  assert(visible.has("pgf") && visible.has("pgm"), "paternal grandparents visible");
  assert(visible.has("mgf") && visible.has("mgm"), "maternal grandparents visible");
  assert(!visible.has("uncle"), "parent sibling excluded");
}

function testThreeGenerationDepthLevels(): void {
  const alone = person({ id: "alone" });
  const indexAlone = buildPersonIndex([alone]);
  assert(
    getThreeGenerationPersonIds("alone", indexAlone).size === 1,
    "focus without parents is one level",
  );

  const parent = person({ id: "parent", childIds: ["child"] });
  const child = person({ id: "child", parentIds: ["parent"] });
  const indexTwo = buildPersonIndex([parent, child]);
  const two = getThreeGenerationPersonIds("child", indexTwo);
  assert(two.has("child") && two.has("parent"), "focus with parent is two levels");
  assert(two.size === 2, "two levels count");

  const gp = person({ id: "gp", childIds: ["parent"] });
  parent.parentIds = ["gp"];
  gp.childIds = ["parent"];
  const indexThree = buildPersonIndex([gp, parent, child]);
  const three = getThreeGenerationPersonIds("child", indexThree);
  assert(three.has("gp"), "three levels includes grandparent");
}

function testNearbyStaysLocal(): void {
  const people = buildFourGenerationFamily();
  const index = buildPersonIndex(people);
  const nearby = getNearbyPersonIds("ivan", index);
  assert(nearby.has("mikhail"), "nearby has parents");
  assert(nearby.has("demid"), "nearby has children");
  assert(!nearby.has("tatiana"), "nearby excludes grandparents");
}

function testRelativeGenerations(): void {
  const people = buildFourGenerationFamily();
  const index = buildPersonIndex(people);
  const gens = computeRelativeGenerations("ivan", index);
  assert(gens.get("ivan") === 0, "focus is generation 0");
  assert(gens.get("mikhail") === -1, "parent is -1");
  assert(gens.get("tatiana") === -2, "grandparent is -2");
  assert(gens.get("demid") === 1, "child is +1");
  assert(gens.get("anna") === -1, "parent spouse shares generation");
  assert(gens.get("dina") === 0, "focus spouse shares generation");
}

function testEightGenerationsVisibility(): void {
  const people: Person[] = [];
  for (let i = 0; i < 8; i += 1) {
    const id = `g${i}`;
    people.push(
      person({
        id,
        parentIds: i === 0 ? [] : [`g${i - 1}`],
        childIds: i === 7 ? [] : [`g${i + 1}`],
      }),
    );
  }
  const index = buildPersonIndex(people);
  const branch = getBranchPersonIds("g3", index);
  assert(branch.size === 8, `branch should include all 8 people, got ${branch.size}`);
  const gens = computeRelativeGenerations("g3", index);
  assert(gens.get("g0") === -3, "oldest relative gen");
  assert(gens.get("g7") === 4, "youngest relative gen");
}

function testParentCycleDoesNotInfiniteLoop(): void {
  const people = [
    person({ id: "a", parentIds: ["b"], childIds: ["b"] }),
    person({ id: "b", parentIds: ["a"], childIds: ["a"] }),
  ];
  const index = buildPersonIndex(people);
  const ancestors = getAncestorIds("a", index);
  const descendants = getDescendantIds("a", index);
  assert(ancestors.has("b"), "cycle ancestor found");
  assert(descendants.has("b"), "cycle descendant found");
  // If we got here without hanging, iteration terminated.
  const branch = getBranchPersonIds("a", index);
  assert(branch.size === 2, "cycle branch stays finite");
}

function testVisiblePersonIdsModes(): void {
  const people = buildFourGenerationFamily();
  const branch = getVisiblePersonIds({
    mode: "branch",
    focusId: "tatiana",
    people,
    collapsedPersonIds: new Set(),
  });
  assert(branch.has("demid"), "visible branch includes demid");

  const generations = getVisiblePersonIds({
    mode: "generations",
    focusId: "demid",
    people,
    collapsedPersonIds: new Set(),
  });
  assert(generations.has("mikhail"), "visible generations includes grandparent");
  assert(!generations.has("tatiana"), "visible generations excludes great-grandparent");

  const all = getVisiblePersonIds({
    mode: "all",
    focusId: "ivan",
    people,
    collapsedPersonIds: new Set(),
  });
  assert(all.size === people.length, "all shows everyone");
}

function main(): void {
  testFourGenerationsBranchVisibility();
  testLayoutShowsFourGenerations();
  testGenerationsModeIncludesGrandparents();
  testGenerationsModeIncludesSiblingsForChildFocus();
  testAdultGenerationsExcludesNieces();
  testThreeGenerationWindowScenarios();
  testTatianaLikeGenerationsShowsDescendants();
  testDemidLikeGenerationsShowsAncestors();
  testTreeAndSchemeShareGenerationsVisibleSet();
  testGenerationsExcludesUncles();
  testGenerationsNoDuplicateIds();
  testGenerationsDeterministic();
  testThreeGenerationLineageSides();
  testThreeGenerationDepthLevels();
  testNearbyStaysLocal();
  testRelativeGenerations();
  testEightGenerationsVisibility();
  testParentCycleDoesNotInfiniteLoop();
  testVisiblePersonIdsModes();
  assert(
    chooseThreeGenerationLevels([-2, -1, 0, 1, 2]).join(",") === "-1,0,1",
    "choose prefers centered window when both sides exist",
  );
  // eslint-disable-next-line no-console
  console.log("tree-visibility tests passed");
}

main();
