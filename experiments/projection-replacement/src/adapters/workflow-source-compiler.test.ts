import { expect, mock, test } from "bun:test";
import { createWorkflowSourceCompiler, createWorkflowCompilerOperations } from "./workflow-source-compiler.ts";
import { createWorkflowCompilerFixture, createInvalidWorkflowLocations, workflowLocation, compiledWorkflow, workflowReply, workflowExpectedEnvironmentFragment, workflowUnsafeEnvironmentFragment } from "../../__tests__/workflow-compiler-fixtures.ts";
test("returns native workflow data with separate compiler and output provenance", () => {
  expect(createWorkflowSourceCompiler({ operations: createWorkflowCompilerFixture() }).compile({ location: workflowLocation })).toEqual({ status: "ok", value: compiledWorkflow });
});
test("isolates source compiler inputs from inherited credentials and runtime selection", () => {
  const operations = createWorkflowCompilerFixture();
  createWorkflowSourceCompiler({ operations }).compile({ location: workflowLocation });
  expect(operations.spawn).toHaveBeenCalledWith(expect.objectContaining({ binary: "bun", cwd: "private-root", env: expect.objectContaining(workflowExpectedEnvironmentFragment) }));
  expect(operations.spawn).not.toHaveBeenCalledWith(expect.objectContaining({ env: expect.objectContaining(workflowUnsafeEnvironmentFragment) }));
});
test("native diagnostics do not become successful prepared workflow data", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, spawn: mock().mockReturnValue({ exitCode: 0, stdout: JSON.stringify(workflowReply), stderr: "unsupported source declaration", error: null }) } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-source-compiler", detail: "native workflow compilation unavailable or reported diagnostics: unsupported source declaration" }] });
});
test("explicit source preparation unavailability retains useful guidance", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, spawn: mock().mockReturnValue({ exitCode: 0, stdout: '{"status":"unavailable","detail":"use a fresh context"}', stderr: "", error: null }) } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-source-compiler", detail: "use a fresh context" }] });
});
test("a native declaration refusal is distinct from unavailable process capability", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, spawn: mock().mockReturnValue({ exitCode: 0, stdout: '{"status":"refused","detail":"unknown support agent aidlc-quality-agent"}', stderr: "", error: null }) } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-source-compiler", detail: "native compiler refused the source context: unknown support agent aidlc-quality-agent" }] });
});
test("an invalid compiler envelope cannot masquerade as an empty graph", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, spawn: mock().mockReturnValue({ exitCode: 0, stdout: "[]", stderr: "", error: null }) } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-source-compiler", detail: "native workflow compiler requires graph/grid text and safe source digests, or an explicit refusal/unavailability finding" }] });
});
test("the compiler source witness cannot be omitted", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, spawn: mock().mockReturnValue({ exitCode: 0, stdout: '{"status":"ok","graph":"[]","grid":"{}","inputs":[{"path":"core/scopes/bugfix.md","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}', stderr: "", error: null }) } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-source-compiler", detail: "workflow source digests must identify the compiler and each source input once" }] });
});
test("production operations expose shared native process and source path capabilities", () => {
  expect(createWorkflowCompilerOperations()).toMatchObject({ environment: expect.any(Function), spawn: expect.any(Function), locations: expect.any(Function) });
});
test("invalid context preparation becomes a finding before spawning", () => {
  const operations = createWorkflowCompilerFixture();
  expect(createWorkflowSourceCompiler({ operations: { ...operations, locations: createInvalidWorkflowLocations() } }).compile({ location: workflowLocation })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-source-compiler", detail: "workflow source process could not be prepared: invalid context root" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
