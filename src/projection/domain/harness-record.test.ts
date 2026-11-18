import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { distribution, path } from "../../kernel/fixtures/values.fixture.ts";
import { commonHarnessRecord, harnessRecordConflicts, type HarnessRecordFacts } from "./harness-record.ts";

const facts: HarnessRecordFacts = { identity: { schemaVersion: 1, distribution: distribution("example"),
  productName: "Example", configNextStep: "Open", name: distribution("example"), harnessDir: path(".example") },
setup: { rulesSubdir: "rules" }, runtime: {} };
const completeRecord = { ...facts.identity, ...facts.setup, ...facts.runtime };

test("the common constructor constructs the complete declared record without host-specific fields", () => {
  expect(commonHarnessRecord(facts)).toEqual(accepted(completeRecord));
});

test("unchanged common facts are compatible", () => {
  expect(harnessRecordConflicts({ facts, record: completeRecord })).toEqual([]);
});

test("a constructor cannot override common identity or configuration", () => {
  expect(harnessRecordConflicts({ facts, record: { ...completeRecord,
    distribution: distribution("other"), rulesSubdir: "different" } }))
    .toEqual(["distribution", "rulesSubdir"]);
});

test("a constructor cannot introduce an absent common capability", () => {
  expect(harnessRecordConflicts({ facts, record: { ...completeRecord,
    statusLine: { items: ["new"] } } })).toEqual(["statusLine"]);
});

test("a constructor cannot omit an existing common runtime fact", () => {
  expect(harnessRecordConflicts({ facts: { ...facts, runtime: { directiveMaxBytes: 2048 } },
    record: completeRecord })).toEqual(["directiveMaxBytes"]);
});
