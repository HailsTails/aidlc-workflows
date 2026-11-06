import { expect, test, mock } from "bun:test";
import { createRuntimeAssetSourceReader, createRuntimeAssetSourceOperations } from "./runtime-asset-sources.ts";
import type { AuthoredSourceInventory } from "./authored-source-inventory.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { createRuntimeAssetFixture, runtimeAssetBasis, runtimeAssetInventory } from "../../__tests__/runtime-asset-fixtures.ts";

test("preserves opaque asset bytes, authored placement and direct byte witnesses", async () => {
  const fixture = createRuntimeAssetFixture();
  const reader = createRuntimeAssetSourceReader({ operations: fixture.operations });
  expect(await reader.load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "ok", value: {
    basis: runtimeAssetBasis,
    assets: [
      { origin: { ...runtimeAssetBasis, path: "core/tools/data/ars-priors.json" }, relativePath: "ars-priors.json", bytes: new Uint8Array([255, 0, 13, 10]) },
      { origin: { ...runtimeAssetBasis, path: "core/tools/data/model-rates.json" }, relativePath: "model-rates.json", bytes: new Uint8Array([123, 125, 10]) },
      { origin: { ...runtimeAssetBasis, path: "core/tools/data/templates/.gitkeep" }, relativePath: "templates/.gitkeep", bytes: new Uint8Array([]) },
    ],
    inputs: [
      { path: "core/tools/data/ars-priors.json", sha256: "opaque-hash" },
      { path: "core/tools/data/model-rates.json", sha256: "rates-hash" },
      { path: "core/tools/data/templates/.gitkeep", sha256: "empty-hash" },
    ],
  } });
  expect(fixture.operations.inventory.mock.calls).toEqual([[{ sourceRoot: "/source" }]]);
  expect(fixture.operations.digest.mock.calls).toEqual([[{ bytes: new Uint8Array([255, 0, 13, 10]) }], [{ bytes: new Uint8Array([123, 125, 10]) }], [{ bytes: new Uint8Array([]) }]]);
});

test.each([
  { label: "non-inventory", inventory: null },
  { label: "non-byte asset", inventory: [{ path: "core/tools/data/ars-priors.json", bytes: "{}" }] },
  { label: "unsupported asset", inventory: [{ path: "core/tools/data/unowned.json", bytes: new Uint8Array([]) }] },
  { label: "extra asset beside complete inventory", inventory: [...runtimeAssetInventory, { path: "core/tools/data/unowned.json", bytes: new Uint8Array([]) }] },
  { label: "traversal alias", inventory: [{ path: "core/tools/data/templates/../ars-priors.json", bytes: new Uint8Array([]) }] },
])("refuses malformed or unsupported inventory without discarding entries: $label", async ({ inventory }) => {
  const fixture = createRuntimeAssetFixture();
  fixture.operations.inventory.mockResolvedValue({ status: "ok", value: inventory });
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "runtime-asset-sources", detail: "read only the three supported authored runtime asset paths as bytes; unsupported entries were not discarded" }] });
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test.each([{ label: "empty", inventory: [] }, { label: "one missing", inventory: [runtimeAssetInventory[0], runtimeAssetInventory[1]] }])("refuses incomplete inventory: $label", async ({ inventory }) => {
  const fixture = createRuntimeAssetFixture();
  fixture.operations.inventory.mockResolvedValue({ status: "ok", value: inventory });
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "runtime-asset-sources", detail: "all three authored runtime assets are required before projection" }] });
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test("duplicate paths cannot satisfy complete inventory cardinality", async () => {
  const fixture = createRuntimeAssetFixture();
  fixture.operations.inventory.mockResolvedValue({ status: "ok", value: [runtimeAssetInventory[0], runtimeAssetInventory[0], runtimeAssetInventory[2]] });
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "runtime-asset-sources", detail: "authored runtime asset paths must occur exactly once" }] });
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

const invalidAssetBases: SourceBasis[] = [
  { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" },
  { source: { kind: "core", id: "framework" }, pin: "short" },
];
test.each(invalidAssetBases)("refuses foreign or unpinned basis before inventory", async (basis) => {
  const fixture = createRuntimeAssetFixture();
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "runtime-asset-sources", detail: "declare the framework source and full source pin before reading authored runtime assets" }] });
  expect(fixture.operations.inventory.mock.calls).toEqual([]);
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test("digest capability failure returns bounded data", async () => {
  const fixture = createRuntimeAssetFixture();
  const revoked = Proxy.revocable(fixture.operations.digest, {});
  revoked.revoke();
  expect(await createRuntimeAssetSourceReader({ operations: { inventory: fixture.operations.inventory, digest: revoked.proxy } }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset digest unavailable" }] });
});

test("inventory operational failure returns bounded data", async () => {
  const fixture = createRuntimeAssetFixture();
  fixture.operations.inventory.mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset inventory unavailable" }] });
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset inventory unavailable" }] });
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test("reader propagates an admitted inventory refusal without parsing or replacing it", async () => {
  const fixture = createRuntimeAssetFixture();
  fixture.operations.inventory.mockResolvedValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-observation", detail: "source observation changed before inventory completed" }] });
  expect(await createRuntimeAssetSourceReader({ operations: fixture.operations }).load({ sourceRoot: "/source", basis: runtimeAssetBasis })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-observation", detail: "source observation changed before inventory completed" }] });
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test("production bridge preserves raw inventory and requests exactly the authored byte directory", async () => {
  const fixture = createRuntimeAssetFixture();
  const read = mock<AuthoredSourceInventory["read"]>().mockResolvedValue(runtimeAssetInventory);
  const operations = createRuntimeAssetSourceOperations({ inventory: { read }, digest: fixture.operations.digest });
  expect(await operations.inventory({ sourceRoot: "/source" })).toEqual({ status: "ok", value: [
    { path: "core/tools/data/ars-priors.json", bytes: new Uint8Array([255, 0, 13, 10]) },
    { path: "core/tools/data/model-rates.json", bytes: new Uint8Array([123, 125, 10]) },
    { path: "core/tools/data/templates/.gitkeep", bytes: new Uint8Array([]) },
  ] });
  expect(read.mock.calls).toEqual([[{ sourceRoot: "/source", directory: "core/tools/data", encoding: "bytes" }]]);
  expect(operations.digest).toBe(fixture.operations.digest);
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});

test("production bridge translates raw storage rejection into bounded data", async () => {
  const fixture = createRuntimeAssetFixture();
  const read = mock<AuthoredSourceInventory["read"]>().mockRejectedValue(new Error("private source path"));
  const operations = createRuntimeAssetSourceOperations({ inventory: { read }, digest: fixture.operations.digest });
  expect(await operations.inventory({ sourceRoot: "/source" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset inventory unavailable" }] });
  expect(read.mock.calls).toEqual([[{ sourceRoot: "/source", directory: "core/tools/data", encoding: "bytes" }]]);
  expect(fixture.operations.digest.mock.calls).toEqual([]);
});
