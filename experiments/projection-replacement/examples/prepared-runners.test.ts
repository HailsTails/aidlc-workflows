import { expect, mock, test } from "bun:test";
import { prepareProducerRunners, createPreparedRunnerServices } from "./prepared-runners.ts";
import { createPreparedRunnerServicesFixture, preparedLocation, preparedContext, preparedInputSnapshot, preparedProjection, unsupportedPreparedRequirements } from "../__tests__/prepared-runner-fixtures.ts";
import { generatedRequirements, nativeRequirements } from "../__tests__/runner-requirement-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("projects complete prepared definitions without constructing a completed seed", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services })).toEqual({ status: "ok", value: { inputSnapshot: preparedInputSnapshot, requirements: generatedRequirements, projection: preparedProjection } });
  expect(services.project).toHaveBeenCalledWith({ runners: generatedRequirements.runners, context: preparedContext });
});
test("input refusal stops native discovery and rendering", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services: { ...services, source: { load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.factory).not.toHaveBeenCalled();
  expect(services.project).not.toHaveBeenCalled();
});
test("native refusal stops rendering", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services: { ...services, discover: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.project).not.toHaveBeenCalled();
});
test("a narrower catalogue cannot become complete producer candidates", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services: { ...services, discover: mock().mockReturnValue({ status: "ok", value: nativeRequirements }) } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "prepared-runner-inputs", detail: "producer candidates require complete native generated-runner coverage" }] });
  expect(services.project).not.toHaveBeenCalled();
});
test("rendering refusal is retained without partial candidates", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services: { ...services, project: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
});
test("native layout observation does not authorize emitting candidates at a different root", async () => {
  const services = createPreparedRunnerServicesFixture();
  expect(await prepareProducerRunners({ location: preparedLocation, context: preparedContext, services: { ...services, discover: mock().mockReturnValue({ status: "ok", value: unsupportedPreparedRequirements }) } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/legacy-skills", detail: "prepared native skill layout is unsupported by the renderer; no candidate files were accepted" }] });
});
test("production services expose the existing compiler and renderer through ports", () => {
  expect(createPreparedRunnerServices()).toMatchObject({ source: { load: expect.any(Function) }, factory: expect.any(Function), discover: expect.any(Function), rules: { path: expect.any(Function), digest: expect.any(Function) }, project: expect.any(Function) });
});
