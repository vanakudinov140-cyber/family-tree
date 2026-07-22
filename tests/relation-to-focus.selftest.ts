/**
 * Run: npx tsx tests/relation-to-focus.selftest.ts
 */
import type { Person } from "../src/types/family";
import {
  mapRelationsToFocus,
  resolveRelationToFocus,
} from "../src/lib/relation-to-focus";

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
  extra: Partial<Person> = {},
): Person {
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

function main(): void {
  const father = person("father", {
    gender: "male",
    childIds: ["focus", "sister"],
    spouseIds: ["mother"],
  });
  const mother = person("mother", {
    gender: "female",
    childIds: ["focus", "sister"],
    spouseIds: ["father"],
  });
  const sister = person("sister", {
    gender: "female",
    parentIds: ["father", "mother"],
  });
  const focus = person("focus", {
    gender: "male",
    parentIds: ["father", "mother"],
    childIds: ["daughter"],
    spouseIds: ["spouse"],
  });
  const spouse = person("spouse", {
    gender: "female",
    spouseIds: ["focus"],
    childIds: ["daughter"],
  });
  const daughter = person("daughter", {
    gender: "female",
    parentIds: ["focus", "spouse"],
    childIds: ["granddaughter"],
  });
  const granddaughter = person("granddaughter", {
    gender: "female",
    parentIds: ["daughter"],
  });
  const half = person("half", {
    gender: "male",
    parentIds: ["father"],
  });
  father.childIds = [...(father.childIds ?? []), "half"];

  const people = [
    father,
    mother,
    sister,
    focus,
    spouse,
    daughter,
    granddaughter,
    half,
  ];

  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "focus", people })
      .kind === "center",
    "center",
  );
  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "spouse", people })
      .label === "супруга",
    "spouse label",
  );
  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "father", people })
      .kind === "father",
    "father",
  );
  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "sister", people })
      .kind === "sister",
    "sister",
  );
  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "half", people })
      .kind === "half-brother",
    "half-brother",
  );
  assert(
    resolveRelationToFocus({ focusId: "focus", personId: "daughter", people })
      .kind === "daughter",
    "daughter",
  );
  assert(
    resolveRelationToFocus({
      focusId: "focus",
      personId: "granddaughter",
      people,
    }).kind === "granddaughter",
    "granddaughter",
  );
  assert(
    resolveRelationToFocus({
      focusId: "focus",
      personId: "granddaughter",
      people,
    }).chainLabel.includes("→"),
    "chain for grandchild",
  );

  const sonInLaw = person("sonInLaw", {
    gender: "male",
    spouseIds: ["daughter"],
  });
  daughter.spouseIds = ["sonInLaw"];
  assert(
    resolveRelationToFocus({
      focusId: "focus",
      personId: "sonInLaw",
      people: [...people, sonInLaw],
    }).label.includes("дочери") ||
      resolveRelationToFocus({
        focusId: "focus",
        personId: "sonInLaw",
        people: [...people, sonInLaw],
      }).label.includes("супруг"),
    "child spouse is not unknown",
  );
  assert(
    resolveRelationToFocus({
      focusId: "focus",
      personId: "sonInLaw",
      people: [...people, sonInLaw],
    }).label !== "связь не определена",
    "child spouse must not say unknown",
  );

  const stranger = person("stranger");
  assert(
    resolveRelationToFocus({
      focusId: "focus",
      personId: "stranger",
      people: [...people, stranger],
    }).label === "связь не определена",
    "unknown relation",
  );

  const mapped = mapRelationsToFocus("focus", people);
  assert(mapped.get("sister")?.kind === "sister", "map sister");

  // Center change recalculates
  const asDaughter = resolveRelationToFocus({
    focusId: "daughter",
    personId: "focus",
    people,
  });
  assert(asDaughter.kind === "father", "recalculated when center changes");

  // eslint-disable-next-line no-console
  console.log(`relation-to-focus.selftest: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
