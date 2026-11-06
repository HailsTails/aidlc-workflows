import { expect, mock, test } from "bun:test";
import { createArtifactStructureSource } from "./artifact-structure-source.ts";
import { distributionSeed, distributionLocation } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("artifact structure declares construction intent while retaining admitted input inventory", async () => {
  const source = { load: mock().mockResolvedValue({ status: "ok", value: distributionSeed }) };
  expect(await createArtifactStructureSource({ source, structure: { kind: "file-parents", mode: 0o755 } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: { ...distributionSeed, structure: { kind: "file-parents", mode: 0o755 } } });
  expect(source.load.mock.calls).toEqual([[{ location: distributionLocation, binding: distributionSeed.binding }]]);
});
test("failed source admission cannot be converted into a structure-only seed", async () => {
  const source = { load: mock().mockResolvedValue(runnerFailure) };
  expect(await createArtifactStructureSource({ source, structure: { kind: "file-parents", mode: 0o755 } }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(runnerFailure);
});
