import { expect, mock, test } from "bun:test";
import { createHarnessSettingsDistributionSource } from "./harness-settings-distribution.ts";
import { distributionSeed, distributionLocation } from "../__tests__/distribution-fixtures.ts";

const services = () => ({ preparer: { prepare: mock() }, admit: mock(), rules: { path: mock() } });
test("settings source forwards prepared context to its application owner", async () => {
  const source = { load: mock().mockResolvedValue({ status: "ok", value: distributionSeed }) }, inputs = services(), preparedSeed = { ...distributionSeed, files: [] }, prepare = mock().mockResolvedValue({ status: "ok", value: preparedSeed });
  expect(await createHarnessSettingsDistributionSource({ source, mode: 0o640, services: inputs, prepare }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: preparedSeed });
  expect(source.load.mock.calls).toEqual([[{ location: distributionLocation, binding: distributionSeed.binding }]]);
  expect(prepare).toHaveBeenCalledWith({ request: { sourceRoot: distributionLocation.sourceRoot, root: distributionLocation.root, seed: distributionSeed, mode: 0o640 }, services: inputs });
});
test("source failure stops settings preparation", async () => {
  const failure = { status: "invalid", findings: [{ code: "capability-gap", subject: "source", detail: "unavailable" }] } as const;
  const source = { load: mock().mockResolvedValue(failure) }, prepare = mock();
  expect(await createHarnessSettingsDistributionSource({ source, mode: 0o644, services: services(), prepare }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(failure);
  expect(prepare).not.toHaveBeenCalled();
});
