import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { CapturedPluginFiles, MethodContentDecoder } from "./ports.ts";
import { pluginId } from "../domain/identities.ts";
import type { CoreContent } from "../domain/method.ts";
import type { Contribution } from "../domain/contribution.ts";
import { createAuthoredMethodReader, createPluginSelectionSource } from "./authored-method-reader.ts";

const core: CoreContent = { stages: [], agents: [], scopes: [], memberships: [],
  freeformDefaults: [], sensors: [], rules: [], knowledge: [], hooks: [] };
const capture: CapturedPluginFiles = { directory: "folder-name", manifest: {
  within: source(".aidlc-plugin/plugin.json"), content: { kind: "text", text: "captured manifest" } },
  files: [], methodFiles: { stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [] } };
const contribution: Contribution = { plugin: accept(pluginId("declared-name")), version: "1",
  description: "A plugin", dependsOn: [], rulesLevel: "project", content: core, overlays: [],
  tools: { scripts: [], doctorCheck: null, commands: [] } };

const decodeCore = mock<MethodContentDecoder["decodeCore"]>(async () => accepted({ core, files: [] }));

test("the reader retains the declared identity and captured directory without compiling", async () => {
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>(async () =>
    accepted({ contribution, files: [] }));
  const reader = createAuthoredMethodReader({ core: { core, files: [] }, plugins: [capture],
    decoder: { decodeCore, decodeContribution } });
  expect(accept(await reader.readAuthored())).toEqual<unknown>({ core, contributions: [contribution],
    plugins: [{ plugin: "declared-name", directory: "folder-name" }], saved: [], pins: [], files: [] });
  expect(decodeContribution).toHaveBeenCalledWith(capture);
  expect(decodeCore).not.toHaveBeenCalled();
});

test("all contribution failures retain capture order and suppress partial sources", async () => {
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>()
    .mockResolvedValueOnce(refused([{ kind: "core-namespace-claimed", plugin: "aidlc-tools" }]))
    .mockResolvedValueOnce(refused([{ kind: "invalid-file",
      location: { kind: "plugin-manifest", plugin: "second-folder" }, issues: ["invalid manifest"] }]));
  const reader = createAuthoredMethodReader({ core: { core, files: [] },
    plugins: [capture, { ...capture, directory: "second-folder" }],
    decoder: { decodeCore, decodeContribution } });
  expect(await reader.readAuthored()).toEqual<unknown>({ ok: false, refusal: [
    { kind: "core-namespace-claimed", plugin: "aidlc-tools" },
    { kind: "invalid-file", location: { kind: "plugin-manifest", plugin: "second-folder" },
      issues: ["invalid manifest"] },
  ] });
  expect(decodeContribution).toHaveBeenCalledTimes(2);
});

test("repository build selection remains every installed contribution", async () => {
  expect(await createPluginSelectionSource({ kind: "every-installed" }).readSelection())
    .toEqual<unknown>({ kind: "every-installed" });
});
