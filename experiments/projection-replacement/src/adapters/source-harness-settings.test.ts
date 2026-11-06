import { expect, mock, test, type Mock } from "bun:test";
import { createSourceHarnessSettingsPreparer, type SourceHarnessSettingsOperations } from "./source-harness-settings.ts";
import type { HarnessSettingsRequest } from "../domain/harness-settings.ts";

const request: HarnessSettingsRequest = { sourceRoot: "source", root: "scratch", basis: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" }, binding: { harness: "claude", directory: ".claude" }, mode: 0o640, invocation: "bun .claude/tools/aidlc.ts", files: [".claude/tools/aidlc.ts", ".claude/tools/aidlc-safe.ts"] };
const inputs = [
  { path: "scripts/authored-text.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "scripts/runtime-module.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "scripts/claude-settings.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "harness/claude/manifest.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "harness/claude/onboarding.fills.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "harness/claude/settings.json", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "harness/claude/settings.local.json.example", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc-copy-preapproval.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc-command.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc-settings.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc-runtime-paths.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  { path: "core/tools/aidlc-version.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
];
const wireFiles = [{ file: ".claude/settings.json", bytes: [123, 125, 10] }, { file: ".claude/settings.local.json.example", bytes: [255, 0] }];
type FixtureOperations = { readonly [Key in keyof SourceHarnessSettingsOperations]: Mock<SourceHarnessSettingsOperations[Key]> };
const fixture = ({ wire = { status: "ok", files: wireFiles, inputs } }: { readonly wire?: unknown } = {}): FixtureOperations => ({
  paths: mock<SourceHarnessSettingsOperations["paths"]>().mockReturnValue({ sourceRoot: "/source", root: "/scratch" }),
  environment: mock<SourceHarnessSettingsOperations["environment"]>().mockReturnValue(Object.fromEntries([["PATH", "/bin"], ["SECRET", "private"], ["AIDLC_BUILD_VERSION", "untrusted"], ["NODE_OPTIONS", "untrusted"]])),
  spawn: mock<SourceHarnessSettingsOperations["spawn"]>().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify(wire) }),
});

test("admits exactly the team settings and opaque local example with complete source witnesses", async () => {
  const operations = fixture();
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "ok", value: {
    files: [{ path: ".claude/settings.json", mode: 0o640, bytes: new Uint8Array([123, 125, 10]) }, { path: ".claude/settings.local.json.example", mode: 0o640, bytes: new Uint8Array([255, 0]) }],
    preparation: { kind: "harness-settings", paths: [".claude/settings.json", ".claude/settings.local.json.example"], inputs },
  } });
});

