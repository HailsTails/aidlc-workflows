import { expect, test, mock } from "bun:test";
import { createPreparedDistributionSource, createPreparedDistributionOperations } from "./prepared-distribution-source.ts";
import { createPreparedDistributionFixture } from "../../__tests__/workflow-runtime-fixtures.ts";
import { distributionLocation, distributionSeed, expectedLoadedSeed } from "../../__tests__/distribution-fixtures.ts";
test("reads an unfinished native runtime without requiring generated-file presence", async () => {
  expect(await createPreparedDistributionSource({ operations: createPreparedDistributionFixture() }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: expectedLoadedSeed });
});
test("unsafe raw inventory is refused before reading native file contents", async () => {
  const operations = createPreparedDistributionFixture();
  expect(await createPreparedDistributionSource({ operations: { ...operations, inventory: mock().mockResolvedValue({ paths: ["../outside"], directories: [] }) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test("duplicate paths cannot hide a changed raw input", async () => {
  const operations = createPreparedDistributionFixture();
  expect(await createPreparedDistributionSource({ operations: { ...operations, inventory: mock().mockResolvedValue({ paths: [".claude/a", ".claude/a"], directories: [] }) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toMatchObject({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test("shared runtime directories do not make different harness identities interchangeable", async () => {
  const operations = createPreparedDistributionFixture();
  expect(await createPreparedDistributionSource({ operations: { ...operations, context: mock().mockResolvedValue({ harness: { schemaVersion: 1, distribution: "kiro", harnessDir: ".kiro", rulesSubdir: "steering" }, invocation: "aidlc" }) } }).load({ location: distributionLocation, binding: { harness: "kiro-ide", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "prepared-distribution", detail: "unfinished producer metadata must match the requested harness binding and native runtime context" }] });
  expect(operations.read).not.toHaveBeenCalled();
});
test("inventory unavailability stays an actionable failure", async () => {
  expect(await createPreparedDistributionSource({ operations: { ...createPreparedDistributionFixture(), inventory: mock().mockRejectedValue(new Error("native walker unavailable")) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "prepared-distribution", detail: "unfinished native runtime unavailable: native walker unavailable" }] });
});
test("production operations reuse native context and byte readers", () => {
  expect(createPreparedDistributionOperations()).toMatchObject({ inventory: expect.any(Function), context: expect.any(Function), read: expect.any(Function) });
});
