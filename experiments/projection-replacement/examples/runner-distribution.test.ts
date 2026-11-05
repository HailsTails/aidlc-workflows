import { expect, mock, test } from "bun:test";
import { assembleRunnerDistribution, createRunnerDistributionServices } from "./runner-distribution.ts";
import { createRunnerDistributionServicesFixture, issuedCoreDistribution, ownershipRecord, ownedProduct } from "../__tests__/projection-ownership-fixtures.ts";
import { distributionLocation } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { distributionProjection } from "../__tests__/distribution-fixtures.ts";
test("issues a native archive and ownership only after final artifact verification", async () => {
  const services = createRunnerDistributionServicesFixture();
  const issued = successful(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services }));
  expect(issued.archive).toEqual(new Uint8Array([31, 139]));
  expect(issued.ownershipJson).toBe("issued-record");
  expect(services.issue).toHaveBeenCalledWith({ distribution: issuedCoreDistribution, products: [ownedProduct], digest: services.digest });
  expect(services.codec.write).toHaveBeenCalledWith({ ownership: ownershipRecord });
});
test("native input refusal stops generation", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, source: { ...services.source, load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.source.archive).not.toHaveBeenCalled();
});
test("changed prepared output cannot be silently adopted into a fresh record", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, admit: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.assembler.assemble).not.toHaveBeenCalled();
  expect(services.issue).not.toHaveBeenCalled();
});
test("final product mismatch stops archive production", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, issue: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.source.archive).not.toHaveBeenCalled();
  expect(services.codec.write).not.toHaveBeenCalled();
});
test("archive failure does not expose a successor ownership record", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, source: { ...services.source, archive: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.codec.write).not.toHaveBeenCalled();
});
test("production factory composes existing preparation, assembly and ownership ports", () => {
  expect(createRunnerDistributionServices()).toMatchObject({ source: { load: expect.any(Function), archive: expect.any(Function) }, prepare: expect.any(Function), assembler: { assemble: expect.any(Function) }, admit: expect.any(Function), products: expect.any(Function), issue: expect.any(Function), codec: { write: expect.any(Function) } });
});
test("scope composition cannot smuggle another projected capability into the runner producer", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", definitions: distributionProjection, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "runner-distribution", detail: "additional authored projection must contain only stage/scope definitions targeting this runtime binding" }] });
  expect(services.source.archive).not.toHaveBeenCalled();
});
