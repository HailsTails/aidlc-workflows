import { expect, test, mock } from "bun:test";
import { runner, runnerOrigin, runnerRuntime, runnerRequest, runnerFailure } from "../../__tests__/runner-fixtures.ts";
import { createLegacyRunnerCompiler } from "./legacy-runner-compiler.ts";
test("compiler decodes an ordered response through injected parser", () => {
  const compiler = createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", owner: { kind: "core", id: "framework" }, key: "init", markdown: "source" }] }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } });
  expect(compiler.compile({ requests: [runnerRequest] })).toEqual({ status: "ok", value: [runner] });
});
test("process failure does not become an empty successful compilation", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => runnerFailure }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual(runnerFailure);
});
test("wrong response identity refuses even when Markdown would parse", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", owner: { kind: "core", id: "framework" }, key: "compose", markdown: "source" }] }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-runner-gen.ts", detail: "runner compiler response must match every requested identity in order" }] });
});
test("unavailable graph members retain source guidance", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "unavailable", key: "init", detail: "stage absent" }] }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "init", detail: "stage absent" }] });
});
test("malformed response envelopes refuse", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: { status: "ok" } }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-runner-gen.ts", detail: "runner compiler returned an invalid response envelope" }] });
});
test("metadata failures refuse the compilation", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", owner: { kind: "core", id: "framework" }, key: "init", markdown: "source" }] }) }, rules: { key: () => "init", parse: () => runnerFailure } }).compile({ requests: [runnerRequest] })).toEqual(runnerFailure);
});
test("validated plugin ownership reaches the parser without inferring it from the compiler or name", () => {
  const parse = mock().mockReturnValue({ status: "ok", value: { ...runner, owner: { kind: "plugin", id: "aidlc-tools" } } });
  const compiler = createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", owner: { kind: "plugin", id: "aidlc-tools" }, key: "init", markdown: "source" }] }) }, rules: { key: () => "init", parse } });
  expect(compiler.compile({ requests: [runnerRequest] })).toEqual({ status: "ok", value: [{ ...runner, owner: { kind: "plugin", id: "aidlc-tools" } }] });
  expect(parse).toHaveBeenCalledWith({ markdown: "source", compiler: runnerOrigin, owner: { kind: "plugin", id: "aidlc-tools" }, binding: { harness: "claude", directory: ".claude" }, request: { kind: "init" } });
  expect(parse).toHaveBeenCalledTimes(1);
});
test("missing ownership refuses rather than defaulting a plugin definition to core", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", key: "init", markdown: "source" }] }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-runner-gen.ts", detail: "runner compiler returned an invalid response envelope" }] });
});
test("unsafe plugin identities refuse at the process boundary", () => {
  expect(createLegacyRunnerCompiler({ runtime: runnerRuntime, compiler: runnerOrigin, process: { execute: () => ({ status: "ok", value: [{ status: "ok", owner: { kind: "plugin", id: "../outside" }, key: "init", markdown: "source" }] }) }, rules: { key: () => "init", parse: () => ({ status: "ok", value: runner }) } }).compile({ requests: [runnerRequest] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-runner-gen.ts", detail: "runner compiler returned an invalid response envelope" }] });
});
