import { expect, mock, test } from "bun:test";
import { createDistributionSource } from "./distribution-source.ts";
import { assembledDistribution, createDistributionSourceOperationsFixture, distributionLocation, expectedLoadedSeed, invalidNativeContexts, invalidNativeInspections, nativeInspection } from "../../__tests__/distribution-fixtures.ts";
test("loads every inventoried file as bytes after native validation", async () => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations }).load(distributionLocation)).toEqual({ status: "ok", value: expectedLoadedSeed });
  expect(operations.inspect).toHaveBeenCalledWith({ sourceRoot: "source", root: "seed" });
  expect(operations.read).toHaveBeenCalledTimes(5);
  expect(operations.read).toHaveBeenCalledWith({ root: "seed", path: ".claude/assets/opaque.bin" });
});
test.each(invalidNativeInspections)("refuses $name before reading file bodies", async ({ inspection }) => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations: { ...operations, inspect: mock().mockResolvedValue(inspection) } }).load(distributionLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-seed", detail: "native distribution inspection must return a supported binding and safe file/directory inventory" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test("refuses an unsupported identity without conflating shared engine directories", async () => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations: { ...operations, inspect: mock().mockResolvedValue({ ...nativeInspection, projection: { stamp: { distribution: "cursor", harnessDir: ".claude" } } }) } }).load(distributionLocation)).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "distribution-seed", detail: "native seed declares an unsupported harness binding" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test.each(invalidNativeContexts)("refuses $name before reading seed bytes", async ({ context }) => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations: { ...operations, context: mock().mockResolvedValue(context) } }).load(distributionLocation)).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "distribution-seed", detail: "native runtime context must declare the seed's binding, rules path and invocation" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test("native consumer violations refuse instead of becoming an empty seed", async () => {
  expect(await createDistributionSource({ operations: { ...createDistributionSourceOperationsFixture(), inspect: mock().mockResolvedValue({ status: "refused", detail: "unclassified projection entries: .runner-home" }) } }).load(distributionLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-seed", detail: "native distribution refused: unclassified projection entries: .runner-home" }] });
});
test("uses the native archive producer over complete bytes and modes", async () => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations }).archive({ sourceRoot: "source", distribution: assembledDistribution })).toEqual({ status: "ok", value: new Uint8Array([31, 139]) });
  expect(operations.pack).toHaveBeenCalledWith({ sourceRoot: "source", files: assembledDistribution.files, directories: [] });
});
test("native archive unavailability remains a failure", async () => {
  expect(await createDistributionSource({ operations: { ...createDistributionSourceOperationsFixture(), pack: mock().mockRejectedValue(new Error("archive unavailable")) } }).archive({ sourceRoot: "source", distribution: assembledDistribution })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "distribution-archive", detail: "native archive producer unavailable: archive unavailable" }] });
});
test("reads authored skill through the storage boundary", async () => {
  expect(await createDistributionSource({ operations: createDistributionSourceOperationsFixture() }).skill({ sourceRoot: "source" })).toEqual({ status: "ok", value: "authored skill" });
});
test("missing authored skill remains unavailable", async () => {
  expect(await createDistributionSource({ operations: { ...createDistributionSourceOperationsFixture(), skill: mock().mockRejectedValue(new Error("missing")) } }).skill({ sourceRoot: "source" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-session-cost", detail: "authored skill unavailable: missing" }] });
});
test("empty directories and their modes reach the native archive owner", async () => {
  const operations = createDistributionSourceOperationsFixture();
  expect(await createDistributionSource({ operations }).archive({ sourceRoot: "source", distribution: { ...assembledDistribution, directories: [{ path: ".claude/empty", mode: 0o755 }] } })).toEqual({ status: "ok", value: new Uint8Array([31, 139]) });
  expect(operations.pack).toHaveBeenCalledWith({ sourceRoot: "source", files: assembledDistribution.files, directories: [{ path: ".claude/empty", mode: 0o755 }] });
});
