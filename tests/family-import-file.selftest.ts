/**
 * Run: npx tsx tests/family-import-file.selftest.ts
 */
import {
  describeZeroImportResult,
  detectImportFileFormat,
  extractFileExtension,
  parseImportFile,
  readImportFileText,
  stripUtf8Bom,
} from "../src/lib/family-import-file";

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

const samplePayload = {
  version: 1 as const,
  people: [
    {
      key: "person-a",
      firstName: "Alpha",
      gender: "unknown" as const,
    },
  ],
  relationships: [],
};

const sampleJson = JSON.stringify(samplePayload);

function makeFile(
  name: string,
  content: string | ArrayBuffer,
  type = "",
): File {
  return new File([content], name, { type });
}

assert(
  detectImportFileFormat("family.json", "application/json") === "json",
  "json mime",
);
assert(
  detectImportFileFormat("family.json", "") === "json",
  "json empty mime",
);
assert(
  detectImportFileFormat("family.json", "application/octet-stream") === "json",
  "json octet-stream",
);
assert(
  detectImportFileFormat("FAMILY.JSON", "") === "json",
  "uppercase json extension",
);
assert(
  detectImportFileFormat("my family.json", "") === "json",
  "filename with spaces",
);
assert(
  detectImportFileFormat("data.csv", "text/csv") === "csv",
  "csv mime",
);
assert(
  detectImportFileFormat("DATA.CSV", "") === "csv",
  "uppercase csv extension",
);
assert(
  detectImportFileFormat("book.xlsx", "application/octet-stream") === "xlsx",
  "xlsx octet-stream",
);
assert(extractFileExtension("  file.JSON  ") === "json", "trimmed extension");

assert(stripUtf8Bom("\uFEFF{\"version\":1}") === "{\"version\":1}", "strip bom");

(async () => {
  const jsonFile = makeFile("import.json", sampleJson, "application/json");
  const parsedJson = await parseImportFile(jsonFile);
  assert(parsedJson.peopleCount === 1, "json parsed people count");
  assert(parsedJson.payload.people[0]?.key === "person-a", "json payload");

  const emptyMime = makeFile("import.json", sampleJson, "");
  const parsedEmptyMime = await parseImportFile(emptyMime);
  assert(parsedEmptyMime.format === "json", "empty mime json");

  const octet = makeFile("import.json", sampleJson, "application/octet-stream");
  const parsedOctet = await parseImportFile(octet);
  assert(parsedOctet.format === "json", "octet-stream json");

  const bomFile = makeFile(
    "import.json",
    `\uFEFF${sampleJson}`,
    "application/json",
  );
  const parsedBom = await parseImportFile(bomFile);
  assert(parsedBom.peopleCount === 1, "bom json");

  let csvRejected = false;
  try {
    await parseImportFile(makeFile("data.csv", "a,b,c", "text/csv"));
  } catch (error) {
    csvRejected =
      error instanceof Error && error.message.includes("CSV");
  }
  assert(csvRejected, "csv rejected with message");

  const zeroExisting = describeZeroImportResult(
    {
      insertedPeople: [],
      insertedRelationships: [],
      skippedPeople: [{ reason: "exists" }],
    },
    1,
  );
  assert(
    zeroExisting?.includes("уже присутствуют") ?? false,
    "zero import existing message",
  );

  const zeroPayload = describeZeroImportResult(
    {
      insertedPeople: [],
      insertedRelationships: [],
      skippedPeople: [],
    },
    0,
  );
  assert(
    zeroPayload?.includes("не найдено записей") ?? false,
    "zero payload message",
  );

  const success = describeZeroImportResult(
    {
      insertedPeople: [{ key: "a", id: "1" }],
      insertedRelationships: [],
      skippedPeople: [],
    },
    1,
  );
  assert(success === null, "non-zero import has no zero message");

  const text = await readImportFileText(makeFile("x.json", sampleJson));
  assert(text === sampleJson, "readImportFileText");

  console.log(`\nFamily import file self-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
