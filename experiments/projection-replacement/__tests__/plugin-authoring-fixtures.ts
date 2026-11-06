import { mock, type Mock } from "bun:test";
import type { RuntimeInputRequest } from "../src/domain/runtime-inputs.ts";
import type { SourcePluginAuthoringOperations } from "../src/adapters/source-plugin-authoring.ts";

export const pluginAuthoringRequest: RuntimeInputRequest = { sourceRoot: "relative-source", root: "private-runtime", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" }, binding: { harness: "claude", directory: ".claude" }, mode: 0o640 };
export const pluginAuthoringHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const pluginAuthoringInputs = [
  { path: "core/agents/aidlc-note-agent.md", sha256: pluginAuthoringHash },
  { path: "core/aidlc-common/stages/inception/note.md", sha256: pluginAuthoringHash },
  { path: "harness/claude/manifest.ts", sha256: pluginAuthoringHash },
  { path: "harness/codex/manifest.ts", sha256: pluginAuthoringHash },
  { path: "scripts/manifest-types.ts", sha256: pluginAuthoringHash },
  { path: "scripts/plugin-authoring-data.ts", sha256: pluginAuthoringHash },
  { path: "scripts/plugin-hooks-template/aidlc-plugin-compose.ts", sha256: pluginAuthoringHash },
  { path: "scripts/plugin-hooks-template/compose.ts", sha256: pluginAuthoringHash },
];
export const pluginAuthoringFiles = [
  { file: "tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", bytes: [99, 111, 109, 112, 111, 115, 101] },
  { file: "tools/data/plugin-hooks-template/compose.ts", bytes: [0, 255, 13, 10, 123, 123, 73, 78, 86, 79, 75, 69, 125, 125] },
  { file: "tools/data/plugin-targets.json", bytes: [123, 125, 10] },
  { file: "tools/data/plugin-authoring-context.json", bytes: [123, 125, 13, 10] },
];
export const pluginAuthoringWire = { status: "ok", files: pluginAuthoringFiles, inputs: pluginAuthoringInputs };
export type PluginAuthoringFixture = { readonly operations: { readonly [Key in keyof SourcePluginAuthoringOperations]: Mock<SourcePluginAuthoringOperations[Key]> } };
export const createPluginAuthoringFixture = ({ wire = pluginAuthoringWire }: { readonly wire?: unknown } = {}): PluginAuthoringFixture => ({ operations: {
  paths: mock<SourcePluginAuthoringOperations["paths"]>().mockReturnValue({ sourceRoot: "/source", root: "/runtime" }),
  environment: mock<SourcePluginAuthoringOperations["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["API_KEY", "private"], ["NODE_OPTIONS", "foreign"], ["AIDLC_PLUGIN_ROOT", "foreign"]])),
  spawn: mock<SourcePluginAuthoringOperations["spawn"]>().mockReturnValue({ exitCode: 0, stdout: JSON.stringify(wire), stderr: "", error: null }),
} });
