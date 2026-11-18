import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { readEveryEntry } from "../../kernel/file-system-port.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { PluginAuthoringCapture } from "./ports/plugin-authoring.ts";
import { createPluginAuthoringEnrichment } from "./enrich-plugin-authoring.ts";

const identity = host({ name: "sample", directory: ".sample" });
const alpha = host({ name: "alpha", directory: ".alpha" });
const alphaLast = host({ name: "alpha", directory: ".alpha-last" });
const zeta = host({ name: "zeta", directory: ".zeta" });
const target = { format: "test", manifestDir: ".test-plugin", marketplaceDir: ".test-marketplace",
  catalogue: "none" as const, installRoots: [] };
const templates = [{ path: source("nested/template.bin"),
  content: { kind: "bytes" as const, bytes: new Uint8Array([0, 255, 13, 10]) } }];
const folder = new URL("file:///templates/");
const request = { projection: { host: identity, files: [], findings: [] }, method: methodSliceFixture,
  directory: path(".sample") };
type TargetReader = PluginAuthoringCapture["targets"][number]["read"];
const fixture = () => {
  const readTree = mock<PluginAuthoringCapture["templates"]["reader"]["readTree"]>()
    .mockResolvedValue(accepted({ files: templates, unreadable: [] }));
  const first = mock<TargetReader>().mockReturnValue(accepted({ ...target, format: "alpha-first" }));
  const last = mock<TargetReader>().mockReturnValue(accepted({ ...target, format: "alpha-last" }));
  const final = mock<TargetReader>().mockReturnValue(accepted({ ...target, format: "zeta" }));
  const ports: PluginAuthoringCapture = { templates: { folder, reader: { readTree } }, targets: [
    { host: zeta, read: final }, { host: alpha, read: first }, { host: alphaLast, read: last },
  ] };
  return { readTree, first, last, final, ports, enrich: createPluginAuthoringEnrichment(ports) };
};

test("targets sort with stable duplicate order and every reader is retained before the existing table serialization", async () => {
  const current = fixture();
  const enriched = accept(await current.enrich(request));
  expect(current.first).toHaveBeenCalledTimes(1);
  expect(current.last).toHaveBeenCalledTimes(1);
  expect(current.final).toHaveBeenCalledTimes(1);
  expect(current.first.mock.invocationCallOrder[0]).toBeLessThan(current.last.mock.invocationCallOrder[0] ?? -1);
  expect(current.last.mock.invocationCallOrder[0]).toBeLessThan(current.final.mock.invocationCallOrder[0] ?? -1);
  expect(enriched.files).toContainEqual({ path: path(".sample/tools/data/plugin-targets.json"), mode: "regular",
    origin: { kind: "runtime-data", name: "plugin-targets" }, content: { kind: "text", text:
      '{\n  "alpha": {\n    "harnessName": "alpha",\n    "manifestDir": ".test-plugin",\n    "marketplaceDir": ".test-marketplace",\n    "hostCatalogue": false,\n    "harnessLeaf": ".alpha-last",\n    "kind": "alpha-last",\n    "installRoots": []\n  },\n  "zeta": {\n    "harnessName": "zeta",\n    "manifestDir": ".test-plugin",\n    "marketplaceDir": ".test-marketplace",\n    "hostCatalogue": false,\n    "harnessLeaf": ".zeta",\n    "kind": "zeta",\n    "installRoots": []\n  }\n}\n' } });
});

