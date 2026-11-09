import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import type { CoreContent } from "../domain/method.ts";
import type { Contribution } from "../domain/contribution.ts";
import { pluginId } from "../domain/identities.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { methodSliceFixture } from "../fixtures/method.fixture.ts";
import type { MethodContentDecoder } from "./ports.ts";
import type { CompileMethod } from "./use-cases.ts";
import { loadPluginMethod } from "./load-authored-method.ts";

const core: CoreContent = { stages: [], agents: [], scopes: [], memberships: [], freeformDefaults: [],
  sensors: [], rules: [], knowledge: [], hooks: [] };
const contribution: Contribution = { plugin: accept(pluginId("metrics")), version: "1", description: "Metrics",
  dependsOn: [], rulesLevel: "team", content: core, overlays: [],
  tools: { scripts: [], doctorCheck: null, commands: [] } };

test("plugin loading compiles captured contributions once with repository selection", async () => {
  const reader = createInMemoryFileSystem({ files: {
    "file:///plugins/folder-name/.aidlc-plugin/plugin.json": "manifest snapshot",
  } });
  const decodeCore = mock<MethodContentDecoder["decodeCore"]>(async () => accepted({ core, files: [] }));
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>(async () =>
    accepted({ contribution, files: [] }));
  const compile = mock<CompileMethod["compile"]>(() => accepted(methodSliceFixture));
  expect(await loadPluginMethod({ core: { method: methodSliceFixture, authored: core, sources: [] },
    pluginsRoot: new URL("file:///plugins/"), reader, decoder: { decodeCore, decodeContribution },
    compiler: { compile } })).toEqual({ ok: true, value: { method: methodSliceFixture, plugins: [] } });
  expect(decodeCore).not.toHaveBeenCalled();
  expect(decodeContribution).toHaveBeenCalledTimes(1);
  expect(compile).toHaveBeenCalledTimes(1);
  expect(compile).toHaveBeenCalledWith({ core, contributions: [contribution],
    pins: [], saved: [], selection: { kind: "every-installed" } });
});

test("a plugin capture failure prevents decoding and compilation", async () => {
  const reader = createInMemoryFileSystem({ files: {}, faults: { "file:///plugins/": "permission-denied" } });
  const decodeCore = mock<MethodContentDecoder["decodeCore"]>(async () => accepted({ core, files: [] }));
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>(async () =>
    refused([{ kind: "core-namespace-claimed", plugin: "unused" }]));
  const compile = mock<CompileMethod["compile"]>(() => accepted(methodSliceFixture));
  expect(await loadPluginMethod({ core: { method: methodSliceFixture, authored: core, sources: [] },
    pluginsRoot: new URL("file:///plugins/"), reader, decoder: { decodeCore, decodeContribution },
    compiler: { compile } })).toEqual({ ok: false, refusal: [{ kind: "source-unreadable",
      location: { kind: "authored-tree", tree: "plugins", within: "" }, code: "permission-denied" }] });
  expect(decodeCore).not.toHaveBeenCalled();
  expect(decodeContribution).not.toHaveBeenCalled();
  expect(compile).not.toHaveBeenCalled();
});
