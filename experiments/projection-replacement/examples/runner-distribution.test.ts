import { expect, mock, test } from "bun:test";
import { assembleRunnerDistribution, createRunnerDistributionServices } from "./runner-distribution.ts";
import { completeProjectionDistribution } from "./projection-distribution.ts";
import { createRunnerDistributionServicesFixture, ownedSeed, runnerProjectionSet, runnerIssuedArtifact } from "../__tests__/projection-ownership-fixtures.ts";
import { distributionLocation, distributionProjection } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("runner discovery delegates one prepared projection to final issuance", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services })).toEqual({ status: "ok", value: runnerIssuedArtifact });
  expect(services.prepare).toHaveBeenCalledWith({ seed: ownedSeed, location: distributionLocation, modelInvocation: "native-default" });
  expect(services.finish).toHaveBeenCalledWith({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services });
});
test("native input refusal stops generation and completion", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, source: { ...services.source, load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.finish).not.toHaveBeenCalled();
});
test("runner preparation refusal prevents completion", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services: { ...services, prepare: mock().mockResolvedValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.finish).not.toHaveBeenCalled();
});
test("completion refusal is returned unchanged", async () => {
  const services = { ...createRunnerDistributionServicesFixture(), finish: mock().mockResolvedValue(runnerFailure) };
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", services })).toEqual(runnerFailure);
  expect(services.finish).toHaveBeenCalledWith({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services });
});
test("production factory wires the shared final issuer", () => {
  expect(createRunnerDistributionServices()).toMatchObject({ source: { load: expect.any(Function), archive: expect.any(Function) }, prepare: expect.any(Function), finish: completeProjectionDistribution });
});
test("workflow definitions cannot smuggle another capability through the runner compatibility entry", async () => {
  const services = createRunnerDistributionServicesFixture();
  expect(await assembleRunnerDistribution({ location: distributionLocation, mode: 0o644, modelInvocation: "native-default", definitions: distributionProjection, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "runner-distribution", detail: "additional authored projection must contain only stage/scope definitions targeting this runtime binding" }] });
  expect(services.finish).not.toHaveBeenCalled();
});