import { expect, mock, test } from "bun:test";
import { prepareRunnerRequirements } from "./runner-requirements.ts";
import { createRequirementsServicesFixture, nativeRequirements, requirementSeed } from "../__tests__/runner-requirement-fixtures.ts";
import { distributionLocation } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("prepares a seed and requirements from the same native input context", async () => {
  const services = createRequirementsServicesFixture();
  expect(await prepareRunnerRequirements({ location: distributionLocation, services })).toEqual({ status: "ok", value: { seed: requirementSeed, requirements: nativeRequirements, stageDocuments: [] } });
  expect(services.source.load).toHaveBeenCalledWith(distributionLocation);
  expect(services.factory).toHaveBeenCalledWith({ location: distributionLocation, seed: requirementSeed });
});
test("seed refusal cannot start native discovery", async () => {
  const services = createRequirementsServicesFixture();
  expect(await prepareRunnerRequirements({ location: distributionLocation, services: { ...services, source: { load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.factory).not.toHaveBeenCalled();
  expect(services.discover).not.toHaveBeenCalled();
});
test("incomplete native requirements cannot become a successful prepared seed", async () => {
  expect(await prepareRunnerRequirements({ location: distributionLocation, services: { ...createRequirementsServicesFixture(), discover: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
});
test("unsupported graph declarations do not become an incomplete stage dependency set", async () => {
  expect(await prepareRunnerRequirements({ location: distributionLocation, services: { ...createRequirementsServicesFixture(), stages: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
});
