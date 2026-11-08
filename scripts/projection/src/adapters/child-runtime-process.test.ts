import { afterEach, expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import { createAllocationFailureStorageFixture, createCleanupFailureStorageFixture, createRuntimeDirectoryFixtures, runtimeDirectoryExists, runtimeDirectoryParent } from "../../../../tests/unit/projection/support/child-runtime-fixture.ts";
import { createChildRuntimeDirectories } from "./child-runtime-directory.ts";
import { createRunnerProcess } from "./runner-process.ts";
import { createChildRuntimeProcessFactory } from "./child-runtime-process.ts";
import type { NativeCompilerProcessFactory, NativeCompilerSpawnInput } from "./native-compiler-process.ts";

const fixtures = createRuntimeDirectoryFixtures();
afterEach(fixtures.cleanup);

test("child process leases preserve command data, environment payload and reply bytes", () => {
  const parent = fixtures.create();
  const runtimeDirectories = createChildRuntimeDirectories({ parent });
  const inherited = Object.fromEntries([["PATH", "bin"], ["AIDLC_SOURCE", "authored/source"], ["AIDLC_INPUT", "input.json"], ["Temp", "nested-temp"], ["HOME", "nested-home"], ["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["XDG_CONFIG_HOME", "nested-config"]]);
  const reply = { exitCode: 7, stdout: "reply\r\n", stderr: "warning\n", error: "original failure" };
  const spawn = mock((_input: NativeCompilerSpawnInput) => reply);
  const create = mock<NativeCompilerProcessFactory>(() => ({ environment: () => inherited, spawn }));
  const processes = createChildRuntimeProcessFactory({ runtimeDirectories, create });
  const operations = processes({ timeout: 123, maxBuffer: 456 });
  const input = { binary: "bun", args: ["run", "compiler.ts"], cwd: "distribution", input: "{\"value\":1}\n", env: inherited };
  expect(operations.spawn(input)).toBe(reply);
  const actual = spawn.mock.calls[0]![0];
  const home = actual.env["HOME"]!;
  expect(runtimeDirectoryParent(home)).toBe(parent);
  expect(runtimeDirectoryExists(home)).toBe(false);
  expect({ binary: actual.binary, args: actual.args, cwd: actual.cwd, input: actual.input }).toEqual({ binary: "bun", args: ["run", "compiler.ts"], cwd: "distribution", input: "{\"value\":1}\n" });
  expect(actual.env["AIDLC_SOURCE"]).toBe("authored/source");
  expect(actual.env["AIDLC_INPUT"]).toBe("input.json");
  expect(actual.env["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]).toBe("0");
  expect(actual.env["XDG_CONFIG_HOME"]).toBe(`${home}/config`);
  expect(actual.env["TEMP"]).toBe(home);
  expect(actual.env["TMPDIR"]).toBe(home);
  expect(actual.env["BUN_TMPDIR"]).toBe(home);
  expect(actual.env["Temp"]).toBeUndefined();
  expect(inherited["Temp"]).toBe("nested-temp");
  expect(inherited["HOME"]).toBe("nested-home");
  expect(operations.environment()).toBe(inherited);
  expect(create.mock.calls).toEqual([[{ timeout: 123, maxBuffer: 456 }]]);
});

test("every compiler child gets a distinct cleaned lease from the declared owner", () => {
  const parent = fixtures.create();
  const runtimeDirectories = createChildRuntimeDirectories({ parent });
  const spawn = mock((_input: NativeCompilerSpawnInput) => ({ exitCode: 0, stdout: "ok", stderr: "", error: null }));
  const processes = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn }) });
  const input = { binary: "bun", args: [], cwd: "output", input: "", env: {} };
  processes().spawn(input);
  processes().spawn(input);
  const first = spawn.mock.calls[0]![0].env["HOME"]!;
  const second = spawn.mock.calls[1]![0].env["HOME"]!;
  expect(first).not.toBe(second);
  expect(runtimeDirectoryParent(first)).toBe(parent);
  expect(runtimeDirectoryParent(second)).toBe(parent);
  expect(runtimeDirectoryExists(first)).toBe(false);
  expect(runtimeDirectoryExists(second)).toBe(false);
});

test("allocation failure does not run a compiler or claim cleanup authority", () => {
  const fixture = createAllocationFailureStorageFixture();
  const runtimeDirectories = createChildRuntimeDirectories({ parent: "declared", storage: fixture.storage });
  const spawn = mock(collaboratorFault(new Error("must not run")));
  const operations = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn }) })();
  expect(operations.spawn({ binary: "bun", args: [], cwd: "output", input: "", env: {} })).toEqual({ exitCode: null, stdout: "", stderr: "", error: "Runtime home allocation failed: allocation failed" });
  expect(spawn).not.toHaveBeenCalled();
  expect(fixture.removed).toEqual([]);
});

