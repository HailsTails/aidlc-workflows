import { contextInputPreparation } from "../__tests__/distribution-context-fixtures.ts";
import { assetInputPreparation } from "../__tests__/runtime-asset-delivery-fixtures.ts";
import { expect, mock, test } from "bun:test";
import { completeProjectionDistribution, createProjectionDistributionServices } from "./projection-distribution.ts";
import { createProjectionDistributionServicesFixture, issuedCoreDistribution, ownershipRecord, ownedProduct, ownedSeed, runnerProjectionSet } from "../__tests__/projection-ownership-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { planPreparedFileAdditions } from "../src/domain/prepared-file-additions.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import { issueCoreProjectionOwnership } from "../src/domain/projection-ownership.ts";
test("one final distribution issues ownership after admission, assembly and archive validation", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), admit: mock().mockReturnValue({ status: "ok", value: { additions: [{ path: ".claude/skills/new/SKILL.md", mode: 0o644, bytes: new Uint8Array([8]) }], unchanged: [] } }) };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services })).toEqual({ status: "ok", value: { archive: new Uint8Array([31, 139]), ownershipJson: "issued-record", distribution: issuedCoreDistribution, projection: runnerProjectionSet } });
  expect(services.admit).toHaveBeenCalledWith({ candidates: runnerProjectionSet.resources, inventory: ownedSeed, mode: 0o644, rules: services.rules });
  expect(services.assembler.assemble).toHaveBeenCalledWith({ seed: { ...ownedSeed, files: [...ownedSeed.files, { path: ".claude/skills/new/SKILL.md", mode: 0o644, bytes: new Uint8Array([8]) }] }, projection: runnerProjectionSet });
  expect(services.products).toHaveBeenCalledWith({ projection: runnerProjectionSet, sources: [ownedSeed.basis], compiler: ownedSeed.basis, mode: 0o644, rules: services.rules });
  expect(services.issue).toHaveBeenCalledWith({ distribution: issuedCoreDistribution, products: [ownedProduct], digest: services.digest });
  expect(services.source.archive).toHaveBeenCalledWith({ sourceRoot: "source", distribution: issuedCoreDistribution });
  expect(services.codec.write).toHaveBeenCalledWith({ ownership: ownershipRecord });
});
test("changed prepared output cannot be adopted into ownership", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), admit: mock().mockReturnValue(runnerFailure) };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.assembler.assemble).not.toHaveBeenCalled();
  expect(services.issue).not.toHaveBeenCalled();
});
test("assembly failure prevents product issuance", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), assembler: { assemble: mock().mockReturnValue(runnerFailure) } };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.products).not.toHaveBeenCalled();
});
test("product preparation refusal stops ownership issuance", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), products: mock().mockReturnValue(runnerFailure) };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.issue).not.toHaveBeenCalled();
});
test("final product mismatch stops archive production", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), issue: mock().mockReturnValue(runnerFailure) };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.source.archive).not.toHaveBeenCalled();
  expect(services.codec.write).not.toHaveBeenCalled();
});
test("archive refusal does not expose a successor ownership record", async () => {
  const services = { ...createProjectionDistributionServicesFixture(), admit: mock().mockReturnValue({ status: "ok", value: { additions: [{ path: ".claude/skills/new/SKILL.md", mode: 0o644, bytes: new Uint8Array([8]) }], unchanged: [] } }) };
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: ownedSeed, projection: runnerProjectionSet, mode: 0o644, services: { ...services, source: { archive: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.codec.write).not.toHaveBeenCalled();
});
test("production completion uses the canonical admission, products and ownership owners", () => {
  expect(createProjectionDistributionServices()).toMatchObject({ admit: planPreparedFileAdditions, products: prepareProjectedProducts, issue: issueCoreProjectionOwnership });
});

test("context preparation reaches the published artifact without becoming projected ownership", async () => {
  const services = createProjectionDistributionServicesFixture();
  expect(await completeProjectionDistribution({ sourceRoot: "source", seed: { ...ownedSeed, inputPreparations: [contextInputPreparation, assetInputPreparation] }, projection: runnerProjectionSet, mode: 0o644, services })).toEqual({ status: "ok", value: { archive: new Uint8Array([31, 139]), ownershipJson: "issued-record", distribution: issuedCoreDistribution, projection: runnerProjectionSet, inputPreparations: [contextInputPreparation, assetInputPreparation] } });
});
