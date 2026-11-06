import { expect, mock, test } from "bun:test";
import { createSourceRuntimeModulePreparer, createSourceRuntimeModuleOperations } from "./source-runtime-modules.ts";
import { createRuntimeModuleFixture, runtimeModuleRequest, runtimeModuleRequestWithoutInvocation, runtimeModuleWire, runtimeModuleInputs, runtimeModuleFiles, runtimeModuleHash } from "../../__tests__/runtime-module-fixtures.ts";

test("module production selects bounded capacity through the injected process factory", () => {
  const environment = mock(), spawn = mock(), create = mock().mockReturnValue({ environment, spawn });
  expect(createSourceRuntimeModuleOperations({ create })).toEqual({ environment, spawn, paths: expect.any(Function) });
  expect(create.mock.calls).toEqual([[{ timeout: 30000, maxBuffer: 33554432 }]]);
});
test("a revoked process capability returns a bounded failure rather than throwing", async () => {
  const fixture = createRuntimeModuleFixture(), revoked = Proxy.revocable(fixture.operations.spawn, {});
  revoked.revoke();
  expect(await createSourceRuntimeModulePreparer({ operations: { ...fixture.operations, spawn: revoked.proxy } }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "source runtime module process capability unavailable" }] });
});
test("retains tool text, compiled hooks, hook declarations and complete inventory evidence as prepared input", async () => {
  const fixture = createRuntimeModuleFixture();
  expect(await createSourceRuntimeModulePreparer({ binary: "/bun", operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "ok", value: {
    files: [
      { path: ".claude/tools/aidlc-version.ts", mode: 0o640, bytes: new Uint8Array([118,10]) },
      { path: ".claude/tools/aidlc-plain.ts", mode: 0o640, bytes: new Uint8Array([239,187,191,120,13,10]) },
      { path: ".claude/tools/aidlc-plain.runtime.js", mode: 0o640, bytes: new Uint8Array([98,10]) },
      { path: ".claude/tools/core-runtime-types/types.d.cts", mode: 0o640, bytes: new Uint8Array([116,10]) },
      { path: ".claude/tools/core-runtime-types/package.json", mode: 0o640, bytes: new Uint8Array([123,125,10]) },
      { path: ".claude/tools/core-runtime-types/LICENSE", mode: 0o640, bytes: new Uint8Array([76,10]) },
      { path: ".claude/hooks/session.ts", mode: 0o640, bytes: new Uint8Array([104,10]) },
      { path: ".claude/projection/plugin-hook-types.d.ts", mode: 0o640, bytes: new Uint8Array([112,10]) },
    ],
    preparation: { kind: "runtime-modules", paths: [".claude/tools/aidlc-version.ts", ".claude/tools/aidlc-plain.ts", ".claude/tools/aidlc-plain.runtime.js", ".claude/tools/core-runtime-types/types.d.cts", ".claude/tools/core-runtime-types/package.json", ".claude/tools/core-runtime-types/LICENSE", ".claude/hooks/session.ts", ".claude/projection/plugin-hook-types.d.ts"], inputs: runtimeModuleInputs },
  } });
  expect(fixture.operations.paths.mock.calls).toEqual([[runtimeModuleRequest]]);
  expect(fixture.operations.environment.mock.calls).toEqual([[]]);
  expect(fixture.operations.spawn.mock.calls).toEqual([[{
    binary: "/bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/runtime",
    input: '{"sourceRoot":"/source","harnessDir":".claude","invoke":"bun .claude/tools/aidlc.ts"}',
    env: { ["PATH"]: "/bin", ["HOME"]: "/runtime/.source-runtime-module-home", ["USERPROFILE"]: "/runtime/.source-runtime-module-home", ["APPDATA"]: "/runtime/.source-runtime-module-home", ["LOCALAPPDATA"]: "/runtime/.source-runtime-module-home", ["TEMP"]: "/runtime/.source-runtime-module-home", ["TMP"]: "/runtime/.source-runtime-module-home", ["BUN_TMPDIR"]: "/runtime/.source-runtime-module-home", ["BUN_INSTALL"]: "/runtime/.source-runtime-module-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/runtime/.source-runtime-module-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "0" },
  }]]);
});

test.each([runtimeModuleRequestWithoutInvocation, { ...runtimeModuleRequest, invocation: "aidlc" }, { ...runtimeModuleRequest, invocation: "bun .claude/tools/another.ts" }])("refuses missing or unsupported invocation before process setup", async (request) => {
  const fixture = createRuntimeModuleFixture();
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "source runtime modules qualify explicit Bun copy invocation; missing or native-release invocation is unsupported" }] });
  expect(fixture.operations.paths.mock.calls).toEqual([]);
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test("refuses foreign source basis before process setup", async () => {
  const fixture = createRuntimeModuleFixture();
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare({ ...runtimeModuleRequest, basis: { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "source runtime modules require the framework source basis and full source pin" }] });
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test.each([-1, 512, 1.5])("refuses invalid output mode before process setup", async (mode) => {
  const fixture = createRuntimeModuleFixture();
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare({ ...runtimeModuleRequest, mode })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-runtime-modules", detail: "source runtime modules require a file permission mode between 0 and 0777" }] });
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test.each([
  { label: "missing API", inputs: [runtimeModuleInputs[1], runtimeModuleInputs[2], runtimeModuleInputs[3], runtimeModuleInputs[4], runtimeModuleInputs[5], runtimeModuleInputs[6], runtimeModuleInputs[7], runtimeModuleInputs[8], runtimeModuleInputs[9]] },
  { label: "missing Core compiler API", inputs: [runtimeModuleInputs[0], runtimeModuleInputs[1], runtimeModuleInputs[2], runtimeModuleInputs[3], runtimeModuleInputs[4], runtimeModuleInputs[5], runtimeModuleInputs[6], runtimeModuleInputs[8], runtimeModuleInputs[9]] },
  { label: "missing hook declaration source", inputs: [runtimeModuleInputs[0], runtimeModuleInputs[1], runtimeModuleInputs[2], runtimeModuleInputs[3], runtimeModuleInputs[4], runtimeModuleInputs[5], runtimeModuleInputs[6], runtimeModuleInputs[7], runtimeModuleInputs[9]] },
  { label: "foreign tree", inputs: [...runtimeModuleInputs, { path: "plugins/rin/tools/foreign.ts", sha256: runtimeModuleHash }] },
  { label: "alias", inputs: [...runtimeModuleInputs, { path: "scripts/../foreign.ts", sha256: runtimeModuleHash }] },
  { label: "case collision", inputs: [...runtimeModuleInputs, { path: "Scripts/Runtime-Source.ts", sha256: runtimeModuleHash }] },
])("refuses invalid inventory witnesses: $label", async ({ inputs }) => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, inputs } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require complete unique safe core/tools, core/hooks, core/projection and scripts witnesses including all native APIs" }] });
});

test.each([
  { label: "nested runtime", modules: ["tools/nested/module.ts"] },
  { label: "nested hook", modules: ["hooks/nested/hook.ts"] },
  { label: "missing witness", modules: ["tools/unwitnessed.ts"] },
  { label: "duplicate", modules: ["tools/aidlc-version.ts", "tools/aidlc-version.ts"] },
])("refuses unsupported module selection: $label", async ({ modules }) => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, modules } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" }] });
});

