import { expect, mock, test } from "bun:test";
import { assembleOwnedSourceDistribution } from "./owned-source-distribution.ts";
import { createOwnedSourceServicesFixture, requirementSeed, nativeRequirements } from "../__tests__/runner-requirement-fixtures.ts";
import { assembledDistribution, distributionBasis, distributionLocation } from "../__tests__/distribution-fixtures.ts";
import { productRequest } from "../__tests__/distribution-product-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("passes automatically discovered current requirements to owned reconciliation", async () => {
  const services = createOwnedSourceServicesFixture();
  expect(await assembleOwnedSourceDistribution({ location: distributionLocation, edits: productRequest.edits, sources: [distributionBasis], services })).toEqual({ status: "ok", value: { distribution: { ...assembledDistribution, added: [], removed: [], projected: [] }, archive: new Uint8Array([31, 139]), requirements: nativeRequirements } });
  expect(services.reconciler.reconcile).toHaveBeenCalledWith({ seed: requirementSeed, edits: productRequest.edits, sources: [distributionBasis], protectedPaths: [], requiredPaths: [".claude/skills/aidlc-code-generation/SKILL.md", ".claude/tools/data/harness.json", ".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json", ".claude/scopes/bugfix.md"] });
});
test("missing native facts abort before reconciliation or archiving", async () => {
  const services = createOwnedSourceServicesFixture();
  expect(await assembleOwnedSourceDistribution({ location: distributionLocation, edits: productRequest.edits, sources: [distributionBasis], services: { ...services, prepare: mock().mockResolvedValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.reconciler.reconcile).not.toHaveBeenCalled();
  expect(services.archive).not.toHaveBeenCalled();
});
test("rejected required-file removal produces no archive", async () => {
  const services = createOwnedSourceServicesFixture();
  expect(await assembleOwnedSourceDistribution({ location: distributionLocation, edits: productRequest.edits, sources: [distributionBasis], services: { ...services, reconciler: { reconcile: mock().mockReturnValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.archive).not.toHaveBeenCalled();
});
test("native archive unavailability stays a failure", async () => {
  expect(await assembleOwnedSourceDistribution({ location: distributionLocation, edits: productRequest.edits, sources: [distributionBasis], services: { ...createOwnedSourceServicesFixture(), archive: mock().mockResolvedValue(runnerFailure) } })).toEqual(runnerFailure);
});
