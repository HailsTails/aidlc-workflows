import { expect, test } from "bun:test";
import { evidenceLedgersFixture } from "../__tests__/evidence-ledgers.ts";
import { parseEvidenceLedgers } from "./sensor-evidence.ts";
test.each([
  null,
  {},
  { files: [] },
])("evidence boundary refuses malformed or incomplete ledgers: %s", (provenance) => {
  const valid = evidenceLedgersFixture();
  expect(parseEvidenceLedgers({ provenance, comparison: valid.comparison })).toEqual({
    status: "invalid",
    code: "invalid-ledger",
    findings: ["invalid sensor provenance or comparison ledger"],
  });
});

test("evidence boundary accepts the complete canonical source set", () => {
  const ledgers = evidenceLedgersFixture();
  expect(parseEvidenceLedgers(ledgers)).toEqual({
    status: "ok",
    sources: ledgers.provenance.files,
    outputs: ledgers.comparison,
  });
});
test.each([
  "./scripts/package.ts",
  "scripts/./package.ts",
  "scripts//package.ts",
  "scripts/../scripts/package.ts",
  "/scripts/package.ts",
  "scripts/package.ts",
  "scripts/not-retained.ts",
])("a count-preserving source substitution cannot replace required coverage: %s", (replacementPath) => {
  expect(parseEvidenceLedgers(evidenceLedgersFixture({ replacementPath }))).toEqual({
    status: "invalid",
    code: "invalid-ledger",
    findings: ["invalid sensor provenance or comparison ledger"],
  });
});
test("source coverage is required separately for each baseline", () => {
  expect(parseEvidenceLedgers(evidenceLedgersFixture({ replacementBaseline: "fork" }))).toEqual({
    status: "invalid",
    code: "invalid-ledger",
    findings: ["invalid sensor provenance or comparison ledger"],
  });
});
test.each([
  "./sensors/aidlc-linter.md",
  "sensors//aidlc-linter.md",
  "sensors/../aidlc-linter.md",
])("retained output paths also reject noncanonical aliases: %s", (outputPath) => {
  expect(parseEvidenceLedgers(evidenceLedgersFixture({ outputPath }))).toEqual({
    status: "invalid",
    code: "invalid-ledger",
    findings: ["invalid sensor provenance or comparison ledger"],
  });
});

test.each([
  { comparison: null },
  { comparison: {} },
  { comparison: [] },
])("evidence boundary rejects malformed comparisons with valid provenance: %s", ({
  comparison,
}) => {
  const valid = evidenceLedgersFixture();
  expect(parseEvidenceLedgers({ provenance: valid.provenance, comparison })).toEqual({
    status: "invalid",
    code: "invalid-ledger",
    findings: ["invalid sensor provenance or comparison ledger"],
  });
});
