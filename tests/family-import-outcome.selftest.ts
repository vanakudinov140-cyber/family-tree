/**
 * Run: npx tsx tests/family-import-outcome.selftest.ts
 */
import { computeFamilyGraphStats } from "../src/lib/family-graph-stats";
import {
  buildImportOutcomeSummary,
  buildImportPipelineCounts,
} from "../src/lib/family-import-outcome";
import type { Person } from "../src/types/family";

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

function person(id: string): Person {
  return {
    id,
    firstName: id,
    lastName: "Test",
    parentIds: [],
    childIds: [],
    spouseIds: [],
  };
}

const counts = buildImportPipelineCounts({
  parsedPeopleCount: 41,
  parsedRelationshipsCount: 0,
  validation: {
    valid: true,
    errors: [],
    warnings: [],
    newPeopleCount: 41,
    existingPeopleCount: 0,
    newRelationshipsCount: 0,
    existingRelationshipsCount: 0,
    unresolvedKeys: [],
    duplicateKeys: [],
    reviewRequiredCount: 0,
  },
  payloadPeopleCount: 41,
  payloadRelationshipsCount: 0,
  batch: {
    insertedPeople: Array.from({ length: 41 }, (_, index) => ({
      key: `p${index}`,
      id: `id-${index}`,
    })),
    skippedPeople: [],
    insertedRelationships: [],
    skippedRelationships: [],
    warnings: [],
    importedPersonIds: [],
    mode: "insert_only",
  },
});

assert(
  counts.parsedPeopleCount !== counts.createdPeopleCount ||
    counts.parsedPeopleCount === 41,
  "parsed count tracked separately",
);
assert(counts.createdPeopleCount === 41, "created count from batch");

const noRelSummary = buildImportOutcomeSummary(counts, null);
assert(
  noRelSummary.warningNoRelationships,
  "people without relationships flagged",
);
assert(
  noRelSummary.headline.includes("Родственные связи не созданы"),
  "warning headline for missing relationships",
);

const zeroSummary = buildImportOutcomeSummary(
  buildImportPipelineCounts({
    parsedPeopleCount: 10,
    parsedRelationshipsCount: 0,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      newPeopleCount: 0,
      existingPeopleCount: 10,
      newRelationshipsCount: 0,
      existingRelationshipsCount: 0,
      unresolvedKeys: [],
      duplicateKeys: [],
      reviewRequiredCount: 0,
    },
    payloadPeopleCount: 10,
    payloadRelationshipsCount: 0,
    batch: {
      insertedPeople: [],
      skippedPeople: Array.from({ length: 10 }, (_, index) => ({
        key: `p${index}`,
        reason: "exists",
      })),
      insertedRelationships: [],
      skippedRelationships: [],
      warnings: [],
      importedPersonIds: [],
      mode: "insert_only",
    },
  }),
  null,
);
assert(
  zeroSummary.headline.includes("уже присутствуют"),
  "duplicate import message",
);

const isolatedPeople = Array.from({ length: 41 }, (_, index) =>
  person(`iso-${index}`),
);
const stats = computeFamilyGraphStats(isolatedPeople, 0, "iso-0");
assert(stats.peopleLoaded === 41, "all isolated people loaded");
assert(stats.connectedComponents === 41, "each person is own component");
assert(stats.relationshipsLoaded === 0, "zero relationships tracked");

console.log(`\nFamily import outcome self-test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
