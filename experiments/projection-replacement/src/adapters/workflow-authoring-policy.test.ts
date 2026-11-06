import { expect, test, mock } from "bun:test";
import { createWorkflowAuthoringReader, createWorkflowAuthoringOperations } from "./workflow-authoring-policy.ts";
import { authoringLocation, authoringSnapshot, authoringInputs, authoringOrigins, createAuthoringOperationsFixture, createAuthoringSourceFixture } from "../../__tests__/workflow-authoring-fixtures.ts";
test("declared harness question capacity supplies source-backed lettering and provenance", async () => {
  expect(await createWorkflowAuthoringReader({ operations: createAuthoringOperationsFixture() }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: "A-D", origins: authoringOrigins, inputs: authoringInputs } });
});
test("a supported optional field uses its documented native default", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ status: "ok", value: { ...authoringSnapshot, manifest: { name: "claude", harnessDir: ".claude" } } }) } }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: "A-E", origins: authoringOrigins, inputs: authoringInputs } });
});
test("an absent source capability does not acquire the upstream default", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ status: "ok", value: { ...authoringSnapshot, capability: "absent", manifest: { name: "claude", harnessDir: ".claude" } } }) } }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: null, origins: authoringOrigins, inputs: authoringInputs } });
});
test("a manifest property cannot bypass an absent source contract", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ status: "ok", value: { ...authoringSnapshot, capability: "absent" } }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "manifest questionOptions has no supported declaration in this source contract" }] });
});
test("invalid native option counts are refused rather than clamped", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ status: "ok", value: { ...authoringSnapshot, manifest: { ...authoringSnapshot.manifest, questionOptions: 6 } } }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-authoring", detail: "authoring manifest context requires a supported binding, source digests and optional questionOptions from 2 to 5" }] });
});
test("a different harness cannot supply the authoring policy", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ status: "ok", value: { ...authoringSnapshot, manifest: { ...authoringSnapshot.manifest, name: "cursor" } } }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-authoring", detail: "authoring context requires the requested native manifest binding and both declared source witnesses" }] });
});
test("production operations expose the source-context snapshot port", () => {
  expect(createWorkflowAuthoringOperations()).toMatchObject({ snapshot: expect.any(Function) });
});

test("stable source observation returns its manifest and both content witnesses as data", async () => {
  expect(await createWorkflowAuthoringOperations({ source: createAuthoringSourceFixture() }).snapshot(authoringLocation)).toEqual({ status: "ok", value: authoringSnapshot });
});

test.each([
  [{ afterManifest: "manifest changed" }],
  [{ afterContract: "questionOptions removed" }],
])("changing either source input refuses the observed snapshot without throwing: %s", async (changes) => {
  expect(await createWorkflowAuthoringOperations({ source: createAuthoringSourceFixture(changes) }).snapshot(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "authoring manifest inputs changed during context preparation" }] });
});

test("source failure data passes through before snapshot-shape admission", async () => {
  const snapshot = mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "authoring manifest inputs changed during context preparation" }] });
  expect(await createWorkflowAuthoringReader({ operations: { snapshot } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "authoring manifest inputs changed during context preparation" }] });
  expect(snapshot).toHaveBeenCalledWith(authoringLocation);
});

test("source read failure is converted at its snapshot boundary", async () => {
  expect(await createWorkflowAuthoringOperations({ source: { ...createAuthoringSourceFixture(), read: mock().mockRejectedValue(new Error("private source path")) } }).snapshot(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "authoring source inputs unavailable during context preparation" }] });
});

test("a missing manifest export is an input refusal rather than a thrown schema error", async () => {
  expect(await createWorkflowAuthoringOperations({ source: { ...createAuthoringSourceFixture(), manifest: mock().mockResolvedValue({ unexpected: "not the manifest" }) } }).snapshot(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-authoring", detail: "authoring manifest module must provide a default export" }] });
});
