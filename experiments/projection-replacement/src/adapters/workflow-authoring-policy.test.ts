import { expect, test, mock } from "bun:test";
import { createWorkflowAuthoringReader, createWorkflowAuthoringOperations } from "./workflow-authoring-policy.ts";
import { authoringLocation, authoringSnapshot, authoringInputs, authoringOrigins, createAuthoringOperationsFixture } from "../../__tests__/workflow-authoring-fixtures.ts";
test("declared harness question capacity supplies source-backed lettering and provenance", async () => {
  expect(await createWorkflowAuthoringReader({ operations: createAuthoringOperationsFixture() }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: "A-D", origins: authoringOrigins, inputs: authoringInputs } });
});
test("a supported optional field uses its documented native default", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ ...authoringSnapshot, manifest: { name: "claude", harnessDir: ".claude" } }) } }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: "A-E", origins: authoringOrigins, inputs: authoringInputs } });
});
test("an absent source capability does not acquire the upstream default", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ ...authoringSnapshot, capability: "absent", manifest: { name: "claude", harnessDir: ".claude" } }) } }).load(authoringLocation)).toEqual({ status: "ok", value: { binding: authoringLocation.binding, optionLetters: null, origins: authoringOrigins, inputs: authoringInputs } });
});
test("a manifest property cannot bypass an absent source contract", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ ...authoringSnapshot, capability: "absent" }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-authoring", detail: "manifest questionOptions has no supported declaration in this source contract" }] });
});
test("invalid native option counts are refused rather than clamped", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ ...authoringSnapshot, manifest: { ...authoringSnapshot.manifest, questionOptions: 6 } }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workflow-authoring", detail: "authoring manifest context requires a supported binding, source digests and optional questionOptions from 2 to 5" }] });
});
test("a different harness cannot supply the authoring policy", async () => {
  expect(await createWorkflowAuthoringReader({ operations: { snapshot: mock().mockResolvedValue({ ...authoringSnapshot, manifest: { ...authoringSnapshot.manifest, name: "cursor" } }) } }).load(authoringLocation)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-authoring", detail: "authoring context requires the requested native manifest binding and both declared source witnesses" }] });
});
test("production operations expose the source-context snapshot port", () => {
  expect(createWorkflowAuthoringOperations()).toMatchObject({ snapshot: expect.any(Function) });
});
