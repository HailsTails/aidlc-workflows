import { expect, test } from "bun:test";
import { createSourceRuntimeContextReader } from "./source-runtime-context.ts";
import { createSourceRuntimeContextFixture, sourceContextLocation, sourceContextInputs, sourceContextBytes, sourceContextWire, sourceContextDescriptor, sourceContextDigest } from "../../__tests__/source-runtime-context-fixtures.ts";

test("preserves the complete native descriptor, insertion order, copy context and source provenance", async () => {
  const fixture = createSourceRuntimeContextFixture();
  expect(await createSourceRuntimeContextReader({ mode: 0o640, binary: "/bun", operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "ok", value: {
    context: { binding: { harness: "claude", directory: ".claude" }, rulesSubdir: "rules", invocation: "bun .claude/tools/aidlc.ts" },
    files: [{ path: ".claude/tools/data/harness.json", mode: 0o640, bytes: sourceContextBytes }],
    inputs: [
      { path: "harness/claude/manifest.ts", sha256: sourceContextDigest }, { path: "harness/claude/onboarding.fills.ts", sha256: sourceContextDigest },
      { path: "scripts/harness-runtime-data.ts", sha256: sourceContextDigest }, { path: "core/tools/aidlc-runtime-paths.ts", sha256: sourceContextDigest },
    ],
  } });
  expect(fixture.operations.paths.mock.calls).toEqual([[sourceContextLocation]]);
  expect(fixture.operations.environment.mock.calls).toEqual([[]]);
  expect(fixture.operations.spawn.mock.calls).toEqual([[{ binary: "/bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/context", input: '{"sourceRoot":"/source","paths":["harness/claude/manifest.ts","harness/claude/onboarding.fills.ts","scripts/harness-runtime-data.ts","core/tools/aidlc-runtime-paths.ts"]}', env: {
    ["PATH"]: "/bin", ["HOME"]: "/context/.source-runtime-context-home", ["USERPROFILE"]: "/context/.source-runtime-context-home", ["APPDATA"]: "/context/.source-runtime-context-home", ["LOCALAPPDATA"]: "/context/.source-runtime-context-home", ["TEMP"]: "/context/.source-runtime-context-home", ["TMP"]: "/context/.source-runtime-context-home", ["BUN_TMPDIR"]: "/context/.source-runtime-context-home", ["BUN_INSTALL"]: "/context/.source-runtime-context-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/context/.source-runtime-context-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "0",
    ["AIDLC_HARNESS_DIR"]: ".claude", ["AIDLC_HARNESS_NAME"]: "claude", ["AIDLC_SRC"]: "/source/core", ["AIDLC_RUNTIME_HARNESS_ROOT"]: "/source/core", ["AIDLC_PROJECT_DIR"]: "/context", ["AIDLC_RUNTIME_PROJECT_DIR"]: "/context",
  } }]]);
});

test("Kiro IDE identity cannot be inferred from its shared Kiro directory", async () => {
  const fixture = createSourceRuntimeContextFixture({ wire: { ...sourceContextWire, descriptor: { ...sourceContextDescriptor, distribution: "kiro", name: "kiro", harnessDir: ".kiro" }, invocation: "bun .kiro/tools/aidlc.ts", inputs: [
    { path: "harness/kiro-ide/manifest.ts", sha256: sourceContextDigest }, { path: "harness/kiro-ide/onboarding.fills.ts", sha256: sourceContextDigest },
    { path: "scripts/harness-runtime-data.ts", sha256: sourceContextDigest }, { path: "core/tools/aidlc-runtime-paths.ts", sha256: sourceContextDigest },
  ] } });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load({ ...sourceContextLocation, binding: { harness: "kiro-ide", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "source-runtime-context", detail: "native source descriptor must declare the requested harness identity, directory and supported rules path" }] });
  expect(fixture.operations.spawn.mock.calls[0]?.[0].input).toBe('{"sourceRoot":"/source","paths":["harness/kiro-ide/manifest.ts","harness/kiro-ide/onboarding.fills.ts","scripts/harness-runtime-data.ts","core/tools/aidlc-runtime-paths.ts"]}');
});

