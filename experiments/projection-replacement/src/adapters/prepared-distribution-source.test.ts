import { expect, test, mock } from "bun:test";
import { createPreparedDistributionSource, createPreparedDistributionOperations } from "./prepared-distribution-source.ts";
import { createPreparedContextFixture, nativePreparedContext } from "../../__tests__/prepared-context-fixtures.ts";
import { distributionLocation, distributionSeed, expectedLoadedSeed } from "../../__tests__/distribution-fixtures.ts";
import { sourcePreparedContext, contextDescriptorFile, contextInputPreparation } from "../../__tests__/distribution-context-fixtures.ts";
const contextFailure = { status: "invalid", findings: [{ code: "foreign-content", subject: "context-fixture", detail: "context refused" }] } as const;
test("reads an unfinished inventory through an admitted typed context", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource(services).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: expectedLoadedSeed });
  expect(services.context.load).toHaveBeenCalledWith({ location: distributionLocation, binding: distributionSeed.binding });
  expect(services.operations.context).not.toHaveBeenCalled();
  expect(services.admit).toHaveBeenCalledWith({ candidates: [], inventory: expectedLoadedSeed, rules: services.rules });
});
test("unsafe inventory stops before context and file reads", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, operations: { ...services.operations, inventory: mock().mockResolvedValue({ paths: ["../outside"], directories: [] }) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" }] });
  expect(services.context.load).not.toHaveBeenCalled();
  expect(services.operations.read).not.toHaveBeenCalled();
});
test("duplicate input paths cannot hide changed bytes", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, operations: { ...services.operations, inventory: mock().mockResolvedValue({ paths: [".claude/a", ".claude/a"], directories: [] }) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-distribution", detail: "unfinished producer input requires a unique safe native file inventory and directory modes" }] });
  expect(services.context.load).not.toHaveBeenCalled();
});
test("inventory unavailability remains actionable failure data", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, operations: { ...services.operations, inventory: mock().mockRejectedValue(new Error("native walker unavailable")) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "prepared-distribution", detail: "unfinished native runtime unavailable: native walker unavailable" }] });
  expect(services.context.load).not.toHaveBeenCalled();
});
test("source-prepared context seeds inventory without importing a missing native context", async () => {
  const services = createPreparedContextFixture(), context = { load: mock().mockResolvedValue({ status: "ok", value: sourcePreparedContext }) }, admit = mock().mockReturnValue({ status: "ok", value: { additions: [contextDescriptorFile], unchanged: [] } });
  const operations = { ...services.operations, inventory: mock().mockResolvedValue({ paths: [], directories: [] }) };
  expect(await createPreparedDistributionSource({ ...services, operations, context, admit }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: { basis: distributionSeed.basis, binding: distributionSeed.binding, rulesSubdir: "rules", invocation: "bun .claude/tools/aidlc.ts", files: [contextDescriptorFile], directories: [], inputPreparations: [contextInputPreparation] } });
  expect(context.load).toHaveBeenCalledWith({ location: distributionLocation, binding: distributionSeed.binding });
  expect(operations.context).not.toHaveBeenCalled();
  expect(operations.read).not.toHaveBeenCalled();
  expect(admit).toHaveBeenCalledWith({ candidates: [contextDescriptorFile], inventory: { basis: distributionSeed.basis, binding: distributionSeed.binding, rulesSubdir: "rules", invocation: "bun .claude/tools/aidlc.ts", files: [], directories: [] }, rules: services.rules });
});
test("context refusal cannot fall back to native metadata", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, context: { load: mock().mockResolvedValue(contextFailure) } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(contextFailure);
  expect(services.operations.context).not.toHaveBeenCalled();
  expect(services.operations.read).not.toHaveBeenCalled();
  expect(services.admit).not.toHaveBeenCalled();
});
test("changed descriptor admission remains refusal", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, context: { load: mock().mockResolvedValue({ status: "ok", value: sourcePreparedContext }) }, admit: mock().mockReturnValue(contextFailure) }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(contextFailure);
  expect(services.operations.context).not.toHaveBeenCalled();
});
test("typed context for another harness cannot be grafted onto requested inventory", async () => {
  const services = createPreparedContextFixture();
  expect(await createPreparedDistributionSource({ ...services, context: { load: mock().mockResolvedValue({ status: "ok", value: nativePreparedContext }) } }).load({ location: distributionLocation, binding: { harness: "kiro-ide", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "prepared-distribution", detail: "prepared context must preserve the inventory's requested harness binding" }] });
  expect(services.admit).not.toHaveBeenCalled();
});
test("production operations keep inventory and native byte ports available", () => {
  expect(createPreparedDistributionOperations()).toMatchObject({ inventory: expect.any(Function), context: expect.any(Function), read: expect.any(Function) });
});