test.each([
  { label: "foreign destination", artifact: { file: "rules/foreign.ts", content: "foreign" } },
  { label: "foreign projection product", artifact: { file: "projection/arbitrary.json", content: "foreign" } },
  { label: "aliased destination", artifact: { file: "tools/../foreign.ts", content: "foreign" } },
  { label: "duplicate destination", artifact: { file: "tools/aidlc-version.ts", content: "different" } },
  { label: "case collision", artifact: { file: "tools/AIDLC-VERSION.ts", content: "different" } },
])("refuses invalid compiler resource destinations: $label", async ({ artifact }) => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, files: [...runtimeModuleFiles, artifact] } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime module outputs require unique safe tools/hooks resources and the Core hook declaration" }] });
});

test("missing selected output cannot publish partial modules", async () => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, files: [runtimeModuleFiles[0]] } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" }] });
});

test("a missing compiled hook cannot fall back to a partial tools-only result", async () => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, files: [runtimeModuleFiles[0], runtimeModuleFiles[1], runtimeModuleFiles[2], runtimeModuleFiles[3], runtimeModuleFiles[4], runtimeModuleFiles[5], runtimeModuleFiles[7]] } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" }] });
});

test("a missing generated hook declaration cannot publish otherwise complete modules", async () => {
  const fixture = createRuntimeModuleFixture({ wire: { ...runtimeModuleWire, files: [runtimeModuleFiles[0], runtimeModuleFiles[1], runtimeModuleFiles[2], runtimeModuleFiles[3], runtimeModuleFiles[4], runtimeModuleFiles[5], runtimeModuleFiles[6]] } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime module outputs require unique safe tools/hooks resources and the Core hook declaration" }] });
});

test("propagates unavailable native compilation without prepared files", async () => {
  const fixture = createRuntimeModuleFixture({ wire: { status: "unavailable", detail: "native runtime module compiler refused preparation" } });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "native runtime module compiler refused preparation" }] });
});

test.each([
  { status: "ok", files: runtimeModuleFiles, modules: ["tools/aidlc-version.ts"], inputs: [] },
  { status: "ok", files: [{ file: "tools/aidlc-version.ts", content: 1 }], modules: ["tools/aidlc-version.ts"], inputs: runtimeModuleInputs },
])("refuses malformed worker envelopes", async (wire) => {
  const fixture = createRuntimeModuleFixture({ wire });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "source runtime modules require native text artifacts, selected modules and SHA-256 inventory witnesses" }] });
});

test.each([
  { exitCode: 1, stdout: "private", stderr: "", error: null },
  { exitCode: 0, stdout: "private", stderr: "private", error: null },
  { exitCode: null, stdout: "", stderr: "", error: "private" },
])("refuses process failure and diagnostic channels", async (reply) => {
  const fixture = createRuntimeModuleFixture();
  fixture.operations.spawn.mockReturnValue(reply);
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-modules", detail: "source runtime module process unavailable or reported diagnostics" }] });
});

test("invalid worker JSON has bounded guidance", async () => {
  const fixture = createRuntimeModuleFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, stdout: "broken", stderr: "", error: null });
  expect(await createSourceRuntimeModulePreparer({ operations: fixture.operations }).prepare(runtimeModuleRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "source-runtime-modules", detail: "source runtime module process must return one JSON response" }] });
});
