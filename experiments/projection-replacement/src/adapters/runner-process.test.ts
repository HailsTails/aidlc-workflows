import { expect, test } from "bun:test";
import { createProcessFixture, runnerRuntime } from "../../__tests__/runner-fixtures.ts";
import { createRunnerProcess, createRunnerProcessOperations } from "./runner-process.ts";

test("composition: production paths keep scratch home outside the native distribution", () => {
  expect(createRunnerProcessOperations().paths({ runtime: runnerRuntime }).home).toEndWith("/../.runner-home/claude");
  expect(createRunnerProcessOperations().paths({ runtime: runnerRuntime }).root).toEqual(expect.stringMatching(/^(?:[A-Za-z]:\\|\/).*isolated[\\/]runtime$/));
});
test("process uses isolated runtime and scrubs inherited credentials and source overrides", () => {
  const fixture = createProcessFixture();
  expect(createRunnerProcess({ binary: "local-bun", operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [] })).toEqual({ status: "ok", value: [] });
  expect(fixture.calls).toHaveLength(1);
  expect(fixture.calls[0]?.binary).toBe("local-bun");
  expect(fixture.calls[0]?.cwd).toBe("isolated/runtime");
  expect(fixture.calls[0]?.args[0]).toBe("--no-install");
  expect(fixture.calls[0]?.env).toEqual(Object.fromEntries([["PATH", "bin"], ["HOME", "isolated/home"], ["USERPROFILE", "isolated/home"], ["APPDATA", "isolated/home"], ["LOCALAPPDATA", "isolated/home"], ["XDG_CONFIG_HOME", "isolated/home"], ["AIDLC_RUNTIME_PROJECT_DIR", "isolated/runtime"], ["AIDLC_PROJECT_DIR", "isolated/runtime"], ["AIDLC_HARNESS_DIR", ".claude"], ["AIDLC_HARNESS_NAME", "claude"], ["AIDLC_STAGE_GRAPH", "isolated/graph.json"]]));
  expect(fixture.calls[0]?.input).toBe('{"root":"isolated/runtime","binding":{"harness":"claude","directory":".claude"},"moduleUrl":"file:///compiler.ts","pathsUrl":"file:///paths.ts","requests":[]}');
});
test("failed process returns unavailability guidance", () => {
  const fixture = createProcessFixture({ reply: { exitCode: 1, stdout: "", stderr: "missing runtime", error: null } });
  expect(createRunnerProcess({ operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "runner compiler process unavailable: missing runtime" }] });
});
test("spawn failures remain plain findings", () => {
  const fixture = createProcessFixture({ reply: { exitCode: null, stdout: "", stderr: "", error: "not installed" } });
  expect(createRunnerProcess({ operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "runner compiler process unavailable: not installed" }] });
});
test("compiler diagnostics cannot masquerade as the response", () => {
  const fixture = createProcessFixture({ reply: { exitCode: 0, stdout: "notice\n[]", stderr: "", error: null } });
  expect(createRunnerProcess({ operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [] })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "claude", detail: "runner compiler must return one JSON response without surrounding output" }] });
});
test("discovery shares the isolated compiler process and selects its explicit read-only protocol", () => {
  const fixture = createProcessFixture();
  expect(createRunnerProcess({ operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [], intent: "discover" })).toEqual({ status: "ok", value: [] });
  expect(fixture.calls[0]?.input).toBe('{"root":"isolated/runtime","binding":{"harness":"claude","directory":".claude"},"moduleUrl":"file:///compiler.ts","pathsUrl":"file:///paths.ts","requests":[],"intent":"discover"}');
  expect(fixture.calls[0]?.env).not.toHaveProperty("SECRET");
  expect(fixture.calls[0]?.env).not.toHaveProperty("AIDLC_SCOPES_DIR");
});
test("a successful exit with native discovery warnings is not accepted as complete empty requirements", () => {
  const fixture = createProcessFixture({ reply: { exitCode: 0, stdout: "[]", stderr: "Warning: scope directory not readable", error: null } });
  expect(createRunnerProcess({ operations: fixture.operations }).execute({ runtime: runnerRuntime, requests: [], intent: "discover" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "native runner discovery reported diagnostics; no complete requirement set was accepted: Warning: scope directory not readable" }] });
});
