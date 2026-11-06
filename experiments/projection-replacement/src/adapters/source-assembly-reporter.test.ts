import { expect, mock, test } from "bun:test";
import { createSourceAssemblyReporter } from "./source-assembly-reporter.ts";
import { assemblyFailure } from "../../__tests__/projection-set-fixtures.ts";
test("writes successful content and completes successfully", () => {
  const write = mock(), complete = mock();
  createSourceAssemblyReporter({ operations: { write, complete } }).finish({ outcome: { status: "ok", value: "native\n" } });
  expect(write).toHaveBeenCalledWith({ channel: "out", text: "native\n" });
  expect(complete).toHaveBeenCalledWith({ exitCode: 0 });
});
test("writes actionable findings and completes with failure", () => {
  const write = mock(), complete = mock();
  createSourceAssemblyReporter({ operations: { write, complete } }).finish({ outcome: assemblyFailure });
  expect(write).toHaveBeenCalledWith({ channel: "error", text: "capability-gap: restricted-agent: authored permission has no verified native mapping\n" });
  expect(complete).toHaveBeenCalledWith({ exitCode: 1 });
});
