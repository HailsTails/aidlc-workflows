import { expect, test } from "bun:test";
import { preparePluginAuthoringArtifacts, projectPluginTargets } from "./plugin-authoring-data.ts";
import type { HarnessManifest } from "./manifest-types.ts";
import type { PluginTargetKind } from "../core/tools/aidlc-plugin-emit.ts";

const manifest: HarnessManifest = { name: "declared-name", productName: "Fixture", configNextStep: "Next", harnessDir: ".engine", rootIntegrations: [], tierFlavor: "claude", coreDirs: [], harnessFiles: [], rulesRename: null, emit: null };

test("discovery identity remains the table key while Native default target fields retain declaration identity", () => {
  expect(projectPluginTargets({ declarations: [{ name: "discovery-alias", manifest }] })).toEqual({ "discovery-alias": { harnessName: "declared-name", manifestDir: ".engine-plugin", marketplaceDir: ".engine-plugin", hostCatalogue: true, harnessLeaf: ".engine", kind: "store", installRoots: [".engine", "aidlc"] } });
});

const catalogueControls: { readonly kind: PluginTargetKind; readonly expected: true | false }[] = [
  { kind: "store", expected: true }, { kind: "cursor", expected: true }, { kind: "kiro", expected: false }, { kind: "kiro-ide", expected: false },
];
test.each(catalogueControls)("retains Native default catalogue behavior for $kind", ({ kind, expected }) => {
  expect(projectPluginTargets({ declarations: [{ name: "row", manifest: { ...manifest, plugin: { manifestDir: ".plugins", kind } } }] })).toEqual({ row: { harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: ".plugins", hostCatalogue: expected, harnessLeaf: ".engine", kind, installRoots: [".engine", "aidlc"] } });
});

test("explicit catalogue defaults and all declared project roots retain their Native ownership meaning", () => {
  expect(projectPluginTargets({ declarations: [{ name: "row", manifest: { ...manifest,
    harnessFiles: [{ src: "root", dst: ".github/instructions.md", projectRoot: true }, { src: "private", dst: "unowned/tool.ts" }],
    onboarding: { dst: "AGENTS.md", projectRoot: true, fills: { invoke: "/aidlc", slots: {} } },
    orchestratorSkillPath: ".agents/skills/aidlc/SKILL.md",
    plugin: { manifestDir: ".custom", marketplaceDir: "catalogue", hostCatalogue: false, kind: "cursor", installRoots: ["helpers\\scripts", ".github/hooks", ""] },
  } }] })).toEqual({ row: { harnessName: "declared-name", manifestDir: ".custom", marketplaceDir: "catalogue", hostCatalogue: false, harnessLeaf: ".engine", kind: "cursor", installRoots: [".agents", ".engine", ".github", "AGENTS.md", "aidlc", "helpers"] } });
});

test("an explicit true catalogue setting on folder-drop delivery is retained", () => {
  expect(projectPluginTargets({ declarations: [{ name: "row", manifest: { ...manifest, plugin: { manifestDir: ".plugins", hostCatalogue: true, kind: "kiro" } } }] })).toEqual({ row: { harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: ".plugins", hostCatalogue: true, harnessLeaf: ".engine", kind: "kiro", installRoots: [".engine", "aidlc"] } });
});

test("empty declaration inventory stays empty", () => {
  expect(projectPluginTargets({ declarations: [] })).toEqual({});
});

