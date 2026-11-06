import { expect, mock, test } from "bun:test";
import { selectCoreSkillProducts, prepareCoreSkillProducts } from "./core-skill-products.ts";
import { coreSkillBasis, coreSkillContext, coreSkillSources, coreSkillSelection, coreSkillSet, coreSkillProducts, coreSkillProductServices } from "../__tests__/core-skill-fixtures.ts";
test.each([
  [{ basis: coreSkillBasis, context: coreSkillContext }, { status: "ok", value: coreSkillSelection }],
  [{ basis: coreSkillBasis, context: { ...coreSkillContext, invocation: "aidlc" } }, { status: "invalid", findings: [{ code: "capability-gap", subject: "core-skill-products", detail: "this producer qualifies authored skill text for Bun copy delivery; native-release command preparation requires a separate verified capability" }] }],
  [{ basis: { ...coreSkillBasis, pin: "other" }, context: coreSkillContext }, { status: "invalid", findings: [{ code: "foreign-content", subject: "core-skill-products", detail: "authored core skill products must preserve the selected framework source basis" }] }],
] as const)("selects core skill products from explicit source and delivery facts", (input, expected) => {
  expect(selectCoreSkillProducts({ sources: coreSkillSources, ...input })).toEqual(expected);
});
test("preparation returns projected products with independent authored-input witnesses", async () => {
  const services = coreSkillProductServices();
  expect(await prepareCoreSkillProducts({ sourceRoot: "source", basis: coreSkillBasis, context: coreSkillContext, mode: 0o644, services })).toEqual({ status: "ok", value: { projection: coreSkillSet, inputs: coreSkillSources.inputs, products: coreSkillProducts } });
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: coreSkillBasis });
  expect(services.select).toHaveBeenCalledWith({ sources: coreSkillSources, basis: coreSkillBasis, context: coreSkillContext });
  expect(services.project).toHaveBeenCalledWith(coreSkillSelection);
  expect(services.products).toHaveBeenCalledWith({ projection: coreSkillSet, sources: [coreSkillBasis], compiler: coreSkillBasis, mode: 0o644, rules: services.rules });
});
test("a projection failure produces no subset of otherwise prepared skill products", async () => {
  const services = { ...coreSkillProductServices(), project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "skill", detail: "invalid authored metadata" }] }) };
  expect(await prepareCoreSkillProducts({ sourceRoot: "source", basis: coreSkillBasis, context: coreSkillContext, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "skill", detail: "invalid authored metadata" }] });
  expect(services.project).toHaveBeenCalledWith(coreSkillSelection);
  expect(services.products).not.toHaveBeenCalled();
});
