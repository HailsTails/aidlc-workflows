import { expect, mock, test } from "bun:test";
import { selectCoreKnowledgeProducts, prepareCoreKnowledgeProducts, createCoreKnowledgeProductServices } from "./core-knowledge-products.ts";
import { createCoreKnowledgeSourceReader } from "../src/adapters/core-knowledge-sources.ts";
import { coreKnowledgeBasis, coreKnowledgeContext, coreKnowledgeSources, coreKnowledgeSelection, coreKnowledgeSet, coreKnowledgeProducts, coreKnowledgeProductServices } from "../__tests__/core-knowledge-fixtures.ts";
test.each([
  [{ basis: coreKnowledgeBasis, context: coreKnowledgeContext }, { status: "ok", value: coreKnowledgeSelection }],
  [{ basis: coreKnowledgeBasis, context: { ...coreKnowledgeContext, invocation: "aidlc" } }, { status: "invalid", findings: [{ code: "capability-gap", subject: "core-knowledge-products", detail: "this producer qualifies authored knowledge text for Bun copy delivery; native-release command preparation requires a separate verified capability" }] }],
  [{ basis: { ...coreKnowledgeBasis, pin: "other" }, context: coreKnowledgeContext }, { status: "invalid", findings: [{ code: "foreign-content", subject: "core-knowledge-products", detail: "authored core knowledge products must preserve the selected framework source basis" }] }],
] as const)("selects core knowledge products from explicit source and delivery facts", (input, expected) => {
  expect(selectCoreKnowledgeProducts({ sources: coreKnowledgeSources, ...input })).toEqual(expected);
});
test("preparation returns projected products with independent authored-input witnesses", async () => {
  const services = coreKnowledgeProductServices();
  expect(await prepareCoreKnowledgeProducts({ sourceRoot: "source", basis: coreKnowledgeBasis, context: coreKnowledgeContext, mode: 0o644, services })).toEqual({ status: "ok", value: { projection: coreKnowledgeSet, inputs: coreKnowledgeSources.inputs, products: coreKnowledgeProducts } });
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: coreKnowledgeBasis });
  expect(services.select).toHaveBeenCalledWith({ sources: coreKnowledgeSources, basis: coreKnowledgeBasis, context: coreKnowledgeContext });
  expect(services.project).toHaveBeenCalledWith(coreKnowledgeSelection);
  expect(services.products).toHaveBeenCalledWith({ projection: coreKnowledgeSet, sources: [coreKnowledgeBasis], compiler: coreKnowledgeBasis, mode: 0o644, rules: services.rules });
});
test("a projection failure produces no subset of otherwise prepared knowledge products", async () => {
  const services = { ...coreKnowledgeProductServices(), project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "knowledge", detail: "invalid authored metadata" }] }) };
  expect(await prepareCoreKnowledgeProducts({ sourceRoot: "source", basis: coreKnowledgeBasis, context: coreKnowledgeContext, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "knowledge", detail: "invalid authored metadata" }] });
  expect(services.project).toHaveBeenCalledWith(coreKnowledgeSelection);
  expect(services.products).not.toHaveBeenCalled();
});
test("composition: admitted groups retain distinct identities when flattened spelling collides", async () => {
  const services = { ...createCoreKnowledgeProductServices(), reader: createCoreKnowledgeSourceReader({ operations: { inventory: mock().mockResolvedValue([{ path: "core/knowledge/a-b/c.md", text: "One" }, { path: "core/knowledge/a/b-c.md", text: "Two" }]), digest: mock().mockReturnValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") } }) };
  expect(await prepareCoreKnowledgeProducts({ sourceRoot: "source", basis: coreKnowledgeBasis, context: coreKnowledgeContext, mode: 0o644, services })).toEqual({ status: "ok", value: expect.objectContaining({ products: [
    { key: "knowledge-3-a-b-c", owner: coreKnowledgeBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [{ ...coreKnowledgeBasis, path: "core/knowledge/a-b/c.md" }], requiredByProducer: [], files: [{ path: ".claude/knowledge/a-b/c.md", bytes: new Uint8Array([79, 110, 101]), mode: 0o644 }] },
    { key: "knowledge-1-a-b-c", owner: coreKnowledgeBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [{ ...coreKnowledgeBasis, path: "core/knowledge/a/b-c.md" }], requiredByProducer: [], files: [{ path: ".claude/knowledge/a/b-c.md", bytes: new Uint8Array([84, 119, 111]), mode: 0o644 }] },
  ] }) });
});
