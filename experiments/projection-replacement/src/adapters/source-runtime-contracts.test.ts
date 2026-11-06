import { expect, test } from "bun:test";
import { createSourceRuntimeContractPreparer } from "./source-runtime-contracts.ts";
import { createRuntimeContractFixture, runtimeContractRequest, runtimeContractWire, runtimeContractInputs, runtimeContractHash } from "../../__tests__/runtime-contract-fixtures.ts";

test("preserves Native schema order and opaque Native tier serialization with complete direct provenance", async () => {
  const fixture = createRuntimeContractFixture();
  expect(await createSourceRuntimeContractPreparer({ binary: "/bun", operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "ok", value: {
    files: [
      { path: ".claude/tools/data/aidlc-settings.schema.json", mode: 0o640, bytes: new Uint8Array([123,10,32,32,34,122,34,58,32,49,44,10,32,32,34,97,34,58,32,50,10,125,10]) },
      { path: ".claude/tools/data/agent-tiers.json", mode: 0o640, bytes: new Uint8Array([110,97,116,105,118,101,45,111,112,97,113,117,101,13,10]) },
    ],
    preparation: { kind: "runtime-contracts", paths: [".claude/tools/data/aidlc-settings.schema.json", ".claude/tools/data/agent-tiers.json"], inputs: runtimeContractInputs },
  } });
  expect(fixture.operations.paths.mock.calls).toEqual([[runtimeContractRequest]]);
  expect(fixture.operations.environment.mock.calls).toEqual([[]]);
  expect(fixture.operations.spawn.mock.calls).toEqual([[{
    binary: "/bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/runtime",
    input: '{"sourceRoot":"/source","paths":["core/tools/aidlc-settings.ts","core/tools/aidlc-model-policy.ts"]}',
    env: { ["PATH"]: "/bin", ["HOME"]: "/runtime/.source-runtime-contract-home", ["USERPROFILE"]: "/runtime/.source-runtime-contract-home", ["APPDATA"]: "/runtime/.source-runtime-contract-home", ["LOCALAPPDATA"]: "/runtime/.source-runtime-contract-home", ["TEMP"]: "/runtime/.source-runtime-contract-home", ["TMP"]: "/runtime/.source-runtime-contract-home", ["BUN_TMPDIR"]: "/runtime/.source-runtime-contract-home", ["BUN_INSTALL"]: "/runtime/.source-runtime-contract-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/runtime/.source-runtime-contract-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "0" },
  }]]);
});

test.each([-1, 0o1000, 1.5])("refuses invalid mode before process setup: %s", async (mode) => {
  const fixture = createRuntimeContractFixture();
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare({ ...runtimeContractRequest, mode })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-runtime-contracts", detail: "source runtime contracts require a file permission mode between 0 and 0777" }] });
  expect(fixture.operations.paths.mock.calls).toEqual([]);
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test("refuses plugin source basis without executing Native APIs", async () => {
  const fixture = createRuntimeContractFixture();
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare({ ...runtimeContractRequest, basis: { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-contracts", detail: "source runtime contracts require the framework source basis and full source pin" }] });
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test("refuses a short source pin before process setup", async () => {
  const fixture = createRuntimeContractFixture();
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare({ ...runtimeContractRequest, basis: { source: { kind: "core", id: "framework" }, pin: "short" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-contracts", detail: "source runtime contracts require the framework source basis and full source pin" }] });
  expect(fixture.operations.paths.mock.calls).toEqual([]);
  expect(fixture.operations.spawn.mock.calls).toEqual([]);
});

test("Native empty authored directory and explicit shared Kiro IDE destination need no invented agent count", async () => {
  const fixture = createRuntimeContractFixture({ wire: { ...runtimeContractWire, inputs: [runtimeContractInputs[0], runtimeContractInputs[1]] } });
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare({ ...runtimeContractRequest, binding: { harness: "kiro-ide", directory: ".kiro" }, mode: 0 })).toEqual({ status: "ok", value: {
    files: [
      { path: ".kiro/tools/data/aidlc-settings.schema.json", mode: 0, bytes: new Uint8Array([123,10,32,32,34,122,34,58,32,49,44,10,32,32,34,97,34,58,32,50,10,125,10]) },
      { path: ".kiro/tools/data/agent-tiers.json", mode: 0, bytes: new Uint8Array([110,97,116,105,118,101,45,111,112,97,113,117,101,13,10]) },
    ],
    preparation: { kind: "runtime-contracts", paths: [".kiro/tools/data/aidlc-settings.schema.json", ".kiro/tools/data/agent-tiers.json"], inputs: [
      { path: "core/tools/aidlc-settings.ts", sha256: runtimeContractHash },
      { path: "core/tools/aidlc-model-policy.ts", sha256: runtimeContractHash },
    ] },
  } });
});

test.each([
  { label: "absent schema", wire: { ...runtimeContractWire, schema: null } },
  { label: "array schema", wire: { ...runtimeContractWire, schema: [] } },
  { label: "non-string serialized tiers", wire: { ...runtimeContractWire, serializedTiers: {} } },
  { label: "invalid digest", wire: { ...runtimeContractWire, inputs: [{ path: "core/tools/aidlc-settings.ts", sha256: "bad" }] } },
  { label: "missing direct witness", wire: { ...runtimeContractWire, inputs: [runtimeContractInputs[0]] } },
])("refuses invalid Native output protocol: $label", async ({ wire }) => {
  const fixture = createRuntimeContractFixture({ wire });
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-contracts", detail: "source runtime contracts require a native schema record, serialized tiers and SHA-256 source witnesses" }] });
});

test.each([
  { label: "duplicate", inputs: [...runtimeContractInputs, runtimeContractInputs[2]] },
  { label: "foreign agent", inputs: [runtimeContractInputs[0], runtimeContractInputs[1], { path: "plugins/rin/agents/reviewer-agent.md", sha256: runtimeContractHash }] },
  { label: "alias", inputs: [runtimeContractInputs[0], runtimeContractInputs[1], { path: "core/agents/../quality-agent.md", sha256: runtimeContractHash }] },
  { label: "reordered modules", inputs: [runtimeContractInputs[1], runtimeContractInputs[0], runtimeContractInputs[2]] },
])("rejects missing, foreign or aliased source witnesses: $label", async ({ inputs }) => {
  const fixture = createRuntimeContractFixture({ wire: { ...runtimeContractWire, inputs } });
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-contracts", detail: "source runtime contracts require both direct module witnesses and unique safe authored core agent paths" }] });
});

test("propagates source instability as unavailable without emitting either file", async () => {
  const fixture = createRuntimeContractFixture({ wire: { status: "unavailable", detail: "source runtime contract inputs changed during preparation" } });
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-contracts", detail: "source runtime contract inputs changed during preparation" }] });
});

test.each([
  { exitCode: 1, stdout: "private", stderr: "", error: null },
  { exitCode: 0, stdout: "private", stderr: "private", error: null },
  { exitCode: null, stdout: "", stderr: "", error: "private" },
])("refuses process failures and diagnostics with bounded guidance", async (reply) => {
  const fixture = createRuntimeContractFixture();
  fixture.operations.spawn.mockReturnValue(reply);
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-contracts", detail: "source runtime contract process unavailable or reported diagnostics" }] });
});

test("invalid JSON has its own bounded refusal", async () => {
  const fixture = createRuntimeContractFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, stdout: "invalid-json", stderr: "", error: null });
  expect(await createSourceRuntimeContractPreparer({ operations: fixture.operations }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "source-runtime-contracts", detail: "source runtime contract process must return one JSON response" }] });
});

test("process capability exceptions return data", async () => {
  const fixture = createRuntimeContractFixture();
  const revoked = Proxy.revocable(fixture.operations.spawn, {});
  revoked.revoke();
  expect(await createSourceRuntimeContractPreparer({ operations: { ...fixture.operations, spawn: revoked.proxy } }).prepare(runtimeContractRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-runtime-contracts", detail: "source runtime contract process capability unavailable" }] });
});
