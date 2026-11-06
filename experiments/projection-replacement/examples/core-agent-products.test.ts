import { expect, mock, test } from "bun:test";
import { selectCoreAgentProducts, prepareCoreAgentProducts } from "./core-agent-products.ts";
import { coreAgentBasis, coreAgentContext, coreAgentCatalogue, coreAgentInputs, coreAgentSelection, coreAgentSet, coreAgentProducts, createCoreAgentServiceFixture } from "../__tests__/core-agent-fixtures.ts";
test.each([
  [{ basis: coreAgentBasis, context: coreAgentContext, catalogue: coreAgentCatalogue }, { status: "ok", value: coreAgentSelection }],
  [{ basis: coreAgentBasis, context: { ...coreAgentContext, invocation: "aidlc" }, catalogue: coreAgentCatalogue }, { status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-products", detail: "this core agent producer qualifies Claude Bun-copy definitions; other host policies require separate verified preparation" }] }],
  [{ basis: { ...coreAgentBasis, pin: "other" }, context: coreAgentContext, catalogue: coreAgentCatalogue }, { status: "invalid", findings: [{ code: "foreign-content", subject: "core-agent-products", detail: "agents and knowledge must preserve the framework source basis" }] }],
  [{ basis: coreAgentBasis, context: coreAgentContext, catalogue: { ...coreAgentCatalogue, artifact: { ...coreAgentCatalogue.artifact, pin: "other" } } }, { status: "invalid", findings: [{ code: "foreign-content", subject: "core-agent-products", detail: "compiled participation must bind the current framework artifact and selected harness" }] }],
] as const)("binds only qualified definitions and source-matched preparation inputs", (input, expected) => {
  expect(selectCoreAgentProducts({ sources: coreAgentInputs, ...input })).toEqual(expected);
});
test("prepares agent products through independently injected source and product services", async () => {
  const services = createCoreAgentServiceFixture();
  expect(await prepareCoreAgentProducts({ sourceRoot: "source", basis: coreAgentBasis, context: coreAgentContext, catalogue: coreAgentCatalogue, mode: 0o644, services })).toEqual({ status: "ok", value: { projection: coreAgentSet, inputs: [{ path: "core/agents/aidlc-note-agent.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { path: "core/knowledge/aidlc-note-agent/guide.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }], products: coreAgentProducts } });
  expect(services.agents.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: coreAgentBasis });
  expect(services.knowledge.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: coreAgentBasis });
  expect(services.select).toHaveBeenCalledWith({ sources: coreAgentInputs, basis: coreAgentBasis, context: coreAgentContext, catalogue: coreAgentCatalogue });
  expect(services.project).toHaveBeenCalledWith(coreAgentSelection);
  expect(services.products).toHaveBeenCalledWith({ projection: coreAgentSet, sources: [coreAgentBasis], compiler: coreAgentBasis, mode: 0o644, rules: services.rules });
});
test("an unavailable authored library prevents selection and partial products", async () => {
  const services = { ...createCoreAgentServiceFixture(), knowledge: { load: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-knowledge-sources", detail: "library unavailable" }] }) } };
  expect(await prepareCoreAgentProducts({ sourceRoot: "source", basis: coreAgentBasis, context: coreAgentContext, catalogue: coreAgentCatalogue, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-knowledge-sources", detail: "library unavailable" }] });
  expect(services.knowledge.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: coreAgentBasis });
  expect(services.select).not.toHaveBeenCalled();
  expect(services.project).not.toHaveBeenCalled();
  expect(services.products).not.toHaveBeenCalled();
});
test("native definition refusal cannot publish a partial agent set", async () => {
  const services = { ...createCoreAgentServiceFixture(), project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "agent", detail: "policy unavailable" }] }) };
  expect(await prepareCoreAgentProducts({ sourceRoot: "source", basis: coreAgentBasis, context: coreAgentContext, catalogue: coreAgentCatalogue, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "agent", detail: "policy unavailable" }] });
  expect(services.project).toHaveBeenCalledWith(coreAgentSelection);
  expect(services.products).not.toHaveBeenCalled();
});