test("prepares raw recursive templates and independently encoded sorted context without losing duplicate stems", () => {
  const bytes = new Uint8Array([255, 0, 13, 10]);
  const agentNames = ["z-agent.md", "notes.md", "a-agent.md", "z-agent.md", "ignored-agent.mdx"];
  const stageNames = ["zeta.md", "ignored.json", "alpha.md"];
  expect(preparePluginAuthoringArtifacts({ targets: {}, agentNames, stageNames, templates: [{ file: "nested/source.custom", bytes }] })).toEqual({ kind: "prepared", artifacts: [
    { file: "tools/data/plugin-hooks-template/nested/source.custom", bytes: new Uint8Array([255, 0, 13, 10]) },
    { file: "tools/data/plugin-targets.json", bytes: new Uint8Array([123, 125, 10]) },
    { file: "tools/data/plugin-authoring-context.json", bytes: new Uint8Array([123,10,32,32,34,97,103,101,110,116,115,34,58,32,91,10,32,32,32,32,34,97,45,97,103,101,110,116,34,44,10,32,32,32,32,34,122,45,97,103,101,110,116,34,44,10,32,32,32,32,34,122,45,97,103,101,110,116,34,10,32,32,93,44,10,32,32,34,115,116,97,103,101,115,34,58,32,91,10,32,32,32,32,34,97,108,112,104,97,34,44,10,32,32,32,32,34,122,101,116,97,34,10,32,32,93,10,125,10]) },
  ] });
  expect(agentNames).toEqual(["z-agent.md", "notes.md", "a-agent.md", "z-agent.md", "ignored-agent.mdx"]);
  expect(stageNames).toEqual(["zeta.md", "ignored.json", "alpha.md"]);
  expect(bytes).toEqual(new Uint8Array([255, 0, 13, 10]));
});

test.each(["../compose.ts", "/compose.ts", "nested/../compose.ts", "nested\\compose.ts", "C:compose.ts", "", "nested//compose.ts"])("unsafe template destination refuses: %s", (file) => {
  expect(preparePluginAuthoringArtifacts({ targets: {}, agentNames: [], stageNames: [], templates: [{ file, bytes: new Uint8Array([]) }] })).toEqual({ kind: "refused", message: "plugin authoring templates require safe relative file paths" });
});

test("duplicate template paths cannot silently overwrite one another", () => {
  expect(preparePluginAuthoringArtifacts({ targets: {}, agentNames: [], stageNames: [], templates: [{ file: "compose.ts", bytes: new Uint8Array([1]) }, { file: "compose.ts", bytes: new Uint8Array([2]) }] })).toEqual({ kind: "refused", message: "plugin authoring template paths must be unique" });
});

test("empty template inventory preserves the two generated metadata products", () => {
  expect(preparePluginAuthoringArtifacts({ targets: {}, agentNames: [], stageNames: [], templates: [] })).toEqual({ kind: "prepared", artifacts: [
    { file: "tools/data/plugin-targets.json", bytes: new Uint8Array([123, 125, 10]) },
    { file: "tools/data/plugin-authoring-context.json", bytes: new Uint8Array([123,10,32,32,34,97,103,101,110,116,115,34,58,32,91,93,44,10,32,32,34,115,116,97,103,101,115,34,58,32,91,93,10,125,10]) },
  ] });
});

test("target JSON retains every supplied field, order, indentation and final newline", () => {
  expect(preparePluginAuthoringArtifacts({ targets: { row: { harnessName: "x", manifestDir: "m", marketplaceDir: "p", hostCatalogue: false, harnessLeaf: ".x", kind: "kiro", installRoots: [".x"] } }, agentNames: [], stageNames: [], templates: [] })).toEqual({ kind: "prepared", artifacts: [
    { file: "tools/data/plugin-targets.json", bytes: new Uint8Array([123,10,32,32,34,114,111,119,34,58,32,123,10,32,32,32,32,34,104,97,114,110,101,115,115,78,97,109,101,34,58,32,34,120,34,44,10,32,32,32,32,34,109,97,110,105,102,101,115,116,68,105,114,34,58,32,34,109,34,44,10,32,32,32,32,34,109,97,114,107,101,116,112,108,97,99,101,68,105,114,34,58,32,34,112,34,44,10,32,32,32,32,34,104,111,115,116,67,97,116,97,108,111,103,117,101,34,58,32,102,97,108,115,101,44,10,32,32,32,32,34,104,97,114,110,101,115,115,76,101,97,102,34,58,32,34,46,120,34,44,10,32,32,32,32,34,107,105,110,100,34,58,32,34,107,105,114,111,34,44,10,32,32,32,32,34,105,110,115,116,97,108,108,82,111,111,116,115,34,58,32,91,10,32,32,32,32,32,32,34,46,120,34,10,32,32,32,32,93,10,32,32,125,10,125,10]) },
    { file: "tools/data/plugin-authoring-context.json", bytes: new Uint8Array([123,10,32,32,34,97,103,101,110,116,115,34,58,32,91,93,44,10,32,32,34,115,116,97,103,101,115,34,58,32,91,93,10,125,10]) },
  ] });
});
