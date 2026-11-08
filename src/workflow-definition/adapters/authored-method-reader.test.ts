import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { CapturedPluginFiles } from "../application/source-files.ts";
import { createMethodCompiler } from "../application/create-method-compiler.ts";
import { pluginId } from "../domain/identities.ts";
import type { CoreContent } from "../domain/method.ts";
import { createAuthoredMethodReader, createPluginSelectionSource } from "./authored-method-reader.ts";

const core: CoreContent = { stages: [], agents: [], scopes: [], memberships: [],
  freeformDefaults: [], sensors: [], rules: [], knowledge: [], hooks: [] };
const manifest = { name: "declared-name", version: "1", description: "A tool-only plugin",
  aidlc: { contributes: { tools: "tools/" } } };
const toolContent = { kind: "text" as const, text: "A captured tool payload" };
const capture: CapturedPluginFiles = { directory: "folder-name", manifest: {
  within: source(".aidlc-plugin/plugin.json"),
  content: { kind: "text", text: JSON.stringify(manifest) } }, files: [
  { within: source("tools/declared-name-doctor.ts"), content: toolContent },
] };
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test("the published reader preserves a declared identity separately from its directory", async () => {
  const reader = createAuthoredMethodReader({ core: { core, files: [] }, plugins: [capture], outliner });
  const authored = accept(await reader.readAuthored());
  const selection = createPluginSelectionSource({ kind: "every-installed" });
  const compiled = accept(createMethodCompiler(outliner).compile({ ...authored,
    selection: await selection.readSelection() }));
  expect(authored.pluginDirectories).toEqual([{ plugin: accept(pluginId("declared-name")),
    directory: "folder-name" }]);
  expect(compiled.installedPlugins).toEqual<readonly string[]>(["declared-name"]);
  expect(compiled.graph.nodes).toEqual([]);
  expect(authored.contributions[0]?.tools).toEqual({ scripts: [source("tools/declared-name-doctor.ts")],
    doctorCheck: source("tools/declared-name-doctor.ts"), commands: [] });
});

test("reserved directory ownership refuses before exposing a partial contribution list", async () => {
  const reader = createAuthoredMethodReader({ core: { core, files: [] }, outliner,
    plugins: [{ ...capture, directory: "aidlc-tools" }] });
  expect(await reader.readAuthored()).toEqual({ ok: false,
    refusal: [{ kind: "core-namespace-claimed", plugin: "aidlc-tools" }] });
});

test("an invalid command path is refused as manifest data instead of a thrown constructor", async () => {
  const invalid: CapturedPluginFiles = { ...capture, manifest: { ...capture.manifest,
    content: { kind: "text", text: JSON.stringify({ ...manifest,
      aidlc: { ...manifest.aidlc, commands: { report: {
        script: "tools/con.ts", description: "A non-portable command" } } } }) } } };
  const reader = createAuthoredMethodReader({ core: { core, files: [] }, plugins: [invalid], outliner });
  expect(await reader.readAuthored()).toEqual({ ok: false, refusal: [{ kind: "invalid-file",
    location: { kind: "plugin-manifest", plugin: "folder-name" },
    issues: ["aidlc.commands.report.script: Command script must be a portable source path."],
  }] });
});
