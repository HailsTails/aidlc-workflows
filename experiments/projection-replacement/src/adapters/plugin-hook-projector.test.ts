import { expect, test } from "bun:test";
import { emptyHookFile, hookRequest, projectorForReply } from "../../__tests__/plugin-hook-fixtures.ts";

test("returns a plugin contribution file with separate author, compiler and runtime provenance", async () => {
  expect(await projectorForReply().project(hookRequest)).toEqual({ status: "ok", value: {
    owner: { source: { kind: "plugin", id: "example" }, pin: "author-pin" },
    declaration: { source: { kind: "plugin", id: "example" }, pin: "author-pin", path: "plugins/example/.aidlc-plugin/plugin.json" },
    compiler: { source: { kind: "core", id: "framework" }, pin: "compiler-pin", path: "core/projection/plugin-hook.ts" },
    runtime: { source: { kind: "plugin", id: "example" }, pin: "author-pin" },
    binding: { harness: "claude", directory: ".claude" }, registrations: 0,
    resources: [{ kind: "file", path: "contributions/hook-registrations.json", body: emptyHookFile }],
  } });
});
test("refuses an unproven harness instead of silently emitting no registrations", async () => {
  expect(await projectorForReply().project({ ...hookRequest, binding: { harness: "kiro", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hooks", detail: "this slice admits only the demonstrated native Claude contribution contract" }] });
});
test("a compiler cannot claim plugin declaration ownership", async () => {
  expect(await projectorForReply().project({ ...hookRequest, declaration: { ...hookRequest.declaration, origin: { source: { kind: "core", id: "framework" }, pin: "author-pin", path: "manifest.json" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hooks", detail: "declare an exact framework compiler basis and plugin-owned authored declaration" }] });
});
test("runtime inventory cannot borrow another plugin's identity", async () => {
  expect(await projectorForReply().project({ ...hookRequest, runtime: { ...hookRequest.runtime, basis: { source: { kind: "plugin", id: "another" }, pin: "author-pin" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hooks", detail: "prepared runtime inventory must match the declaration's exact plugin source basis; filenames cannot establish cross-version compatibility" }] });
});
test("matching filenames cannot authorize runtime reuse across source snapshots", async () => {
  expect(await projectorForReply().project({ ...hookRequest, runtime: { ...hookRequest.runtime, basis: { source: { kind: "plugin", id: "example" }, pin: "another-pin" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hooks", detail: "prepared runtime inventory must match the declaration's exact plugin source basis; filenames cannot establish cross-version compatibility" }] });
});
test("refuses escaping runtime paths", async () => {
  expect(await projectorForReply().project({ ...hookRequest, runtime: { ...hookRequest.runtime, projectedFiles: ["../guard.ts"] } })).toEqual({ status: "invalid", findings: [{ code: "invalid-path", subject: "plugin-hooks", detail: "authored declaration and runtime inventories require safe relative paths" }] });
});
test("distinguishes source API unavailability from invalid authored input", async () => {
  expect(await projectorForReply({ stdout: '{"status":"unavailable","detail":"source-owned hook API missing"}' }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugins/example/.aidlc-plugin/plugin.json", detail: "source-owned hook API missing" }] });
});
test("preserves an authored input refusal as actionable data", async () => {
  expect(await projectorForReply({ stdout: '{"status":"refused","detail":"declared hook body hooks/guard.ts is missing"}' }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugins/example/.aidlc-plugin/plugin.json", detail: "declared hook body hooks/guard.ts is missing" }] });
});
test("does not accept a foreign plugin returned by the native service", async () => {
  expect(await projectorForReply({ stdout: '{"status":"ok","projection":{"schemaVersion":1,"pluginName":"another","harness":"claude","registrations":[]}}' }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hooks", detail: "native contributions must preserve the selected plugin and harness identity" }] });
});
test("process failures remain unavailable rather than authored violations", async () => {
  expect(await projectorForReply({ error: "compiler timeout", exitCode: 1 }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hooks", detail: "source hook projection unavailable: compiler timeout" }] });
});
test("rejects malformed process output", async () => {
  expect(await projectorForReply({ stdout: "not JSON" }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "plugin-hooks", detail: "source hook projector must return one JSON response" }] });
});
test("does not admit a second contribution channel alongside the native envelope", async () => {
  expect(await projectorForReply({ stdout: '{"status":"ok","projection":{"schemaVersion":1,"pluginName":"example","harness":"claude","registrations":[]},"text":"unrelated payload"}' }).project(hookRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-hooks", detail: "source hook projector requires a native contribution file or explicit diagnostics" }] });
});
