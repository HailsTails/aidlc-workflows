import { expect, mock, test } from "bun:test";
import { createProjectionSet } from "./projection-set.ts";
import { assemblyAgent, assemblyAgentUnit, assemblyFailure, assemblyResource, assemblySet, assemblySkillUnit, assemblyTarget, createAssemblyServices, createAssemblyValidation, invalidAssemblySelections } from "../../__tests__/projection-set-fixtures.ts";

test("retains unit metadata and collected files", () => {
  const services = createAssemblyServices(), validation = createAssemblyValidation();
  expect(createProjectionSet({ services, validation }).project({ target: assemblyTarget, units: [assemblyAgentUnit] })).toEqual({ status: "ok", value: assemblySet });
  expect(services.agent).toHaveBeenCalledWith(assemblyAgentUnit.input);
  expect(validation.collect).toHaveBeenCalledWith({ resources: [assemblyResource] });
});
test.each(invalidAssemblySelections)("rejects $name before invoking projectors", ({ units, code, subject, detail }) => {
  const services = createAssemblyServices(), validation = createAssemblyValidation();
  expect(createProjectionSet({ services, validation }).project({ target: assemblyTarget, units })).toEqual<unknown>({ status: "invalid", findings: [{ code, subject, detail }] });
  expect(services.agent).not.toHaveBeenCalled();
  expect(services.skill).not.toHaveBeenCalled();
  expect(validation.collect).not.toHaveBeenCalled();
});
test("returns every selected failure atomically", () => {
  const agent = mock().mockReturnValue(assemblyFailure), skill = mock().mockReturnValue(assemblyFailure);
  const validation = createAssemblyValidation();
  expect(createProjectionSet({ services: { ...createAssemblyServices(), agent, skill }, validation }).project({ target: assemblyTarget, units: [assemblyAgentUnit, assemblySkillUnit] })).toEqual({ status: "invalid", findings: [...assemblyFailure.findings, ...assemblyFailure.findings] });
  expect(skill).toHaveBeenCalledTimes(1);
  expect(validation.collect).not.toHaveBeenCalled();
});
test("refuses a projector returning another harness", () => {
  const agent = mock().mockReturnValue({ status: "ok", value: { ...assemblyAgent, harness: "cursor" } });
  expect(createProjectionSet({ services: { ...createAssemblyServices(), agent }, validation: createAssemblyValidation() }).project({ target: assemblyTarget, units: [assemblyAgentUnit] })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "metrics", detail: "projected unit returned content for another harness" }] });
});
test("refuses an empty selected product", () => {
  const agent = mock().mockReturnValue({ status: "ok", value: { ...assemblyAgent, resources: [] } });
  expect(createProjectionSet({ services: { ...createAssemblyServices(), agent }, validation: createAssemblyValidation() }).project({ target: assemblyTarget, units: [assemblyAgentUnit] })).toEqual({ status: "invalid", findings: [{ code: "missing-body", subject: "metrics", detail: "a selected projection unit must produce native files" }] });
});
test("propagates file ownership conflicts", () => {
  const collect = mock().mockReturnValue(assemblyFailure);
  expect(createProjectionSet({ services: createAssemblyServices(), validation: { ...createAssemblyValidation(), collect } }).project({ target: assemblyTarget, units: [assemblyAgentUnit] })).toEqual(assemblyFailure);
});
test("rejects unsafe destinations and unresolved content together", () => {
  const path = mock().mockReturnValue("unsafe"), residue = mock().mockReturnValue(assemblyFailure.findings);
  expect(createProjectionSet({ services: createAssemblyServices(), validation: { ...createAssemblyValidation(), path, residue } }).project({ target: assemblyTarget, units: [assemblyAgentUnit] })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/agents/test-pro-metrics-agent.md", detail: "projection assembly requires safe relative file destinations" }, ...assemblyFailure.findings] });
});
