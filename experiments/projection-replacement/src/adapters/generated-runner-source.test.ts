import { expect, test } from "bun:test";
import { runner, runnerOrigin, runnerBinding, runnerRequest, runnerFrame, runnerDecoded, runnerFailure } from "../../__tests__/runner-fixtures.ts";
import { parseGeneratedRunner } from "./generated-runner-source.ts";
test("generated metadata is parsed through the injected framing owner", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: runner.owner, binding: runnerBinding, request: runnerRequest, reader: { read: () => ({ status: "ok", value: runnerFrame }) } })).toEqual({ status: "ok", value: runner });
});
test("source-native suppression survives parsing", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: runner.owner, binding: runnerBinding, request: runnerRequest, reader: { read: () => ({ status: "ok", value: { ...runnerFrame, decoded: { ...runnerDecoded, "disable-model-invocation": true } } }) } })).toEqual({ status: "ok", value: { ...runner, frontmatterInvocation: "disabled" } });
});
test("explicit enablement is distinct from an absent field", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: runner.owner, binding: runnerBinding, request: runnerRequest, reader: { read: () => ({ status: "ok", value: { ...runnerFrame, decoded: { ...runnerDecoded, "disable-model-invocation": false } } }) } })).toEqual({ status: "ok", value: { ...runner, frontmatterInvocation: "enabled" } });
});
test("definition ownership stays separate from the core compiler origin", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: { kind: "plugin", id: "aidlc-tools" }, binding: runnerBinding, request: runnerRequest, reader: { read: () => ({ status: "ok", value: runnerFrame }) } })).toEqual({ status: "ok", value: { ...runner, owner: { kind: "plugin", id: "aidlc-tools" } } });
});
test("framing failures retain their specific guidance", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: runner.owner, binding: runnerBinding, request: runnerRequest, reader: { read: () => runnerFailure } })).toEqual(runnerFailure);
});
test("unowned runner hooks refuse instead of being silently discarded", () => {
  expect(parseGeneratedRunner({ markdown: "input", compiler: runnerOrigin, owner: runner.owner, binding: runnerBinding, request: runnerRequest, reader: { read: () => ({ status: "ok", value: { ...runnerFrame, decoded: { ...runnerDecoded, hooks: {} } } }) } })).toMatchObject({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/tools/aidlc-runner-gen.ts", detail: expect.stringContaining("hooks") }] });
});
