import { expect, mock, test } from "bun:test";
import { createRuntimeAssetDistributionSource, createRuntimeAssetDistributionServices, createRuntimeAssetPreparer } from "./runtime-asset-distribution.ts";
import { createAssetDeliveryFixture, assetDeliverySources, preparedAssetDelivery } from "../__tests__/runtime-asset-delivery-fixtures.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { prepareRuntimeAssets } from "../src/domain/runtime-assets.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
test("asset preparation reads the declared source and delegates bytes to its domain owner", async () => {
  const services = createAssetDeliveryFixture();
  expect(await createRuntimeAssetPreparer({ services }).prepare({ sourceRoot: "source", root: "input", basis: distributionSeed.basis, binding: distributionSeed.binding, mode: 0o640 })).toEqual({ status: "ok", value: preparedAssetDelivery });
  expect(services.reader.load.mock.calls).toEqual([[{ sourceRoot: "source", basis: distributionSeed.basis }]]);
  expect(services.prepare.mock.calls).toEqual([[{ sources: assetDeliverySources, binding: distributionSeed.binding, mode: 0o640 }]]);
});
test("source asset refusal prevents domain preparation", async () => {
  const services = { ...createAssetDeliveryFixture(), reader: { load: mock().mockResolvedValue(runnerFailure) } };
  expect(await createRuntimeAssetPreparer({ services }).prepare({ sourceRoot: "source", root: "input", basis: distributionSeed.basis, binding: distributionSeed.binding, mode: 0o640 })).toEqual(runnerFailure);
  expect(services.prepare).not.toHaveBeenCalled();
});
test("asset factory delegates merging and admission to the shared input adapter", () => {
  const source = { load: mock() }, services = createAssetDeliveryFixture(), preparer = { prepare: mock() }, createPreparer = mock().mockReturnValue(preparer), create = mock().mockReturnValue(source);
  expect(createRuntimeAssetDistributionSource({ source, mode: 0o640, services, create, createPreparer })).toBe(source);
  expect(createPreparer.mock.calls).toEqual([[{ services }]]);
  expect(create.mock.calls).toEqual([[{ source, mode: 0o640, preparer, admit: services.admit, rules: services.rules }]]);
});
test("production services retain canonical mapping and shared byte admission", () => {
  expect(createRuntimeAssetDistributionServices()).toMatchObject({ reader: { load: expect.any(Function) }, prepare: prepareRuntimeAssets, admit: planPreparedRuntimeFiles, rules: { path: expect.any(Function) } });
});
