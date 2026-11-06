import { expect, test } from "bun:test";
import { hookRuntimeForReply, hookRuntimeRequest } from "../../__tests__/plugin-hook-runtime-fixtures.ts";

test("prepares hook files with separate compiler and plugin ownership, without registrations", async () => {
  expect(await hookRuntimeForReply().prepare(hookRuntimeRequest)).toEqual({ status: "ok", value: {
    owner: { source: { kind: "plugin", id: "example" }, pin: "1111111111111111111111111111111111111111" },
    compiler: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111", path: "scripts/plugin-runtime.ts" },
    binding: { harness: "claude", directory: ".claude" },
    inputs: [{ path: "hooks/guard.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    resources: [{ kind: "file", path: "hooks/guard.ts", body: "export const allowed = false;\n" }],
  } });
});

test("retains JSON companions and literal hook text without interpreting authority", async () => {
  expect(await hookRuntimeForReply({ stdout: '{"status":"ok","inputs":[{"path":"hooks/roster.json","sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}],"resources":[{"path":"hooks/roster.json","body":"{\\"denied\\":[\\"shell\\"]}\\n"}]}' }).prepare(hookRuntimeRequest)).toMatchObject({ status: "ok", value: { resources: [{ kind: "file", path: "hooks/roster.json", body: '{"denied":["shell"]}\n' }] } });
});

test.each([
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"resources":[{"path":"hooks/../settings.json","body":"{}"}]}'],
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"resources":[{"path":"tools/target.ts","body":"{}"}]}'],
  ['{"status":"ok","inputs":[],"resources":[]}'],
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"unproven"}],"resources":[{"path":"hooks/a.ts","body":""}]}'],
  ['{"status":"ok","inputs":[],"resources":[],"registrations":[]}'],
])("refuses unsupported native output rather than dropping or reclassifying it: %s", async (stdout) => {
  expect(await hookRuntimeForReply({ stdout }).prepare(hookRuntimeRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hook-runtime", detail: "runtime preparation requires nonempty hook-local files and source digests; unsupported outputs were not dropped" }] });
});

test.each([
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"resources":[{"path":"hooks/b.ts","body":""}]}'],
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"resources":[{"path":"hooks/a.ts","body":"first"},{"path":"hooks/a.ts","body":"second"}]}'],
  ['{"status":"ok","inputs":[{"path":"hooks/a.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"hooks/a.ts","sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}],"resources":[{"path":"hooks/a.ts","body":""}]}'],
])("requires complete unique authored paths: %s", async (stdout) => {
  expect(await hookRuntimeForReply({ stdout }).prepare(hookRuntimeRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hook-runtime", detail: "runtime preparation must preserve every authored hook path exactly once with unique inputs and outputs" }] });
});

test("does not extend the Claude preparation contract to an unqualified harness", async () => {
  expect(await hookRuntimeForReply().prepare({ pluginId: "example", binding: { harness: "codex", directory: ".codex" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hook-runtime", detail: "authored hook runtime preparation is qualified for Claude only" }] });
});

test("plugin identifiers cannot redirect source inventory", async () => {
  expect(await hookRuntimeForReply().prepare({ ...hookRuntimeRequest, pluginId: "../other" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hook-runtime", detail: "declare a pinned framework checkout and a canonical plugin identifier within that checkout" }] });
});

test("requires a full compiler source pin", async () => {
  expect(await hookRuntimeForReply({ compiler: { source: { kind: "core", id: "framework" }, pin: "floating" } }).prepare(hookRuntimeRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-hook-runtime", detail: "declare a pinned framework checkout and a canonical plugin identifier within that checkout" }] });
});

test.each([
  ['{"status":"unavailable","detail":"source-owned plugin runtime API unavailable"}', { status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hook-runtime", detail: "source-owned plugin runtime API unavailable" }] }],
  ['{"status":"refused","detail":"plugin runtime closure would change import.meta semantics: hooks/guard.ts"}', { status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-hook-runtime", detail: "plugin runtime closure would change import.meta semantics: hooks/guard.ts" }] }],
] as const)("keeps native unavailable/refused outcomes distinct: %s", async (stdout, expected) => {
  expect(await hookRuntimeForReply({ stdout }).prepare(hookRuntimeRequest)).toEqual(expected);
});

test("failed process cannot issue apparently successful files or leak stderr", async () => {
  expect(await hookRuntimeForReply({ exitCode: 1, stderr: "private filesystem failure" }).prepare(hookRuntimeRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-hook-runtime", detail: "source hook runtime process unavailable; no artifacts issued" }] });
});

test("malformed output is a decoding failure", async () => {
  expect(await hookRuntimeForReply({ stdout: "not JSON" }).prepare(hookRuntimeRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "plugin-hook-runtime", detail: "runtime preparation must return one JSON response" }] });
});
