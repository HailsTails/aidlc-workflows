import { expect, mock, test } from "bun:test";
import { createHarnessDocumentProductServices, prepareHarnessDocumentProducts, selectHarnessDocumentProducts } from "./harness-document-products.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import { createEntryProductServices, entryBasis, entryContext, preparedEntries, entryMain, entryComposer, entryQuestion, entryMethod, entrySet, entrySources, entrySelection } from "../__tests__/harness-document-fixtures.ts";

test("selects the four document roles atomically as their own projection kind", () => {
  expect(selectHarnessDocumentProducts({ sources: preparedEntries, basis: entryBasis, context: entryContext })).toEqual({ status: "ok", value: { target: { harness: "claude", directory: ".claude" }, units: [
    { kind: "harness-document", key: "harness-main-skill", input: { document: entryMain, context: { harness: "claude", directory: ".claude" } } },
    { kind: "harness-document", key: "harness-composer", input: { document: entryComposer, context: { harness: "claude", directory: ".claude" } } },
    { kind: "harness-document", key: "harness-question-rendering", input: { document: entryQuestion, context: { harness: "claude", directory: ".claude" } } },
    { kind: "harness-document", key: "harness-method-import", input: { document: entryMethod, context: { harness: "claude", directory: ".claude" } } },
  ] } });
});

test.each([{ documents: [] }, { documents: [entryMain, entryComposer, entryQuestion, entryQuestion] }])("missing or duplicate roles cannot publish a partial entry profile", ({ documents }) => {
  expect(selectHarnessDocumentProducts({ sources: { ...preparedEntries, documents }, basis: entryBasis, context: entryContext })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-products", detail: "publish the four distinct authored Claude entry documents atomically" }] });
});

test("foreign compatibility policy cannot become document ownership evidence", () => {
  expect(selectHarnessDocumentProducts({ sources: { ...preparedEntries, documents: [{ ...entryMain, authoring: [{ ...entryBasis, pin: "foreign", path: "harness/claude/manifest.ts" }, { ...entryBasis, path: "scripts/earlier-release-regions.ts" }] }, entryComposer, entryQuestion, entryMethod] }, basis: entryBasis, context: entryContext })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-products", detail: "authored entry products require the Claude binding and complete selected-source authoring provenance" }] });
});

test("two unrelated origins cannot substitute for the required manifest and text owner", () => {
  expect(selectHarnessDocumentProducts({ sources: { ...preparedEntries, documents: [{ ...entryMain, authoring: [{ ...entryBasis, path: "other/manifest.ts" }, { ...entryBasis, path: "other/compatibility.ts" }] }, entryComposer, entryQuestion, entryMethod] }, basis: entryBasis, context: entryContext })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-products", detail: "authored entry products require the Claude binding and complete selected-source authoring provenance" }] });
});

test("preparation uses existing projection and product services with observed raw inputs", async () => {
  const services = createEntryProductServices();
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "ok", value: { projection: entrySet, inputs: preparedEntries.inputs, products: [] } });
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "entry-source", basis: entryBasis, binding: { harness: "claude", directory: ".claude" } });
  expect(services.preparation.prepare).toHaveBeenCalledWith({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, sources: entrySources });
  expect(services.select).toHaveBeenCalledWith({ sources: preparedEntries, basis: entryBasis, context: { harness: "claude", directory: ".claude" } });
  expect(services.project).toHaveBeenCalledWith(entrySelection);
  expect(services.products).toHaveBeenCalledWith({ projection: entrySet, sources: [entryBasis], compiler: entryBasis, mode: 0o640, rules: services.rules });
});

test("source refusal stops downstream preparation and publication", async () => {
  const services = { ...createEntryProductServices(), reader: { load: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "manifest", detail: "source changed" }] }) } };
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "manifest", detail: "source changed" }] });
  expect(services.preparation.prepare).not.toHaveBeenCalled();
  expect(services.select).not.toHaveBeenCalled();
  expect(services.project).not.toHaveBeenCalled();
  expect(services.products).not.toHaveBeenCalled();
});

test("preparation refusal stops selection, projection and product admission", async () => {
  const services = { ...createEntryProductServices(), preparation: { prepare: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "entry-preparation", detail: "native text API unavailable" }] }) } };
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "entry-preparation", detail: "native text API unavailable" }] });
  expect(services.preparation.prepare).toHaveBeenCalledWith({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, sources: entrySources });
  expect(services.select).not.toHaveBeenCalled();
  expect(services.project).not.toHaveBeenCalled();
  expect(services.products).not.toHaveBeenCalled();
});

test("selection refusal stops projection and product admission", async () => {
  const services = { ...createEntryProductServices(), select: mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "entry-selection", detail: "document provenance disagrees" }] }) };
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "entry-selection", detail: "document provenance disagrees" }] });
  expect(services.select).toHaveBeenCalledWith({ sources: preparedEntries, basis: entryBasis, context: { harness: "claude", directory: ".claude" } });
  expect(services.project).not.toHaveBeenCalled();
  expect(services.products).not.toHaveBeenCalled();
});

test("projection refusal stops product admission", async () => {
  const services = { ...createEntryProductServices(), project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry-projection", detail: "document destinations overlap" }] }) };
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "entry-projection", detail: "document destinations overlap" }] });
  expect(services.project).toHaveBeenCalledWith(entrySelection);
  expect(services.products).not.toHaveBeenCalled();
});

test("product admission refusal returns no successful projection envelope", async () => {
  const services = { ...createEntryProductServices(), products: mock().mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-mode", detail: "file permission mode unavailable" }] }) };
  expect(await prepareHarnessDocumentProducts({ sourceRoot: "entry-source", basis: entryBasis, context: entryContext, mode: 0o640, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-mode", detail: "file permission mode unavailable" }] });
  expect(services.products).toHaveBeenCalledWith({ projection: entrySet, sources: [entryBasis], compiler: entryBasis, mode: 0o640, rules: services.rules });
  expect(services.products).toHaveBeenCalledTimes(1);
});

test("production services retain shared projection and product owners", () => {
  expect(createHarnessDocumentProductServices()).toMatchObject({ reader: { load: expect.any(Function) }, preparation: { prepare: expect.any(Function) }, select: selectHarnessDocumentProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: { encode: expect.any(Function) } });
});