test("one capture keeps literal binary template bytes and target values across repeated enrichment", async () => {
  const current = fixture();
  const first = accept(await current.enrich(request));
  current.readTree.mockResolvedValue(accepted({ files: [], unreadable: [] }));
  current.last.mockReturnValue(accepted({ ...target, format: "changed after capture" }));
  const second = accept(await current.enrich(request));
  expect(second).toEqual(first);
  expect(second.files).toContainEqual({ path: path(".sample/tools/data/plugin-hooks-template/nested/template.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 13, 10]) }, mode: "regular",
    origin: { kind: "neutral", source: source("scripts/plugin-hooks-template/nested/template.bin") } });
  expect(current.readTree).toHaveBeenCalledTimes(1);
  expect(current.readTree).toHaveBeenCalledWith({ folder, select: readEveryEntry });
  expect(current.first).toHaveBeenCalledTimes(1);
  expect(current.last).toHaveBeenCalledTimes(1);
  expect(current.final).toHaveBeenCalledTimes(1);
});

test("template failure precedes all target admissions and remains cached", async () => {
  const current = fixture();
  current.readTree.mockResolvedValue(refused({ kind: "unreadable", code: "permission-denied" }));
  const first = await current.enrich(request);
  expect(first).toEqual(refused([{ kind: "plugin-hook-template-unreadable", within: "", code: "permission-denied" }]));
  expect(await current.enrich(request)).toBe(first);
  expect(current.readTree).toHaveBeenCalledTimes(1);
  expect(current.first).not.toHaveBeenCalled();
  expect(current.last).not.toHaveBeenCalled();
  expect(current.final).not.toHaveBeenCalled();
});

test("unreadable template records retain their exact input order before any target call", async () => {
  const current = fixture();
  current.readTree.mockResolvedValue(accepted({ files: [], unreadable: [
    { within: "z.bin", code: "not-found" }, { within: "a.bin", code: "permission-denied" },
  ] }));
  expect(await current.enrich(request)).toEqual(refused([
    { kind: "plugin-hook-template-unreadable", within: "z.bin", code: "not-found" },
    { kind: "plugin-hook-template-unreadable", within: "a.bin", code: "permission-denied" },
  ]));
  expect(current.first).not.toHaveBeenCalled();
});

test("all target failures aggregate in sorted stable order and the refused capture is reused", async () => {
  const current = fixture();
  current.first.mockReturnValue(refused([{ kind: "invalid-path", base: "project", raw: "../alpha-first" }]));
  current.last.mockReturnValue(refused([{ kind: "unknown-harness", harness: "alpha-last" }]));
  current.final.mockReturnValue(refused([{ kind: "invalid-path", base: "project", raw: "../zeta" }]));
  const first = await current.enrich(request);
  expect(first).toEqual(refused([
    { kind: "invalid-path", base: "project", raw: "../alpha-first" },
    { kind: "unknown-harness", harness: "alpha-last" },
    { kind: "invalid-path", base: "project", raw: "../zeta" },
  ]));
  expect(await current.enrich(request)).toBe(first);
  expect(current.first).toHaveBeenCalledTimes(1);
  expect(current.last).toHaveBeenCalledTimes(1);
  expect(current.final).toHaveBeenCalledTimes(1);
});

test("authoring path collision preserves original source then generated origin order", async () => {
  const current = fixture();
  expect(await current.enrich({ ...request, projection: { ...request.projection, files: [{
    path: path(".sample/tools/data/plugin-targets.json"), mode: "regular", content: { kind: "text", text: "host-owned" },
    origin: { kind: "rendered", concept: "host-data", name: "existing" },
  }] } })).toEqual(refused([{ kind: "path-collision", path: path(".sample/tools/data/plugin-targets.json"),
    origins: [{ kind: "rendered", concept: "host-data", name: "existing" }, { kind: "runtime-data", name: "plugin-targets" }] }]));
});

test("a separate build captures fresh inputs instead of sharing another operation's target cache", async () => {
  const current = fixture();
  await current.enrich(request);
  current.last.mockReturnValue(accepted({ ...target, format: "fresh build" }));
  const next = createPluginAuthoringEnrichment(current.ports);
  expect(accept(await next(request)).files).toContainEqual(expect.objectContaining({
    path: path(".sample/tools/data/plugin-targets.json"), content: { kind: "text", text: expect.stringContaining('"kind": "fresh build"') },
  }));
  expect(current.readTree).toHaveBeenCalledTimes(2);
  expect(current.last).toHaveBeenCalledTimes(2);
});

test("unexpected template exceptions preserve identity and their cached failed promise", async () => {
  const current = fixture();
  const failure = new Error("exact template reader exception");
  current.readTree.mockRejectedValue(failure);
  await expect(current.enrich(request)).rejects.toBe(failure);
  await expect(current.enrich(request)).rejects.toBe(failure);
  expect(current.readTree).toHaveBeenCalledTimes(1);
  expect(current.first).not.toHaveBeenCalled();
});
