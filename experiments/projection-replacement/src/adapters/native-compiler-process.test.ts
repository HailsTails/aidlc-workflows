import { expect, mock, test } from "bun:test";
import { compilerSystemEnvironment, createNativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { systemInheritedEnvironment, systemExpectedEnvironment, privateExpectedEnvironment } from "../../__tests__/workflow-compiler-fixtures.ts";
import { privateCompilerEnvironment } from "./native-compiler-process.ts";
test("retains only operating system process inputs", () => {
  expect(compilerSystemEnvironment({ inherited: systemInheritedEnvironment })).toEqual(systemExpectedEnvironment);
});
test("production process operations remain deferred", () => {
  expect(createNativeCompilerProcessOperations()).toEqual({ environment: expect.any(Function), spawn: expect.any(Function) });
});
test("default limits reach the injected process transport without changing the request", () => {
  const transport = { environment: mock().mockReturnValue({ ["PATH"]: "/bin" }), spawn: mock().mockReturnValue({ exitCode: 0, stdout: "native", stderr: "", error: null }) };
  const operations = createNativeCompilerProcessOperations({ transport });
  expect(operations.environment()).toEqual({ ["PATH"]: "/bin" });
  expect(operations.spawn({ binary: "/bun", args: ["--no-install"], cwd: "/private", input: "request", env: { ["PATH"]: "/bin" } })).toEqual({ exitCode: 0, stdout: "native", stderr: "", error: null });
  expect(transport.spawn.mock.calls).toEqual([[{ binary: "/bun", args: ["--no-install"], cwd: "/private", input: "request", env: { ["PATH"]: "/bin" }, timeout: 10000, maxBuffer: 8388608 }]]);
});
test("explicit limits reach the injected transport while preserving its failure", () => {
  const transport = { environment: mock(), spawn: mock().mockReturnValue({ exitCode: null, stdout: "", stderr: "", error: "compiler timeout" }) };
  const operations = createNativeCompilerProcessOperations({ timeout: 30000, maxBuffer: 33554432, transport });
  expect(operations.spawn({ binary: "/bun", args: ["--eval", "worker"], cwd: "/private", input: "request", env: {} })).toEqual({ exitCode: null, stdout: "", stderr: "", error: "compiler timeout" });
  expect(transport.spawn.mock.calls).toEqual([[{ binary: "/bun", args: ["--eval", "worker"], cwd: "/private", input: "request", env: {}, timeout: 30000, maxBuffer: 33554432 }]]);
});

test("private compiler profiles override inherited cache paths and omit credentials", () => {
  expect(privateCompilerEnvironment({ inherited: Object.fromEntries([["PATH", "/bin"], ["HOME", "/operator"], ["Temp", "/operator/temp"], ["tMp", "/operator/tmp"], ["BUN_INSTALL_CACHE_DIR", "/operator/cache"], ["ANTHROPIC_API_KEY", "unavailable-test-placeholder"]]), root: "/private" })).toEqual(privateExpectedEnvironment);
});
