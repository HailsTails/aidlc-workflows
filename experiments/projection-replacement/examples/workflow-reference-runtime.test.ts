import { scopeSet } from "../__tests__/scope-fixtures.ts";
import { expect, mock, test } from "bun:test";
import { prepareCompiledWorkflowReferenceRuntime, createWorkflowReferenceRuntimeServices } from "./workflow-reference-runtime.ts";
import { createWorkflowReferenceRuntimeFixture, referenceInputs, referenceTextFile, referenceHydratedSeed } from "../__tests__/workflow-reference-runtime-fixtures.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { runtimeWorkflow } from "../__tests__/workflow-runtime-fixtures.ts";
import { stageAuthoring } from "../__tests__/stage-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { planPreparedFileAdditions } from "../src/domain/prepared-file-additions.ts";
test("prepares a fresh compiled reference in a private runtime and admits it as prepared data", async () => {
  const services = createWorkflowReferenceRuntimeFixture();
  expect(await prepareCompiledWorkflowReferenceRuntime({ sourceRoot: "source", seed: distributionSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring, mode: 0o644, services })).toEqual({ status: "ok", value: { seed: referenceHydratedSeed, preparation: { kind: "prepared", paths: [".claude/skills/aidlc/tables.md"], inputs: referenceInputs } } });
  expect(services.workspace.run).toHaveBeenCalledWith({ sourceRoot: "source", seed: distributionSeed, consume: expect.any(Function) });
  expect(services.preparer.prepare).toHaveBeenCalledWith({ sourceRoot: "source", root: "private-reference", basis: distributionSeed.basis, context: { ...distributionSeed.binding, invocation: "aidlc", rulesSubdir: "rules", optionLetters: stageAuthoring.optionLetters }, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring });
  expect(services.admit).toHaveBeenCalledWith({ candidates: [referenceTextFile], inventory: distributionSeed, mode: 0o644, rules: services.rules });
});
test("missing stage authoring refuses before allocating a reference runtime", async () => {
  const services = createWorkflowReferenceRuntimeFixture();
  expect(await prepareCompiledWorkflowReferenceRuntime({ sourceRoot: "source", seed: distributionSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: null, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-reference", detail: "compiled workflow reference preparation requires fresh authored stage context; select project-authored stages" }] });
  expect(services.workspace.run).not.toHaveBeenCalled();
});
test("source refusal prevents reference file admission", async () => {
  const services = { ...createWorkflowReferenceRuntimeFixture(), preparer: { prepare: mock().mockResolvedValue(runnerFailure) } };
  expect(await prepareCompiledWorkflowReferenceRuntime({ sourceRoot: "source", seed: distributionSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.admit).not.toHaveBeenCalled();
});
test("private runtime failure cannot be replaced by retained reference bytes", async () => {
  const services = { ...createWorkflowReferenceRuntimeFixture(), workspace: { run: mock().mockResolvedValue(runnerFailure) } };
  expect(await prepareCompiledWorkflowReferenceRuntime({ sourceRoot: "source", seed: distributionSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring, mode: 0o644, services })).toEqual(runnerFailure);
  expect(services.preparer.prepare).not.toHaveBeenCalled();
  expect(services.admit).not.toHaveBeenCalled();
});
test("changed reference destination remains a refusal", async () => {
  const services = { ...createWorkflowReferenceRuntimeFixture(), admit: mock().mockReturnValue(runnerFailure) };
  expect(await prepareCompiledWorkflowReferenceRuntime({ sourceRoot: "source", seed: distributionSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring, mode: 0o644, services })).toEqual(runnerFailure);
});
test("reference runtime factory uses the existing admission owner", () => {
  expect(createWorkflowReferenceRuntimeServices()).toMatchObject({ admit: planPreparedFileAdditions });
});
