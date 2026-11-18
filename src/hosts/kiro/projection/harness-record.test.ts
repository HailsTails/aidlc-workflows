import { expect, test } from "bun:test";
import { distribution, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { HarnessRecordFacts } from "../../../projection/domain/harness-record.ts";
import { createKiroHarnessRecord, KIRO_LAYOUT } from "./harness-record.ts";

const facts: HarnessRecordFacts = { identity: { schemaVersion: 1, distribution: distribution("kiro"),
  productName: "Kiro", configNextStep: "Open", name: distribution("kiro"), harnessDir: path(".kiro") },
setup: { rulesSubdir: "steering", newChatStep: { text: "Start" } },
runtime: { hostShell: { env: ["HOST"] } } };

test("Kiro owns its layout value", () => {
  expect(KIRO_LAYOUT).toBe("agent-v1");
});

test("Kiro constructs its complete closed record before serialization", () => {
  expect(createKiroHarnessRecord(facts)).toEqual(accepted({
    ...facts.identity, ...facts.setup, kiroLayout: "agent-v1", ...facts.runtime,
  }));
});

test("a different host cannot receive this layout policy", () => {
  expect(createKiroHarnessRecord({ ...facts, identity: { ...facts.identity,
    distribution: distribution("other") } })).toEqual(refused({
    kind: "render-failed", concept: "host-data", name: "other",
    reason: "Kiro's harness record requires the Kiro host identity.",
  }));
});