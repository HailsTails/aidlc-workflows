import { expect, mock, test } from "bun:test";
import { createSourceAssemblyReader } from "./source-assembly-reader.ts";
import { createSourceReadMock, emptyKnowledgeTexts, foreignSourceTexts, malformedSourceTexts, sourceAssemblyArguments, sourceAssemblySnapshot, sourceAssemblyTiers } from "../../__tests__/source-assembly-fixtures.ts";
test("loads authored inputs and existing matching distribution identities", async () => {
  const read = createSourceReadMock(), tiers = mock().mockResolvedValue(sourceAssemblyTiers);
  expect(await createSourceAssemblyReader({ operations: { read, tiers } }).load(sourceAssemblyArguments)).toEqual({ status: "ok", value: sourceAssemblySnapshot });
  expect(read).toHaveBeenCalledTimes(10);
  expect(read).toHaveBeenCalledWith({ root: "runtime", path: ".claude/tools/data/aidlc-projection.json" });
  expect(read).toHaveBeenCalledWith({ root: "source", path: "core/agents/aidlc-quality-agent.md" });
  expect(tiers).toHaveBeenCalledWith({ root: "source" });
});
test("rejects another harness identity", async () => {
  expect(await createSourceAssemblyReader({ operations: { read: createSourceReadMock({ texts: foreignSourceTexts }), tiers: mock().mockResolvedValue(sourceAssemblyTiers) } }).load(sourceAssemblyArguments)).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "source-assembly", detail: "source preview requires matching existing Claude projection descriptor, stamp and harness identity" }] });
});
test("rejects malformed identity JSON", async () => {
  expect(await createSourceAssemblyReader({ operations: { read: createSourceReadMock({ texts: malformedSourceTexts }), tiers: mock().mockResolvedValue(sourceAssemblyTiers) } }).load(sourceAssemblyArguments)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "source-assembly", detail: "source preview requires JSON distribution identity files" }] });
});
test("refuses missing authored knowledge", async () => {
  expect(await createSourceAssemblyReader({ operations: { read: createSourceReadMock({ texts: emptyKnowledgeTexts }), tiers: mock().mockResolvedValue(sourceAssemblyTiers) } }).load(sourceAssemblyArguments)).toEqual({ status: "invalid", findings: [{ code: "missing-knowledge", subject: "aidlc-quality-agent", detail: "source preview requires all four authored quality knowledge files" }] });
});
test("refuses unknown tier policy rather than assuming permissions or models", async () => {
  expect(await createSourceAssemblyReader({ operations: { read: createSourceReadMock(), tiers: mock().mockResolvedValue({}) } }).load(sourceAssemblyArguments)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-assembly", detail: "source preview requires the source owner's Claude tier projection table" }] });
});
test("reports unavailable storage as data", async () => {
  expect(await createSourceAssemblyReader({ operations: { read: mock().mockRejectedValue(new Error("source unavailable")), tiers: mock().mockResolvedValue(sourceAssemblyTiers) } }).load(sourceAssemblyArguments)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-assembly", detail: "source preview inputs unavailable: source unavailable" }] });
});