test("native executable invocation remains explicitly unsupported", async () => {
  const fixture = createSourceRuntimeContextFixture({ wire: { ...sourceContextWire, invocation: "aidlc" } });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-context", detail: "source runtime context qualifies Bun copy invocation only; native executable preparation is unsupported" }] });
});

test.each([-1, 0o1000, 1.5])("invalid file mode refuses before process setup: %s", async (mode) => {
  const fixture = createSourceRuntimeContextFixture();
  expect(await createSourceRuntimeContextReader({ mode, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-runtime-context", detail: "source runtime context requires a file permission mode between 0 and 0777" }] });
  expect(fixture.operations.paths).not.toHaveBeenCalled();
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
});

test("foreign source basis refuses before source execution", async () => {
  const fixture = createSourceRuntimeContextFixture();
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load({ ...sourceContextLocation, location: { ...sourceContextLocation.location, basis: { source: { kind: "plugin", id: "framework" }, pin: "1111111111111111111111111111111111111111" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-context", detail: "source runtime context requires the framework source basis and full source pin" }] });
  expect(fixture.operations.paths).not.toHaveBeenCalled();
});

test.each([
  { exitCode: 1, stdout: "private output", stderr: "private diagnostic", error: null },
  { exitCode: 0, stdout: "", stderr: "warning", error: null },
  { exitCode: null, stdout: "", stderr: "", error: "private error" },
])("process unavailability and diagnostics refuse without leaking transport text: %s", async (reply) => {
  const fixture = createSourceRuntimeContextFixture();
  fixture.operations.spawn.mockReturnValue(reply);
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-context", detail: "source runtime context process unavailable or reported diagnostics" }] });
});

test("process capability exceptions become bounded data", async () => {
  const fixture = createSourceRuntimeContextFixture();
  const revoked = Proxy.revocable(fixture.operations.spawn, {});
  revoked.revoke();
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: { ...fixture.operations, spawn: revoked.proxy } }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-context", detail: "source runtime context process capability unavailable" }] });
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
});

test("malformed JSON is distinct from a malformed source response", async () => {
  const fixture = createSourceRuntimeContextFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, stdout: "not JSON", stderr: "", error: null });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "source-runtime-context", detail: "source runtime context process must return one JSON response" }] });
});

test.each([
  { wire: null, code: "invalid-input", detail: "source runtime context requires native descriptor data, copy invocation and four SHA-256 module witnesses" },
  { wire: {}, code: "invalid-input", detail: "source runtime context requires native descriptor data, copy invocation and four SHA-256 module witnesses" },
  { wire: { status: "ok", descriptor: {}, invocation: "bun .claude/tools/aidlc.ts", inputs: [] }, code: "harness-mismatch", detail: "native source descriptor must declare the requested harness identity, directory and supported rules path" },
])("malformed wire data produces an explicit refusal: %s", async ({ wire, code, detail }) => {
  const fixture = createSourceRuntimeContextFixture({ wire });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code, subject: "source-runtime-context", detail }] });
});

test.each([
  { wire: { ...sourceContextWire, inputs: [sourceContextInputs[0], sourceContextInputs[0], sourceContextInputs[2], sourceContextInputs[3]] } },
  { wire: { ...sourceContextWire, inputs: [{ path: "harness/cursor/manifest.ts", sha256: sourceContextDigest }, sourceContextInputs[1], sourceContextInputs[2], sourceContextInputs[3]] } },
])("direct witness identity cannot be replaced by duplicates or foreign paths: %s", async ({ wire }) => {
  const fixture = createSourceRuntimeContextFixture({ wire });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-context", detail: "source runtime context requires its four direct module witnesses once in declared order" }] });
});

test("a changed-source observation is unavailable and cannot produce a context file", async () => {
  const fixture = createSourceRuntimeContextFixture({ wire: { status: "unavailable", detail: "source runtime context direct inputs changed during preparation" } });
  expect(await createSourceRuntimeContextReader({ mode: 0o644, operations: fixture.operations }).load(sourceContextLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-context", detail: "source runtime context direct inputs changed during preparation" }] });
});