test("transport failure remains visible and releases its child lease", () => {
  const parent = fixtures.create();
  const runtimeDirectories = createChildRuntimeDirectories({ parent });
  const spawn = mock<(input: NativeCompilerSpawnInput) => never>(collaboratorFault(new Error("transport failed")));
  const operations = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn }) })();
  expect(operations.spawn({ binary: "bun", args: [], cwd: "output", input: "", env: {} })).toEqual({ exitCode: null, stdout: "", stderr: "", error: "Compiler transport failed: transport failed" });
  const home = spawn.mock.calls[0]![0].env["HOME"]!;
  expect(runtimeDirectoryExists(home)).toBe(false);
});

test("cleanup failure preserves primary reply bytes and retains retry ownership", () => {
  const fixture = createCleanupFailureStorageFixture();
  const runtimeDirectories = createChildRuntimeDirectories({ parent: "declared", storage: fixture.storage });
  const reply = { exitCode: 9, stdout: "partial\r\n", stderr: "failure\n", error: "primary failure" };
  const operations = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn: () => reply }) })();
  expect(operations.spawn({ binary: "bun", args: [], cwd: "output", input: "", env: {} })).toEqual({ exitCode: 9, stdout: "partial\r\n", stderr: "failure\n", error: "primary failure\nRuntime home cleanup failed: cleanup failed" });
  fixture.recover();
  runtimeDirectories.remove({ root: "declared/owned" });
  expect(fixture.removed).toEqual(["declared/owned"]);
});

test("case aliases retain an explicit disabled transpiler cache without duplicate private keys", () => {
  const parent = fixtures.create();
  const runtimeDirectories = createChildRuntimeDirectories({ parent });
  const spawn = mock((_input: NativeCompilerSpawnInput) => ({ exitCode: 0, stdout: "", stderr: "", error: null }));
  const operations = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn }) })();
  operations.spawn({ binary: "bun", args: [], cwd: "output", input: "", env: Object.fromEntries([["bun_runtime_transpiler_cache_path", "0"]]) });
  expect(spawn.mock.calls[0]![0].env["BUN_RUNTIME_TRANSPILER_CACHE_PATH"]).toBe("0");
  expect(spawn.mock.calls[0]![0].env["bun_runtime_transpiler_cache_path"]).toBeUndefined();
});

test("cleanup failure invalidates an otherwise successful reply without changing its bytes", () => {
  const fixture = createCleanupFailureStorageFixture();
  const runtimeDirectories = createChildRuntimeDirectories({ parent: "declared", storage: fixture.storage });
  const reply = { exitCode: 0, stdout: "[]\r\n", stderr: "", error: null };
  const operations = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn: () => reply }) })();
  expect(operations.spawn({ binary: "bun", args: [], cwd: "output", input: "", env: {} })).toEqual({ exitCode: 0, stdout: "[]\r\n", stderr: "", error: "Runtime home cleanup failed: cleanup failed" });
  fixture.recover();
  runtimeDirectories.remove({ root: "declared/owned" });
  expect(fixture.removed).toEqual(["declared/owned"]);
});

test("runner consumer refuses a successful transport when owned cleanup failed", () => {
  const parent = fixtures.create();
  const fixture = createCleanupFailureStorageFixture();
  const runtimeDirectories = createChildRuntimeDirectories({ parent: "declared", storage: fixture.storage });
  const processes = createChildRuntimeProcessFactory({ runtimeDirectories, create: () => ({ environment: () => ({}), spawn: () => ({ exitCode: 0, stdout: "[]", stderr: "", error: null }) }) });
  const runner = createRunnerProcess({ processes });
  expect(runner.execute({ runtime: { root: parent, binding: { harness: "claude", directory: ".claude" } }, requests: [] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "runner compiler process unavailable: Runtime home cleanup failed: cleanup failed" }] });
  fixture.recover();
  runtimeDirectories.remove({ root: "declared/owned" });
  expect(fixture.removed).toEqual(["declared/owned"]);
});
