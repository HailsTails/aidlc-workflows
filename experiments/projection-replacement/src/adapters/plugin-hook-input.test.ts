import { expect, test } from "bun:test";
import { createPluginHookInputReader } from "./plugin-hook-input.ts";
import { hookInputOperations } from "../../__tests__/plugin-hook-fixtures.ts";

test("reads inventories as portable paths and preserves declared source pins", async () => {
  expect(await createPluginHookInputReader({ operations: hookInputOperations }).read({ argv: ["request.json"] })).toEqual({ status: "ok", value: {
    location: { sourceRoot: "/source", sourcePin: "1111111111111111111111111111111111111111", binding: { harness: "claude", directory: ".claude" }, plugin: { id: "example", root: "/plugin", pin: "2222222222222222222222222222222222222222" }, runtime: { root: "/runtime", pin: "3333333333333333333333333333333333333333" } },
    request: { binding: { harness: "claude", directory: ".claude" }, declaration: { origin: { source: { kind: "plugin", id: "example" }, pin: "2222222222222222222222222222222222222222", path: ".aidlc-plugin/plugin.json" }, text: '{"name":"example"}' }, runtime: { basis: { source: { kind: "plugin", id: "example" }, pin: "3333333333333333333333333333333333333333" }, authoredFiles: ["hooks/guard.ts"], projectedFiles: ["hooks/guard.ts", "hooks/helper.ts"] } },
  } });
});
test("missing command input returns usage", async () => {
  expect(await createPluginHookInputReader({ operations: hookInputOperations }).read({ argv: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-hooks", detail: "usage: project:hooks <request.json>; output is a native plugin contribution file on stdout" }] });
});
test("malformed request JSON is an input violation", async () => {
  expect(await createPluginHookInputReader({ operations: { ...hookInputOperations, read: async () => "{" } }).read({ argv: ["request.json"] })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "plugin-hooks", detail: "hook projection request must contain valid JSON" }] });
});
test("valid JSON without pinned locations cannot start native projection", async () => {
  expect(await createPluginHookInputReader({ operations: { ...hookInputOperations, read: async () => "{}" } }).read({ argv: ["request.json"] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-hooks", detail: "hook projection requires pinned compiler/plugin/runtime roots and an explicit harness binding" }] });
});
