import { expect, test } from "bun:test";
import { createSourcePluginAuthoringOperations, createSourcePluginAuthoringPreparer } from "./source-plugin-authoring.ts";
import { createPluginAuthoringFixture, pluginAuthoringRequest, pluginAuthoringWire, pluginAuthoringFiles, pluginAuthoringInputs, pluginAuthoringHash } from "../../__tests__/plugin-authoring-fixtures.ts";

test("preserves four Native authoring products including binary and unexpanded template bytes", async () => {
  const fixture = createPluginAuthoringFixture();
  expect(await createSourcePluginAuthoringPreparer({ binary: "/bun", operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "ok", value: {
    files: [
      { path: ".claude/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", mode: 0o640, bytes: new Uint8Array([99, 111, 109, 112, 111, 115, 101]) },
      { path: ".claude/tools/data/plugin-hooks-template/compose.ts", mode: 0o640, bytes: new Uint8Array([0, 255, 13, 10, 123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      { path: ".claude/tools/data/plugin-targets.json", mode: 0o640, bytes: new Uint8Array([123, 125, 10]) },
      { path: ".claude/tools/data/plugin-authoring-context.json", mode: 0o640, bytes: new Uint8Array([123, 125, 13, 10]) },
    ], preparation: { kind: "plugin-authoring", paths: [".claude/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", ".claude/tools/data/plugin-hooks-template/compose.ts", ".claude/tools/data/plugin-targets.json", ".claude/tools/data/plugin-authoring-context.json"], inputs: pluginAuthoringInputs },
  } });
  expect(fixture.operations.paths.mock.calls).toEqual([[pluginAuthoringRequest]]);
  expect(fixture.operations.environment.mock.calls).toEqual([[]]);
  expect(fixture.operations.spawn.mock.calls).toEqual([[{ binary: "/bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/runtime", input: '{"sourceRoot":"/source"}', env: {
    ["PATH"]: "/bin", ["HOME"]: "/runtime/.source-plugin-authoring-home", ["USERPROFILE"]: "/runtime/.source-plugin-authoring-home", ["APPDATA"]: "/runtime/.source-plugin-authoring-home", ["LOCALAPPDATA"]: "/runtime/.source-plugin-authoring-home", ["TEMP"]: "/runtime/.source-plugin-authoring-home", ["TMP"]: "/runtime/.source-plugin-authoring-home", ["BUN_TMPDIR"]: "/runtime/.source-plugin-authoring-home", ["BUN_INSTALL"]: "/runtime/.source-plugin-authoring-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/runtime/.source-plugin-authoring-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "0", ["BUN_INSTALL_AUTO"]: "disable",
  } }]]);
});

test("a legitimate newly witnessed nested template remains opaque and needs no adapter filename change", async () => {
  const fixture = createPluginAuthoringFixture({ wire: { ...pluginAuthoringWire, files: [...pluginAuthoringFiles, { file: "tools/data/plugin-hooks-template/nested/extra.bin", bytes: [255, 0] }], inputs: [...pluginAuthoringInputs, { path: "scripts/plugin-hooks-template/nested/extra.bin", sha256: pluginAuthoringHash }] } });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "ok", value: {
    files: [
      { path: ".claude/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", mode: 0o640, bytes: new Uint8Array([99, 111, 109, 112, 111, 115, 101]) },
      { path: ".claude/tools/data/plugin-hooks-template/compose.ts", mode: 0o640, bytes: new Uint8Array([0, 255, 13, 10, 123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      { path: ".claude/tools/data/plugin-targets.json", mode: 0o640, bytes: new Uint8Array([123, 125, 10]) },
      { path: ".claude/tools/data/plugin-authoring-context.json", mode: 0o640, bytes: new Uint8Array([123, 125, 13, 10]) },
      { path: ".claude/tools/data/plugin-hooks-template/nested/extra.bin", mode: 0o640, bytes: new Uint8Array([255, 0]) },
    ], preparation: { kind: "plugin-authoring", paths: [".claude/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", ".claude/tools/data/plugin-hooks-template/compose.ts", ".claude/tools/data/plugin-targets.json", ".claude/tools/data/plugin-authoring-context.json", ".claude/tools/data/plugin-hooks-template/nested/extra.bin"], inputs: [...pluginAuthoringInputs, { path: "scripts/plugin-hooks-template/nested/extra.bin", sha256: pluginAuthoringHash }] },
  } });
});

test("selected harness only changes the authoring-kit installation prefix", async () => {
  const fixture = createPluginAuthoringFixture();
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare({ ...pluginAuthoringRequest, binding: { harness: "codex", directory: ".codex" } })).toEqual({ status: "ok", value: {
    files: [
      { path: ".codex/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", mode: 0o640, bytes: new Uint8Array([99, 111, 109, 112, 111, 115, 101]) },
      { path: ".codex/tools/data/plugin-hooks-template/compose.ts", mode: 0o640, bytes: new Uint8Array([0, 255, 13, 10, 123, 123, 73, 78, 86, 79, 75, 69, 125, 125]) },
      { path: ".codex/tools/data/plugin-targets.json", mode: 0o640, bytes: new Uint8Array([123, 125, 10]) },
      { path: ".codex/tools/data/plugin-authoring-context.json", mode: 0o640, bytes: new Uint8Array([123, 125, 13, 10]) },
    ], preparation: { kind: "plugin-authoring", paths: [".codex/tools/data/plugin-hooks-template/aidlc-plugin-compose.ts", ".codex/tools/data/plugin-hooks-template/compose.ts", ".codex/tools/data/plugin-targets.json", ".codex/tools/data/plugin-authoring-context.json"], inputs: pluginAuthoringInputs },
  } });
});

test.each([
  { label: "negative byte", wire: { ...pluginAuthoringWire, files: [{ file: "tools/data/plugin-targets.json", bytes: [-1] }] } },
  { label: "non-byte", wire: { ...pluginAuthoringWire, files: [{ file: "tools/data/plugin-targets.json", bytes: [256] }] } },
  { label: "fractional byte", wire: { ...pluginAuthoringWire, files: [{ file: "tools/data/plugin-targets.json", bytes: [0.5] }] } },
  { label: "text instead of opaque bytes", wire: { ...pluginAuthoringWire, files: [{ file: "tools/data/plugin-targets.json", bytes: "{}" }] } },
  { label: "invalid digest", wire: { ...pluginAuthoringWire, inputs: [{ path: "scripts/plugin-authoring-data.ts", sha256: "bad" }] } },
  { label: "unknown protocol field", wire: { ...pluginAuthoringWire, compiler: "invented" } },
])("invalid source output protocol refuses: $label", async ({ wire }) => {
  const fixture = createPluginAuthoringFixture({ wire });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-plugin-authoring", detail: "plugin authoring requires bounded byte artifacts and SHA-256 source witnesses" }] });
});

test.each([
  { files: [...pluginAuthoringFiles, { file: "tools/data/unknown.json", bytes: [1] }] },
  { files: [...pluginAuthoringFiles, { file: "tools/data/plugin-targets.json", bytes: [1] }] },
  { files: [...pluginAuthoringFiles, { file: "tools/data/PLUGIN-TARGETS.json", bytes: [1] }] },
  { files: [...pluginAuthoringFiles, { file: "tools/data/plugin-hooks-template/../outside.ts", bytes: [1] }] },
  { files: [...pluginAuthoringFiles, { file: "tools/data/plugin-hooks-template/unwitnessed.ts", bytes: [1] }] },
  { files: [pluginAuthoringFiles[0], pluginAuthoringFiles[1], pluginAuthoringFiles[2]] },
  { files: [pluginAuthoringFiles[0], pluginAuthoringFiles[1], pluginAuthoringFiles[3]] },
  { files: [pluginAuthoringFiles[0], pluginAuthoringFiles[2], pluginAuthoringFiles[3]] },
  { files: [] },
])("unknown, missing, aliased or colliding products cannot escape the authoring namespace", async ({ files }) => {
  const fixture = createPluginAuthoringFixture({ wire: { ...pluginAuthoringWire, files } });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-plugin-authoring", detail: "plugin authoring must emit both native JSON files and exactly its witnessed template paths without aliases or collisions" }] });
});

test.each([
  { inputs: [...pluginAuthoringInputs, pluginAuthoringInputs[0]] },
  { inputs: [...pluginAuthoringInputs, { path: "scripts/../outside.ts", sha256: pluginAuthoringHash }] },
  { inputs: [...pluginAuthoringInputs, { path: "plugins/rin/manifest.ts", sha256: pluginAuthoringHash }] },
  { inputs: [{ path: "scripts/plugin-authoring-data.ts", sha256: pluginAuthoringHash }, { path: "scripts/manifest-types.ts", sha256: pluginAuthoringHash }, { path: "harness/other/manifest.ts", sha256: pluginAuthoringHash }] },
  { inputs: [{ path: "scripts/manifest-types.ts", sha256: pluginAuthoringHash }, { path: "harness/claude/manifest.ts", sha256: pluginAuthoringHash }, { path: "core/agents/aidlc-note-agent.md", sha256: pluginAuthoringHash }] },
])("foreign, duplicate or incomplete source evidence cannot relabel the kit", async ({ inputs }) => {
  const fixture = createPluginAuthoringFixture({ wire: { ...pluginAuthoringWire, inputs } });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-plugin-authoring", detail: "plugin authoring requires unique safe complete source inventory witnesses including its native API, manifest contract and selected harness" }] });
});

test.each([
  { detail: "plugin authoring source inputs changed during preparation" },
  { detail: "plugin authoring native source lacks required exports" },
  { detail: "plugin authoring source symlinks are unsupported" },
  { detail: "plugin authoring template paths must be unique" },
])("worker refusal propagates atomically without authoring files: $detail", async ({ detail }) => {
  const fixture = createPluginAuthoringFixture({ wire: { status: "unavailable", detail } });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-plugin-authoring", detail }] });
});

test.each([{ exitCode: 1, stdout: "private", stderr: "", error: null }, { exitCode: 0, stdout: "private", stderr: "private", error: null }, { exitCode: null, stdout: "", stderr: "", error: "private" }])("process diagnostics refuse with bounded guidance", async (reply) => {
  const fixture = createPluginAuthoringFixture();
  fixture.operations.spawn.mockReturnValue(reply);
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-plugin-authoring", detail: "plugin authoring process unavailable or reported diagnostics" }] });
});

test("invalid worker JSON refuses before decoding artifacts", async () => {
  const fixture = createPluginAuthoringFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, stdout: "invalid", stderr: "", error: null });
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "source-plugin-authoring", detail: "plugin authoring process must return one JSON response" }] });
});

