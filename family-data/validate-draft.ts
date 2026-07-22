/**
 * Локальная проверка family-import-draft.json.
 * Только читает файл. Не подключается к Supabase и ничего не пишет в базу.
 *
 * Запуск: npx --yes tsx family-data/validate-draft.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { familyImportPayloadSchema } from "../src/types/family-import";

const root = dirname(fileURLToPath(import.meta.url));
const draftPath = join(root, "family-import-draft.json");

const raw = readFileSync(draftPath, "utf8");
let parsed: unknown;
try {
  parsed = JSON.parse(raw) as unknown;
} catch {
  console.error("FAIL: некорректный JSON");
  process.exit(1);
}

const result = familyImportPayloadSchema.safeParse(parsed);
if (!result.success) {
  console.error("FAIL: Zod-валидация не пройдена");
  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const payload = result.data;
const personKeys = payload.people.map((person) => person.key);
const relKeys = payload.relationships.map((relationship) => relationship.key);

const duplicatePersonKeys = personKeys.filter(
  (key, index) => personKeys.indexOf(key) !== index,
);
const duplicateRelKeys = relKeys.filter(
  (key, index) => relKeys.indexOf(key) !== index,
);

const keySet = new Set(personKeys);
const unresolved: string[] = [];
const selfParents: string[] = [];
const parentEdges: Array<{ parent: string; child: string }> = [];
const spousePairs = new Set<string>();
const reverseSpouseDupes: string[] = [];

for (const relationship of payload.relationships) {
  if (!keySet.has(relationship.person1Key)) {
    unresolved.push(relationship.person1Key);
  }
  if (!keySet.has(relationship.person2Key)) {
    unresolved.push(relationship.person2Key);
  }

  if (
    relationship.type === "parent" &&
    relationship.person1Key === relationship.person2Key
  ) {
    selfParents.push(relationship.key);
  }

  if (relationship.type === "parent") {
    parentEdges.push({
      parent: relationship.person1Key,
      child: relationship.person2Key,
    });
  }

  if (relationship.type === "spouse") {
    const forward = [relationship.person1Key, relationship.person2Key]
      .sort()
      .join("::");
    if (spousePairs.has(forward)) {
      reverseSpouseDupes.push(relationship.key);
    }
    spousePairs.add(forward);
  }
}

const childrenOf = new Map<string, string[]>();
for (const edge of parentEdges) {
  const list = childrenOf.get(edge.parent) ?? [];
  list.push(edge.child);
  childrenOf.set(edge.parent, list);
}

function hasCycle(): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const child of childrenOf.get(node) ?? []) {
      if (dfs(child)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const key of keySet) {
    if (dfs(key)) return true;
  }
  return false;
}

const parents = payload.relationships.filter((item) => item.type === "parent");
const spouses = payload.relationships.filter((item) => item.type === "spouse");
const biological = parents.filter((item) => item.parentKind === "biological");
const adoptive = parents.filter((item) => item.parentKind === "adoptive");
const step = parents.filter((item) => item.parentKind === "step");
const needsReview = payload.people.filter(
  (person) => person.dataStatus === "needs_review",
);
const livingOmitted = payload.people.filter(
  (person) => person.isLiving === undefined,
);

const structuralErrors: string[] = [];
if (duplicatePersonKeys.length > 0) {
  structuralErrors.push(
    `Дублирующие person key: ${[...new Set(duplicatePersonKeys)].join(", ")}`,
  );
}
if (duplicateRelKeys.length > 0) {
  structuralErrors.push(
    `Дублирующие relationship key: ${[...new Set(duplicateRelKeys)].join(", ")}`,
  );
}
if (unresolved.length > 0) {
  structuralErrors.push(
    `Неизвестные ключи: ${[...new Set(unresolved)].join(", ")}`,
  );
}
if (selfParents.length > 0) {
  structuralErrors.push(`Self-parent: ${selfParents.join(", ")}`);
}
if (hasCycle()) {
  structuralErrors.push("Обнаружен родительский цикл");
}
if (reverseSpouseDupes.length > 0) {
  structuralErrors.push(
    `Дублирующие spouse-пары: ${reverseSpouseDupes.join(", ")}`,
  );
}

console.log("Zod: OK");
console.log(`people: ${payload.people.length}`);
console.log(`relationships: ${payload.relationships.length}`);
console.log(`parent: ${parents.length}`);
console.log(`spouse: ${spouses.length}`);
console.log(`biological: ${biological.length}`);
console.log(`adoptive: ${adoptive.length}`);
console.log(`step: ${step.length}`);
console.log(
  `guardian: ${parents.filter((item) => item.parentKind === "guardian").length}`,
);
console.log(
  `confidence confirmed: ${payload.relationships.filter((item) => item.confidence === "confirmed").length}`,
);
console.log(
  `confidence probable: ${payload.relationships.filter((item) => item.confidence === "probable").length}`,
);
console.log(
  `confidence uncertain: ${payload.relationships.filter((item) => item.confidence === "uncertain").length}`,
);
console.log(
  `people confirmed: ${payload.people.filter((person) => person.dataStatus === "confirmed").length}`,
);
console.log(`needs_review people: ${needsReview.length}`);
console.log(
  `isLiving omitted (неизвестно): ${livingOmitted.length} — поле optional в Zod, null не подставлялся`,
);

if (structuralErrors.length > 0) {
  console.error("FAIL: структурные ошибки");
  for (const error of structuralErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Structural checks: OK");
