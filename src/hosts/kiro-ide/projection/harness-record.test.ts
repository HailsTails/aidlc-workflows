import { expect, test } from "bun:test";
import { distribution, path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { HarnessRecordFacts } from "../../../projection/domain/harness-record.ts";
import { createKiroIdeHarnessRecord, KIRO_IDE_LAYOUT } from "./harness-record.ts";

const facts: HarnessRecordFacts = { identity: { schemaVersion: 1, distribution: distribution("kiro-ide"),
  productName: "Kiro IDE", configNextStep: "Open", name: distribution("kiro-ide"), harnessDir: path(".kiro") },
setup: { rulesSubdir: "steering", newChatStep: { text: "Start" } },
runtime: { hostShell: { env: ["HOST"] } } };

test("Kiro IDE owns its layout value", () => {
  expect(KIRO_IDE_LAYOUT).toBe("kas");
});

test("Kiro IDE constructs its complete closed record before serialization", () => {
  expect(createKiroIdeHarnessRecord(facts)).toEqual(accepted({
    ...facts.identity, ...facts.setup, kiroLayout: "kas", ...facts.runtime,
  }));
});

test("a different host cannot receive this layout policy", () => {
  expect(createKiroIdeHarnessRecord({ ...facts, identity: { ...facts.identity,
    distribution: distribution("other") } })).toEqual(refused({
    kind: "render-failed", concept: "host-data", name: "other",
    reason: "Kiro IDE's harness record requires the Kiro IDE host identity.",
  }));
});