test.each([{ mode: -1 }, { mode: 0o1000 }, { mode: 1.5 }])("invalid mode refuses before process setup", async ({ mode }) => {
  const fixture = createPluginAuthoringFixture();
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare({ ...pluginAuthoringRequest, mode })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-plugin-authoring", detail: "plugin authoring requires a file permission mode between 0 and 0777" }] });
  expect(fixture.operations.paths).not.toHaveBeenCalled();
  expect(fixture.operations.environment).not.toHaveBeenCalled();
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
});

test("a foreign source basis refuses before process setup", async () => {
  const fixture = createPluginAuthoringFixture();
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare({ ...pluginAuthoringRequest, basis: { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-plugin-authoring", detail: "plugin authoring requires the framework source basis and full source pin" }] });
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
});

test.each([{ id: "other", pin: "1111111111111111111111111111111111111111" }, { id: "framework", pin: "short" }])("an unknown framework identity or abbreviated pin refuses before process setup", async ({ id, pin }) => {
  const fixture = createPluginAuthoringFixture();
  expect(await createSourcePluginAuthoringPreparer({ operations: fixture.operations }).prepare({ ...pluginAuthoringRequest, basis: { source: { kind: "core", id }, pin } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-plugin-authoring", detail: "plugin authoring requires the framework source basis and full source pin" }] });
  expect(fixture.operations.paths).not.toHaveBeenCalled();
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
});

test("process capability exceptions remain failures as data", async () => {
  const fixture = createPluginAuthoringFixture();
  const revoked = Proxy.revocable(fixture.operations.spawn, {});
  revoked.revoke();
  expect(await createSourcePluginAuthoringPreparer({ operations: { ...fixture.operations, spawn: revoked.proxy } }).prepare(pluginAuthoringRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-plugin-authoring", detail: "plugin authoring process capability unavailable" }] });
});

test("production operation factory exposes the complete source-process capability", () => {
  expect(createSourcePluginAuthoringOperations()).toEqual({ paths: expect.any(Function), environment: expect.any(Function), spawn: expect.any(Function) });
});
