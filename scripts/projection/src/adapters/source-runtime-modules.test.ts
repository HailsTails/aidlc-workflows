import { expect, mock, test } from "bun:test";
import { createSourceRuntimeModulePreparer } from "./source-runtime-modules.ts";
const request = { sourceRoot: "/source", root: "/work", basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, binding: { harness: "claude", directory: ".claude" }, invocation: "bun .claude/tools/aidlc.ts", mode: 420 } as const;
const inputs = [
  {
    "path": "scripts/projection-text.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "scripts/version-module.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "core/tools/aidlc-command.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "core/tools/aidlc-version.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "core/tools/aidlc-channel.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "scripts/native-runtime-text.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "scripts/native-command-context.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "scripts/native-command-text.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "core/tools/aidlc-routes.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  {
    "path": "scripts/runtime-source-selection.ts",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
];
const paths = () => ({ sourceRoot: "/source", root: "/work" });
const environment = () => ({});

test("ordinary runtime payload retains witnessed test-only source inputs", async () => {
  const spawn = mock().mockReturnValue({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: ["tools/aidlc-command.ts"], files: [{ file: "tools/aidlc-command.ts", content: "runtime bytes" }], inputs: [...inputs, { path: "core/tools/aidlc-command.test.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }) });
  const prepared = await createSourceRuntimeModulePreparer({ operations: { spawn, paths, environment } }).prepare(request);
  expect(prepared).toEqual({ status: "ok", value: { files: [{ path: ".claude/tools/aidlc-command.ts", bytes: new Uint8Array([114, 117, 110, 116, 105, 109, 101, 32, 98, 121, 116, 101, 115]), mode: 420 }], preparation: { kind: "runtime-modules", paths: [".claude/tools/aidlc-command.ts"], inputs: [...inputs, { path: "core/tools/aidlc-command.test.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] } } });
  expect(spawn).toHaveBeenCalledTimes(1);
});

test.each(["tools/aidlc-shell.test.ts", "tools/dependency-assessment/workflow.test.ts", "hooks/aidlc-hook.test.ts"])("transport cannot admit a test source as a selected runtime module: %s", async path => {
  const spawn = mock().mockReturnValue({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: [path], files: [{ file: path, content: "unshipped test" }], inputs: [...inputs, { path: `core/${path}`, sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }) });
  expect(await createSourceRuntimeModulePreparer({ operations: { spawn, paths, environment } }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" }] });
});

test("transport cannot append a test artifact outside its module list", async () => {
  const spawn = mock().mockReturnValue({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: ["tools/aidlc-command.ts"], files: [{ file: "tools/aidlc-command.ts", content: "runtime bytes" }, { file: "tools/aidlc-command.test.ts", content: "unshipped test" }], inputs }) });
  expect(await createSourceRuntimeModulePreparer({ operations: { spawn, paths, environment } }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime module outputs require unique safe tools/hooks resources" }] });
});

test("transport must witness the runtime selection policy", async () => {
  const spawn = mock().mockReturnValue({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: ["tools/aidlc-command.ts"], files: [{ file: "tools/aidlc-command.ts", content: "runtime bytes" }], inputs: [{"path":"scripts/projection-text.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"scripts/version-module.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"core/tools/aidlc-command.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"core/tools/aidlc-version.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"core/tools/aidlc-channel.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"scripts/native-runtime-text.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"scripts/native-command-context.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"scripts/native-command-text.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"path":"core/tools/aidlc-routes.ts","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}] }) });
  expect(await createSourceRuntimeModulePreparer({ operations: { spawn, paths, environment } }).prepare(request)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-runtime-modules", detail: "runtime modules require complete unique safe core/tools, core/hooks, core/projection and scripts witnesses including all native APIs" }] });
});
