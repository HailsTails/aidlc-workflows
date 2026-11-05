import { expect, test } from "bun:test";
import { compilerSystemEnvironment, createNativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { systemInheritedEnvironment, systemExpectedEnvironment } from "../../__tests__/workflow-compiler-fixtures.ts";
test("retains only operating system process inputs", () => {
  expect(compilerSystemEnvironment({ inherited: systemInheritedEnvironment })).toEqual(systemExpectedEnvironment);
});
test("production process operations remain deferred", () => {
  expect(createNativeCompilerProcessOperations()).toEqual({ environment: expect.any(Function), spawn: expect.any(Function) });
});