test("passes exact prepared inventory and invocation with a credential-free isolated process context", async () => {
  const operations = fixture();
  await createSourceHarnessSettingsPreparer({ binary: "/bun", operations }).prepare(request);
  expect(operations.paths.mock.calls).toEqual([[request]]);
  expect(operations.environment.mock.calls).toEqual([[]]);
  expect(operations.spawn.mock.calls).toEqual([[{ binary: "/bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/scratch", input: '{"sourceRoot":"/source","files":[".claude/tools/aidlc.ts",".claude/tools/aidlc-safe.ts"],"invocation":"bun .claude/tools/aidlc.ts"}', env: {
    ["PATH"]: "/bin", ["HOME"]: "/scratch/.settings-home", ["USERPROFILE"]: "/scratch/.settings-home", ["APPDATA"]: "/scratch/.settings-home", ["LOCALAPPDATA"]: "/scratch/.settings-home", ["TEMP"]: "/scratch/.settings-home", ["TMP"]: "/scratch/.settings-home", ["BUN_TMPDIR"]: "/scratch/.settings-home", ["BUN_INSTALL"]: "/scratch/.settings-home/bun-install", ["BUN_INSTALL_CACHE_DIR"]: "/scratch/.settings-home/bun-cache", ["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]: "0", ["BUN_INSTALL_AUTO"]: "disable",
  } }]]);
});

const invalidRequests: HarnessSettingsRequest[] = [
  { ...request, basis: { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" } },
  { ...request, basis: { source: { kind: "core", id: "other" }, pin: "1111111111111111111111111111111111111111" } },
  { ...request, basis: { source: { kind: "core", id: "framework" }, pin: "short" } },
  { ...request, binding: { harness: "kiro-ide", directory: ".kiro" } },
  { ...request, invocation: "aidlc" },
  { ...request, invocation: "bun .claude/tools/aidlc.ts extra" },
  { ...request, mode: -1 }, { ...request, mode: 0o1000 }, { ...request, mode: 0.5 },
];
test.each(invalidRequests)("unsupported source profile refuses before resolving paths or invoking a process", async (candidate) => {
  const operations = fixture();
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(candidate)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings require the pinned framework Claude Bun-copy profile, exact invocation and explicit file modes" }] });
  expect(operations.paths.mock.calls).toEqual([]);
  expect(operations.spawn.mock.calls).toEqual([]);
});

test.each([{ files: [] }, { files: [".claude/tools/aidlc.ts", ".claude/tools/aidlc.ts"] }, { files: [".claude/tools/other.ts"] }])("dispatcher absence or duplicates cannot acquire source permissions", async ({ files }) => {
  const operations = fixture();
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare({ ...request, files })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings require exactly one prepared Claude dispatcher before source capability discovery" }] });
  expect(operations.spawn.mock.calls).toEqual([]);
});

test.each([
  { files: [wireFiles[0], wireFiles[0]], inputs },
  { files: [wireFiles[0], { file: ".claude/settings.local.json", bytes: [1] }], inputs },
  { files: [wireFiles[0], { file: "../settings.json", bytes: [1] }], inputs },
  { files: [wireFiles[0]], inputs },
  { files: [], inputs },
  { files: wireFiles, inputs: [...inputs, inputs[0]] },
  { files: wireFiles, inputs: [inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5], inputs[6], inputs[7], inputs[8], inputs[9], inputs[10], inputs[11], inputs[0]] },
  { files: wireFiles, inputs: [inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5], inputs[6], inputs[7], inputs[8], inputs[9], inputs[10], inputs[11], { path: "foreign.ts", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }] },
])("artifact and witness identity checks refuse count-preserving substitutions and omissions", async ({ files, inputs: witnesses }) => {
  const operations = fixture({ wire: { status: "ok", files, inputs: witnesses } });
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-harness-settings", detail: "harness settings must retain every declared source witness and exactly its two settings artifacts" }] });
});

test.each([
  { exitCode: 1, error: null, stderr: "" },
  { exitCode: null, error: "private", stderr: "" },
  { exitCode: 0, error: null, stderr: "private diagnostic" },
])("process failures and diagnostics stay bounded", async ({ exitCode, error, stderr }) => {
  const operations = fixture();
  operations.spawn.mockReturnValue({ exitCode, error, stderr, stdout: "private" });
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings process unavailable or reported diagnostics" }] });
});

test("malformed response JSON has its own explicit finding", async () => {
  const operations = fixture();
  operations.spawn.mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: "not-json" });
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-harness-settings", detail: "harness settings process must return one JSON response" }] });
});

test.each([
  { status: "unknown" },
  { status: "ok", files: [{ file: ".claude/settings.json", bytes: [256] }], inputs },
  { status: "ok", files: wireFiles, inputs: [{ path: "scripts/authored-text.ts", sha256: "not-a-digest" }] },
])("unknown protocols and malformed byte or witness values are not admitted", async (wire) => {
  const operations = fixture({ wire });
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-harness-settings", detail: "harness settings require byte artifacts and SHA-256 source witnesses or explicit unavailability" }] });
});

test.each([
  { wire: { status: "refused", detail: "native no-glob refusal" }, code: "invalid-input", detail: "native no-glob refusal" },
  { wire: { status: "unavailable", detail: "native capability unavailable" }, code: "capability-gap", detail: "native capability unavailable" },
  { wire: { status: "unavailable", detail: "harness settings require the prepared dispatcher and every declared preapproved tool exactly once before permissions can be emitted" }, code: "capability-gap", detail: "harness settings require the prepared dispatcher and every declared preapproved tool exactly once before permissions can be emitted" },
])("maps worker refusal and unavailability into distinct data findings", async ({ wire, code, detail }) => {
  const operations = fixture({ wire });
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code, subject: "source-harness-settings", detail }] });
});

test.each([{ sourceRoot: "/source", root: "/source" }, { sourceRoot: "/source", root: "/SOURCE/scratch" }, { sourceRoot: "", root: "/scratch" }])("scratch roots inside authored source refuse before process execution", async (paths) => {
  const operations = fixture();
  operations.paths.mockReturnValue(paths);
  expect(await createSourceHarnessSettingsPreparer({ operations }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings require a working root outside authored source" }] });
  expect(operations.spawn.mock.calls).toEqual([]);
});

test("revoked process capabilities return bounded failure data", async () => {
  const operations = fixture();
  const revoked = Proxy.revocable(operations.spawn, {});
  revoked.revoke();
  expect(await createSourceHarnessSettingsPreparer({ operations: { ...operations, spawn: revoked.proxy } }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-harness-settings", detail: "harness settings process capability unavailable" }] });
});
