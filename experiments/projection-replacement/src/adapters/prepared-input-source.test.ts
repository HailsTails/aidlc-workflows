import { expect, mock, test } from "bun:test";
import { createPreparedInputDistributionSource } from "./prepared-input-source.ts";
import { distributionSeed, distributionLocation } from "../../__tests__/distribution-fixtures.ts";
import { preparedAssetDelivery, assetInputPreparation, assetDeliveryFile } from "../../__tests__/runtime-asset-delivery-fixtures.ts";
import { contextInputPreparation } from "../../__tests__/distribution-context-fixtures.ts";
import { runnerFailure } from "../../__tests__/runner-fixtures.ts";
test("typed prepared inputs share admission while retaining prior evidence", async () => {
  const seed = { ...distributionSeed, inputPreparations: [contextInputPreparation] }, source = { load: mock().mockResolvedValue({ status: "ok", value: seed }) }, preparer = { prepare: mock().mockResolvedValue({ status: "ok", value: preparedAssetDelivery }) };
  const admit = mock().mockReturnValue({ status: "ok", value: { additions: [assetDeliveryFile], unchanged: [] } }), rules = { path: mock().mockReturnValue("safe") };
  expect(await createPreparedInputDistributionSource({ source, mode: 0o640, preparer, admit, rules }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: { ...seed, files: [...seed.files, assetDeliveryFile], inputPreparations: [contextInputPreparation, assetInputPreparation] } });
  expect(source.load.mock.calls).toEqual([[{ location: distributionLocation, binding: distributionSeed.binding }]]);
  expect(preparer.prepare.mock.calls).toEqual([[{ sourceRoot: distributionLocation.sourceRoot, root: distributionLocation.root, basis: seed.basis, binding: seed.binding, invocation: seed.invocation, mode: 0o640 }]]);
  expect(admit.mock.calls).toEqual([[{ candidates: [assetDeliveryFile], inventory: seed, rules }]]);
});
test("base failure prevents any input preparation", async () => {
  const source = { load: mock().mockResolvedValue(runnerFailure) }, preparer = { prepare: mock() };
  expect(await createPreparedInputDistributionSource({ source, mode: 0o640, preparer }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(runnerFailure);
  expect(preparer.prepare).not.toHaveBeenCalled();
});
test("preparation failure never reaches byte admission", async () => {
  const source = { load: mock().mockResolvedValue({ status: "ok", value: distributionSeed }) }, preparer = { prepare: mock().mockResolvedValue(runnerFailure) }, admit = mock();
  expect(await createPreparedInputDistributionSource({ source, mode: 0o640, preparer, admit }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(runnerFailure);
  expect(admit).not.toHaveBeenCalled();
});
test("changed-owned admission fails without returning a successful subset", async () => {
  const source = { load: mock().mockResolvedValue({ status: "ok", value: distributionSeed }) }, preparer = { prepare: mock().mockResolvedValue({ status: "ok", value: preparedAssetDelivery }) }, admit = mock().mockReturnValue(runnerFailure);
  expect(await createPreparedInputDistributionSource({ source, mode: 0o640, preparer, admit }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual(runnerFailure);
});
test("already-present input uses only admitted additions and retains mode", async () => {
  const seed = { ...distributionSeed, files: [...distributionSeed.files, { ...assetDeliveryFile, mode: 0o666 }] }, source = { load: mock().mockResolvedValue({ status: "ok", value: seed }) }, preparer = { prepare: mock().mockResolvedValue({ status: "ok", value: preparedAssetDelivery }) }, admit = mock().mockReturnValue({ status: "ok", value: { additions: [], unchanged: [".claude/tools/data/model-rates.json"] } });
  expect(await createPreparedInputDistributionSource({ source, mode: 0o640, preparer, admit }).load({ location: distributionLocation, binding: seed.binding })).toEqual({ status: "ok", value: { ...seed, inputPreparations: [assetInputPreparation] } });
});
