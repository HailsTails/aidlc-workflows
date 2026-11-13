import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { distribution, hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { createCopyEraHistory } from "./copy-era-history.ts";

const source = new URL("file:///fixture/copy-era-files.json");
const prior = { history: async () => accepted({ retiredFiles: [], priorIntegrations: [] }) };

test("the captured file supplies typed copy-era signatures and merges the existing history", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { [source.href]:
    '{"fixture":{".fixture/old.md":["sha256:0000000000000000000000000000000000000000000000000000000000000000"]}}' } });
  const history = createCopyEraHistory({ reader: fileSystem, source, prior: { history: async () => accepted({
    priorIntegrations: [], retiredFiles: [{ path: path(".fixture/old.md"), shippedHashes: [hash(
      "sha256:1111111111111111111111111111111111111111111111111111111111111111")] }],
  }) } });
  expect(await history.history(distribution("fixture"))).toEqual(accepted({ priorIntegrations: [], retiredFiles: [{
    path: path(".fixture/old.md"), shippedHashes: [hash(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000"), hash(
      "sha256:1111111111111111111111111111111111111111111111111111111111111111")],
  }] }));
});

test("one capture survives source mutation and an absent distribution contributes no files", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { [source.href]: '{"fixture":{}}' } });
  const readFile = mock(fileSystem.readFile);
  const history = createCopyEraHistory({ reader: { readFile }, source, prior });
  expect(await history.history(distribution("fixture"))).toEqual(accepted({ retiredFiles: [], priorIntegrations: [] }));
  await fileSystem.writeFile({ file: source, content: { kind: "text", text: "invalidated" } });
  expect(await history.history(distribution("other"))).toEqual(accepted({ retiredFiles: [], priorIntegrations: [] }));
  expect(readFile).toHaveBeenCalledTimes(1);
});

test("an unreadable required history source is a refusal naming the requested distribution", async () => {
  const history = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: {} }), source, prior });
  expect(await history.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history is unreadable: not-found." }));
});

test("malformed JSON is refused instead of producing an empty history", async () => {
  const history = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: { [source.href]: "{" } }), source, prior });
  expect(await history.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history is not valid JSON." }));
});

test("invalid historical paths and hashes refuse the entire source", async () => {
  const invalidPath = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: {
    [source.href]: '{"fixture":{"../outside":["bad"]}}',
  } }), source, prior });
  expect(await invalidPath.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history has an invalid path: ../outside." }));
  const invalidHash = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: {
    [source.href]: '{"fixture":{".fixture/a.md":["bad"]}}',
  } }), source, prior });
  expect(await invalidHash.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history has an invalid content hash at .fixture/a.md." }));
});

test("a prior history refusal stops before reading another source", async () => {
  const readFile = mock(createInMemoryFileSystem({ files: {} }).readFile);
  const history = createCopyEraHistory({ reader: { readFile }, source, prior: { history: async () =>
    refused({ kind: "unknown-distribution" as const, distribution: distribution("fixture") }) } });
  expect(await history.history(distribution("fixture"))).toEqual(refused({ kind: "unknown-distribution",
    distribution: distribution("fixture") }));
  expect(readFile).not.toHaveBeenCalled();
});

test("valid JSON with the wrong data shape is refused without partially admitting it", async () => {
  const history = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: { [source.href]:
    '{"fixture":{".fixture/a.md":[7]}}' } }), source, prior });
  expect(await history.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history is not a distribution-to-file hash map." }));
});

test("a captured UTF-8 BOM keeps the legacy JSON refusal instead of being silently stripped", async () => {
  const history = createCopyEraHistory({ reader: createInMemoryFileSystem({ files: { [source.href]:
    new Uint8Array([239, 187, 191, 123, 125]) } }), source, prior });
  expect(await history.history(distribution("fixture"))).toEqual(refused({ kind: "release-history-unreadable",
    distribution: distribution("fixture"), reason: "Copy-era history is not valid JSON." }));
});
