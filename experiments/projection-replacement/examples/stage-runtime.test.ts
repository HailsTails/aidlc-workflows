import { expect, test, mock } from "bun:test";
import { prepareAuthoredStages, createStageRuntimeServices } from "./stage-runtime.ts";
import { createStageRuntimeFixture, stageWorkflow, stageRuntimeSeed, stageSet, stageAuthoring } from "../__tests__/stage-fixtures.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("authored stage preparation returns a distinct projected definition set", async () => {
  expect(await prepareAuthoredStages({ sourceRoot: "source", seed: { ...distributionSeed, invocation: "bun .claude/tools/aidlc.ts" }, workflow: stageWorkflow, mode: 0o644, services: createStageRuntimeFixture() })).toEqual({ status: "ok", value: { seed: stageRuntimeSeed, projection: stageSet, authoring: stageAuthoring, commands: null } });
});
test("source witness disagreement stops stage projection and preparation", async () => {
  const services = createStageRuntimeFixture();
  expect(await prepareAuthoredStages({ sourceRoot: "source", seed: { ...distributionSeed, invocation: "bun .claude/tools/aidlc.ts" }, workflow: stageWorkflow, mode: 0o644, services: { ...services, bind: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.project).not.toHaveBeenCalled();
  expect(services.prepare).not.toHaveBeenCalled();
});
test("production factory supplies authored input, renderer and preparation ports", () => {
  expect(createStageRuntimeServices()).toMatchObject({ reader: { load: expect.any(Function) }, bind: expect.any(Function), project: expect.any(Function), prepare: expect.any(Function), rules: { path: expect.any(Function), encode: expect.any(Function) } });
});
test("unavailable native source preparation stops projection without guessing routes", async () => {
  const services = createStageRuntimeFixture();
  expect(await prepareAuthoredStages({ sourceRoot: "source", seed: distributionSeed, workflow: stageWorkflow, mode: 0o644, services: { ...services, commandPreparation: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.project).not.toHaveBeenCalled();
  expect(services.prepare).not.toHaveBeenCalled();
});
