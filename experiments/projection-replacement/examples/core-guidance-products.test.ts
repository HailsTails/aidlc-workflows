import { expect, mock, test } from "bun:test";
import { prepareCoreGuidanceProducts, selectCoreGuidanceProducts } from "./core-guidance-products.ts";
import { createGuidanceProductServices, guidanceBasis, guidanceContext, guidanceSources, preparedProtocol, preparedGuidance, guidanceSelection, guidanceSet, guidanceProducts } from "../__tests__/core-guidance-fixtures.ts";
test("selects separate guidance identities without graph or agent metadata", () => {
  expect(selectCoreGuidanceProducts({ sources: preparedGuidance, basis: guidanceBasis, context: guidanceContext })).toEqual({ status: "ok", value: guidanceSelection });
});
test("foreign source pins cannot relabel guidance ownership", () => {
  expect(selectCoreGuidanceProducts({ sources: preparedGuidance, basis: { ...guidanceBasis, pin: "other" }, context: guidanceContext })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-guidance-products", detail: "authored guidance products must preserve the selected framework source basis" }] });
});
test("prepares guidance through existing projection and product ports", async () => {
  const services = createGuidanceProductServices();
  expect(await prepareCoreGuidanceProducts({ sourceRoot: "source", basis: guidanceBasis, context: guidanceContext, mode: 0o644, services })).toEqual({ status: "ok", value: { projection: guidanceSet, inputs: preparedGuidance.inputs, products: guidanceProducts } });
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: guidanceBasis });
  expect(services.bindings.prepare).toHaveBeenCalledWith({ sourceRoot: "source", basis: guidanceBasis, context: guidanceContext, sources: guidanceSources });
  expect(services.select).toHaveBeenCalledWith({ sources: preparedGuidance, basis: guidanceBasis, context: { harness: "claude", directory: ".claude" } });
  expect(services.project).toHaveBeenCalledWith(guidanceSelection);
  expect(services.products).toHaveBeenCalledWith({ projection: guidanceSet, sources: [guidanceBasis], compiler: guidanceBasis, mode: 0o644, rules: services.rules });
});
test("one failed guidance selection cannot publish a partial subset", async () => {
  const services = { ...createGuidanceProductServices(), project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "guidance", detail: "unknown prose token" }] }) };
  expect(await prepareCoreGuidanceProducts({ sourceRoot: "source", basis: guidanceBasis, context: guidanceContext, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "guidance", detail: "unknown prose token" }] });
  expect(services.project).toHaveBeenCalledWith(guidanceSelection);
  expect(services.products).not.toHaveBeenCalled();
});
test("binding preparation failure stops selection and publication", async () => {
  const services = { ...createGuidanceProductServices(), bindings: { prepare: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "selector unavailable" }] }) } };
  expect(await prepareCoreGuidanceProducts({ sourceRoot: "source", basis: guidanceBasis, context: guidanceContext, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "selector unavailable" }] });
  expect(services.bindings.prepare).toHaveBeenCalledWith({ sourceRoot: "source", basis: guidanceBasis, context: guidanceContext, sources: guidanceSources });
  expect(services.select).not.toHaveBeenCalled();
  expect(services.project).not.toHaveBeenCalled();
  expect(services.products).not.toHaveBeenCalled();
});
test("omitting selector provenance cannot bypass product selection", () => {
  expect(selectCoreGuidanceProducts({ sources: { ...preparedGuidance, documents: [{ ...preparedProtocol, authoring: [] }] }, basis: guidanceBasis, context: guidanceContext })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-guidance-products", detail: "authored guidance products must preserve the selected framework source basis" }] });
});
