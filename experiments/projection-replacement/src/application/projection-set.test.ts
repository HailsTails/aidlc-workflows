import { expect, mock, test } from "bun:test";
import { createProjectionSet } from "./projection-set.ts";
import { assemblyAgent, assemblyAgentUnit, assemblyFailure, assemblyResource, assemblySet, assemblySkillUnit, assemblyTarget, createAssemblyServices, createAssemblyValidation, invalidAssemblySelections } from "../../__tests__/projection-set-fixtures.ts";
import { coreKnowledgeContext, coreKnowledgeOrigin, coreKnowledgeText, coreKnowledgeProjection, coreKnowledgeSelection, coreKnowledgeSet } from "../../__tests__/core-knowledge-fixtures.ts";
import { preparedConductor, preparedProtocol, conductorProjection, protocolProjection, guidanceSelection, guidanceSet } from "../../__tests__/core-guidance-fixtures.ts";
import { entrySelection, entrySet, entryProjection, entryMain } from "../../__tests__/harness-document-fixtures.ts";
import { coreSensorContext, coreSensorDocument, coreSensorProjection, coreSensorSet } from "../../__tests__/core-sensor-fixtures.ts";
test("sensor descriptors dispatch through their own port and atomic native collection", () => {
  const services = { ...createAssemblyServices(), sensor: mock().mockReturnValue({ status: "ok", value: coreSensorProjection }) };
  const validation = { ...createAssemblyValidation(), collect: mock().mockReturnValue({ status: "ok", value: coreSensorSet.resources }) };
  expect(createProjectionSet({ services, validation }).project({ target: { harness: "claude", directory: ".claude" }, units: [{ kind: "sensor", key: "sensor-example", input: { document: coreSensorDocument, context: coreSensorContext } }] })).toEqual({ status: "ok", value: coreSensorSet });
  expect(services.sensor.mock.calls).toEqual([[{ document: coreSensorDocument, context: coreSensorContext }]]);
  expect(services.knowledge).not.toHaveBeenCalled();
  expect(validation.collect.mock.calls).toEqual([[{ resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "Rendered sensor\n" }] }]]);
});

test("harness documents dispatch to their own renderer and common atomic collection", () => {
  const services = { ...createAssemblyServices(), harnessDocument: mock().mockReturnValue({ status: "ok", value: entryProjection }) };
  const validation = { ...createAssemblyValidation(), collect: mock().mockReturnValue({ status: "ok", value: entrySet.resources }) };
  expect(createProjectionSet({ services, validation }).project(entrySelection)).toEqual({ status: "ok", value: entrySet });
  expect(services.harnessDocument).toHaveBeenCalledWith({ document: entryMain, context: { harness: "claude", directory: ".claude" } });
  expect(services.guidance).not.toHaveBeenCalled();
});

test("guidance dispatch joins the common atomic file collection", () => {
  const services = { ...createAssemblyServices(), guidance: mock().mockReturnValueOnce({ status: "ok", value: conductorProjection }).mockReturnValueOnce({ status: "ok", value: protocolProjection }) };
  const validation = { ...createAssemblyValidation(), collect: mock().mockReturnValue({ status: "ok", value: guidanceSet.resources }) };
  expect(createProjectionSet({ services, validation }).project(guidanceSelection)).toEqual({ status: "ok", value: guidanceSet });
  expect(services.guidance).toHaveBeenNthCalledWith(1, { document: preparedConductor, context: { harness: "claude", directory: ".claude" } });
  expect(services.guidance).toHaveBeenNthCalledWith(2, { document: preparedProtocol, context: { harness: "claude", directory: ".claude" } });
  expect(validation.collect).toHaveBeenCalledWith({ resources: [{ kind: "file", path: ".claude/aidlc-common/conductor.md", body: "Rendered\n" }, { kind: "file", path: ".claude/aidlc-common/protocols/stage-protocol.md", body: "Rendered\n" }] });
});

test("knowledge selection invokes its own projector and joins native file collection", () => {
  const services = { ...createAssemblyServices(), knowledge: mock().mockReturnValue({ status: "ok", value: coreKnowledgeProjection }) };
  const validation = { ...createAssemblyValidation(), collect: mock().mockReturnValue({ status: "ok", value: coreKnowledgeProjection.resources }) };
  expect(createProjectionSet({ services, validation }).project(coreKnowledgeSelection)).toEqual({ status: "ok", value: coreKnowledgeSet });
  expect(services.knowledge).toHaveBeenCalledWith({ document: { relativePath: "aidlc-shared/guide.md", origin: coreKnowledgeOrigin, text: coreKnowledgeText }, context: coreKnowledgeContext });
  expect(validation.collect).toHaveBeenCalledWith({ resources: coreKnowledgeProjection.resources });
});

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
