import { expect, test } from "bun:test";
import { prepareWorkflowRuntime } from "./workflow-runtime.ts";
import { workflowRuntimeRequest, hydratedWorkflowSeed, graphRuntimeFile, conflictingWorkflowSeed } from "../../__tests__/workflow-runtime-fixtures.ts";
import { distributionSeed } from "../../__tests__/distribution-fixtures.ts";
test("prepares only compiler graph and grid without claiming native runtime products", () => {
  expect(prepareWorkflowRuntime(workflowRuntimeRequest)).toEqual({ status: "ok", value: { seed: hydratedWorkflowSeed, compiledPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"], addedPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"] } });
});
test("equal compiled bytes are accepted without changing existing modes", () => {
  expect(prepareWorkflowRuntime({ ...workflowRuntimeRequest, seed: { ...distributionSeed, files: [...distributionSeed.files, { ...graphRuntimeFile, mode: 0o755 }] } })).toMatchObject({ status: "ok", value: { addedPaths: [".claude/tools/data/scope-grid.json"], seed: { files: expect.arrayContaining([{ ...graphRuntimeFile, mode: 0o755 }]) } } });
});
test("existing different compiler data is preserved rather than silently regenerated", () => {
  expect(prepareWorkflowRuntime({ ...workflowRuntimeRequest, seed: conflictingWorkflowSeed })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/tools/data/stage-graph.json", detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" }] });
});
test("cross-pin workflow data cannot fill an otherwise missing runtime input", () => {
  expect(prepareWorkflowRuntime({ ...workflowRuntimeRequest, workflow: { ...workflowRuntimeRequest.workflow, compiler: { ...workflowRuntimeRequest.workflow.compiler, pin: "different-pin" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-runtime", detail: "core workflow compiler and its two declared outputs must match the native runtime source basis and destinations" }] });
});
test("a matching source does not grant the compiler arbitrary tools metadata destinations", () => {
  expect(prepareWorkflowRuntime({ ...workflowRuntimeRequest, workflow: { ...workflowRuntimeRequest.workflow, graph: { ...workflowRuntimeRequest.workflow.graph, origin: { ...workflowRuntimeRequest.workflow.graph.origin, path: ".claude/tools/data/harness.json" } } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-runtime", detail: "core workflow compiler and its two declared outputs must match the native runtime source basis and destinations" }] });
});
test("binding disagreement is explicit before file admission", () => {
  expect(prepareWorkflowRuntime({ ...workflowRuntimeRequest, workflow: { ...workflowRuntimeRequest.workflow, binding: { harness: "cursor", directory: ".cursor" } } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "workflow-runtime", detail: "compiled workflow and native runtime must have the same harness binding" }] });
});
