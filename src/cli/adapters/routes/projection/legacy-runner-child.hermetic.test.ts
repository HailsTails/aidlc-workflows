import { expect, mock, test } from "bun:test";
import { accept } from "../../../../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../../../../kernel/fixtures/file-system.fake.ts";
import { renderFrozenCommandSet, duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments }
  from "../../../../projection/core-root.ts";
import { frozenGeneratorFailure } from "../../../../projection/fixtures/frozen-command-generator.fake.ts";
import { createFrozenCommandGenerator, runChild } from "./legacy-runner-child.ts";

const rawGenerator = {
  runnableStages: () => [], discoverScopes: () => ({}), defaultScopeBatch: () => [],
  renderStageRunner: () => "name: unused\n", renderRunner: () => "name: unused\n",
  renderInitRunner: () => "---\nname: aidlc-init\n---\nInit\n",
  renderComposeRunner: () => "---\nname: aidlc-compose\n---\nCompose\n",
  regenerateRunnerSurfaces: () => undefined,
};
const plan = { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments };
const input = { module: "file:///module.ts", output: "file:///output/", stages: [], scopes: [] };

test("the real zod bridge delays discovery, keeps the discovery metadata and retains full stage objects in closures", () => {
  const stageToken = { marker: "stage-one" };
  const scopeToken = { marker: "scope-one" };
  const first = { slug: "stage", metadata: stageToken };
  const scopes = { feature: { description: "Feature", metadata: scopeToken } };
  const runnableStages = mock(() => [first]);
  const discoverScopes = mock(() => scopes);
  const defaultScopeBatch = mock<(discovered: typeof scopes) => string[]>().mockReturnValue(["feature"]);
  const renderStageRunner = mock<(stage: typeof first) => string>().mockReturnValue("name: stage-native\nRendered\n");
  const generator = accept(createFrozenCommandGenerator({ ...rawGenerator,
    runnableStages, discoverScopes, defaultScopeBatch, renderStageRunner }));
  expect(runnableStages).not.toHaveBeenCalled();
  expect(discoverScopes).not.toHaveBeenCalled();
  expect(defaultScopeBatch).not.toHaveBeenCalled();
  const discovery = generator.discover();
  expect(runnableStages.mock.invocationCallOrder[0]).toBeLessThan(discoverScopes.mock.invocationCallOrder[0] ?? -1);
  expect(discoverScopes.mock.invocationCallOrder[0]).toBeLessThan(defaultScopeBatch.mock.invocationCallOrder[0] ?? -1);
  expect(runnableStages).toHaveBeenCalledTimes(1);
  expect(discoverScopes).toHaveBeenCalledTimes(1);
  expect(defaultScopeBatch).toHaveBeenCalledTimes(1);
  expect(defaultScopeBatch).toHaveBeenCalledWith(scopes);
  expect(defaultScopeBatch.mock.calls[0]?.[0].feature.metadata).toBe(scopeToken);
  expect(discovery.scopes["feature"]).toEqual(scopes.feature);
  expect(discovery.selected).toEqual(["feature"]);
  expect(discovery.stages[0]?.render()).toBe("name: stage-native\nRendered\n");
  expect(renderStageRunner).toHaveBeenCalledWith(first);
  expect(renderStageRunner.mock.calls[0]?.[0].metadata).toBe(stageToken);
});

test("the real child composes admission, Projection decisions and wire encoding of exact raw companion bytes", async () => {
  const output = createInMemoryFileSystem({ files: {
    "file:///output/skills/aidlc-init/SKILL.md": "captured init",
    "file:///output/skills/aidlc-init/asset.bin": new Uint8Array([0, 255, 195, 40]),
    "file:///output/skills/aidlc-compose/SKILL.md": "captured compose",
  } });
  expect(await runChild({ raw: input, output, plan, render: renderFrozenCommandSet,
    load: async () => rawGenerator })).toEqual({ failure: null, entries: [
    { subject: { concept: "orchestrator-skill", name: "aidlc-init" }, reason: null, files: [
      { nativeName: "aidlc-init", within: "SKILL.md", mode: "regular",
        content: { kind: "text", text: "---\nname: aidlc-init\n---\nInit\n" } },
      { nativeName: "aidlc-init", within: "asset.bin", mode: "regular",
        content: { kind: "bytes", bytes: [0, 255, 195, 40] } },
    ] },
    { subject: { concept: "orchestrator-skill", name: "aidlc-compose" }, reason: null, files: [
      { nativeName: "aidlc-compose", within: "SKILL.md", mode: "regular",
        content: { kind: "text", text: "---\nname: aidlc-compose\n---\nCompose\n" } },
    ] },
  ] });
});

test("module, discovery and regeneration exceptions retain exact top-level edge framing", async () => {
  const output = createInMemoryFileSystem({ files: {} });
  expect(await runChild({ raw: input, output, plan, render: renderFrozenCommandSet,
    load: async () => frozenGeneratorFailure(new Error("exact module error")) }))
    .toEqual({ entries: [], failure: "exact module error" });
  expect(await runChild({ raw: input, output, plan, render: renderFrozenCommandSet,
    load: async () => ({ ...rawGenerator, discoverScopes: () => frozenGeneratorFailure(new Error("exact discovery error")) }) }))
    .toEqual({ entries: [], failure: "exact discovery error" });
  expect(await runChild({ raw: input, output, plan, render: renderFrozenCommandSet,
    load: async () => ({ ...rawGenerator, regenerateRunnerSurfaces: () => frozenGeneratorFailure(new Error("exact regenerate error")) }) }))
    .toEqual({ entries: [], failure: "exact regenerate error" });
});

test("the edge calls its injected application once and performs wire conversion after that result", async () => {
  const output = createInMemoryFileSystem({ files: {} });
  const render = mock<typeof renderFrozenCommandSet>().mockResolvedValue({ failure: null, entries: [{
    subject: { concept: "stage-command", name: "stage" }, reason: null, files: [{
      nativeName: "stage-native", within: "asset.bin", mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255]) },
    }],
  }] });
  expect(await runChild({ raw: input, output, plan, render, load: async () => rawGenerator }))
    .toEqual({ failure: null, entries: [{ subject: { concept: "stage-command", name: "stage" }, reason: null,
      files: [{ nativeName: "stage-native", within: "asset.bin", mode: "regular",
        content: { kind: "bytes", bytes: [0, 255] } }] }] });
  expect(render).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledWith({ generator: expect.any(Object), stages: [], scopes: [],
    folder: new URL("file:///output/"), output, plan });
});
