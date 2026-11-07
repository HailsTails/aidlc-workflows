import { expect, test } from "bun:test";
import { sortPluginAuthoringNames, projectPluginTarget } from "./plugin-authoring-catalogue.ts";
import type { PluginTargetDeclaration } from "./plugin-authoring-catalogue.ts";
type PluginTargetKind = NonNullable<PluginTargetDeclaration["plugin"]>["kind"];

const manifest = { name: "declared-name", harnessDir: ".engine" };
const installRoots = new Set(["aidlc", ".engine"]);

test("target defaults retain declaration identity and sort Native-observed install roots", () => {
  expect(projectPluginTarget({ manifest, installRoots })).toEqual({
    harnessName: "declared-name", manifestDir: ".engine-plugin", marketplaceDir: ".engine-plugin",
    hostCatalogue: true, harnessLeaf: ".engine", kind: "store", installRoots: [".engine", "aidlc"],
  });
});

const kindCases: readonly { kind: PluginTargetKind; hostCatalogue: true | false }[] = [
  { kind: "store", hostCatalogue: true }, { kind: "cursor", hostCatalogue: true },
  { kind: "kiro", hostCatalogue: false }, { kind: "kiro-ide", hostCatalogue: false },
];

test.each([...kindCases])("catalogue default follows Native plugin delivery kind $kind", ({ kind, hostCatalogue }) => {
  expect(projectPluginTarget({ manifest: { ...manifest, plugin: { manifestDir: ".plugins", kind } }, installRoots })).toEqual({
    harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: ".plugins",
    hostCatalogue, harnessLeaf: ".engine", kind, installRoots: [".engine", "aidlc"],
  });
});

test("explicit false catalogue and marketplace override store defaults", () => {
  expect(projectPluginTarget({ manifest: { ...manifest, plugin: { manifestDir: ".plugins", marketplaceDir: "catalogue", hostCatalogue: false, kind: "store" } }, installRoots })).toEqual({
    harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: "catalogue",
    hostCatalogue: false, harnessLeaf: ".engine", kind: "store", installRoots: [".engine", "aidlc"],
  });
});

test("explicit true catalogue overrides folder-drop defaults", () => {
  expect(projectPluginTarget({ manifest: { ...manifest, plugin: { manifestDir: ".plugins", hostCatalogue: true, kind: "kiro" } }, installRoots })).toEqual({
    harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: ".plugins",
    hostCatalogue: true, harnessLeaf: ".engine", kind: "kiro", installRoots: [".engine", "aidlc"],
  });
});

test("empty authored strings retain Native nullish-default behavior", () => {
  expect(projectPluginTarget({ manifest: { name: "", harnessDir: "", plugin: { manifestDir: "", marketplaceDir: "", hostCatalogue: false, kind: "cursor" } }, installRoots: new Set(["", "aidlc"]) })).toEqual({
    harnessName: "", manifestDir: "", marketplaceDir: "", hostCatalogue: false,
    harnessLeaf: "", kind: "cursor", installRoots: ["", "aidlc"],
  });
});

test("unknown manifest fields are ignored while already-observed roots are preserved", () => {
  const extended = { ...manifest, privateBuildInput: "not-authoring", plugin: { manifestDir: ".plugins", kind: "store" as const, privatePluginInput: "not-authoring" } };
  expect(projectPluginTarget({ manifest: extended, installRoots: new Set(["z", "aidlc", ".engine", "../custom"]) })).toEqual({
    harnessName: "declared-name", manifestDir: ".plugins", marketplaceDir: ".plugins", hostCatalogue: true,
    harnessLeaf: ".engine", kind: "store", installRoots: ["../custom", ".engine", "aidlc", "z"],
  });
});

test("target projection creates a fresh object without mutating supplied declarations or roots", () => {
  expect(projectPluginTarget({ manifest, installRoots })).not.toBe(projectPluginTarget({ manifest, installRoots }));
  expect(manifest).toEqual({ name: "declared-name", harnessDir: ".engine" });
  expect(installRoots).toEqual(new Set(["aidlc", ".engine"]));
});

test("authoring context sorts Native-observed names and retains duplicate stems", () => {
  const agents = ["z-agent", "a-agent", "z-agent"];
  const stages = ["zeta", "alpha", "alpha", ".md"];
  expect(sortPluginAuthoringNames({ names: agents })).toEqual(["a-agent", "z-agent", "z-agent"]);
  expect(sortPluginAuthoringNames({ names: stages })).toEqual([".md", "alpha", "alpha", "zeta"]);
  expect(agents).toEqual(["z-agent", "a-agent", "z-agent"]);
  expect(stages).toEqual(["zeta", "alpha", "alpha", ".md"]);
});

test("authoring context preserves names without new filtering or admission", () => {
  expect(sortPluginAuthoringNames({ names: ["../custom-agent", "-agent", "custom\\agent-agent", "", "legacy.MD"] })).toEqual(["", "-agent", "../custom-agent", "custom\\agent-agent", "legacy.MD"]);
});

test("empty authoring context remains empty", () => {
  expect(sortPluginAuthoringNames({ names: [] })).toEqual([]);
});