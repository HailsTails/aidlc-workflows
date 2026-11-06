import { expect, test, mock } from "bun:test";
import { prepareAuthoredScopes, createScopeRuntimeServices } from "./scope-runtime.ts";
import { createScopeRuntimeFixture, scopeWorkflow, scopeSet, scopeRuntimeSeed } from "../__tests__/scope-fixtures.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("authored scope preparation returns its projection separately from the runtime snapshot", async () => {
  expect(await prepareAuthoredScopes({ sourceRoot: "source", seed: distributionSeed, workflow: scopeWorkflow, mode: 0o644, services: createScopeRuntimeFixture() })).toEqual({ status: "ok", value: { seed: scopeRuntimeSeed, projection: scopeSet } });
});
test("a source disagreement stops projection rather than composing a stale grid", async () => {
  const services = createScopeRuntimeFixture();
  expect(await prepareAuthoredScopes({ sourceRoot: "source", seed: distributionSeed, workflow: scopeWorkflow, mode: 0o644, services: { ...services, bind: mock().mockReturnValue(runnerFailure) } })).toEqual(runnerFailure);
  expect(services.project).not.toHaveBeenCalled();
  expect(services.prepare).not.toHaveBeenCalled();
});
test("the production factory composes authored input and projection ports", () => {
  expect(createScopeRuntimeServices()).toMatchObject({ reader: { load: expect.any(Function) }, bind: expect.any(Function), project: expect.any(Function), prepare: expect.any(Function) });
});
