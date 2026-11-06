import { expect, mock, test } from "bun:test";
import { prepareOnboardingProducts } from "./onboarding-products.ts";
import { onboardingRequest, preparedOnboarding, onboardingInputs, onboardingSet, onboardingDocument } from "../__tests__/onboarding-fixtures.ts";

test("projects the single onboarding role independently of raw entry mappings", async () => {
  const services = { preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: preparedOnboarding }) }, project: mock().mockReturnValue({ status: "ok", value: onboardingSet }) };
  expect(await prepareOnboardingProducts({ ...onboardingRequest, services })).toEqual({ status: "ok", value: { projection: onboardingSet, inputs: onboardingInputs } });
  expect(services.preparation.prepare).toHaveBeenCalledWith(onboardingRequest);
  expect(services.project).toHaveBeenCalledWith({ target: { harness: "claude", directory: ".claude" }, units: [{ kind: "harness-document", key: "harness-onboarding", input: { document: onboardingDocument, context: { harness: "claude", directory: ".claude" } } }] });
});
test("projection refusal prevents issuing onboarding products", async () => {
  const services = { preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: preparedOnboarding }) }, project: mock().mockReturnValue({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "harness-onboarding", detail: "wrong binding" }] }) };
  expect(await prepareOnboardingProducts({ ...onboardingRequest, services })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "harness-onboarding", detail: "wrong binding" }] });
});
test.each([
  { document: { ...onboardingDocument, authored: { ...onboardingDocument.authored, role: "composer" } } },
  { document: { ...onboardingDocument, authored: { ...onboardingDocument.authored, origin: { ...onboardingDocument.authored.origin, path: "elsewhere.md" } } } },
  { document: { ...onboardingDocument, authored: { ...onboardingDocument.authored, origin: { ...onboardingDocument.authored.origin, pin: "foreign" } } } },
  { document: { ...onboardingDocument, authoring: [{ ...onboardingRequest.basis, path: "a" }, { ...onboardingRequest.basis, path: "b" }, { ...onboardingRequest.basis, path: "c" }, { ...onboardingRequest.basis, path: "d" }, { ...onboardingRequest.basis, path: "e" }] } },
] as const)("wrong role, origin or counted-only provenance refuses before projection", async ({ document }) => {
  const services = { preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: { documents: [document], inputs: onboardingInputs } }) }, project: mock() };
  expect(await prepareOnboardingProducts({ ...onboardingRequest, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "onboarding-products", detail: "onboarding must retain one assembled template product and complete same-source authoring provenance" }] });
  expect(services.project).not.toHaveBeenCalled();
});
test("preparation refusal prevents projection", async () => {
  const services = { preparation: { prepare: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "source unavailable" }] }) }, project: mock() };
  expect(await prepareOnboardingProducts({ ...onboardingRequest, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "source unavailable" }] });
  expect(services.project).not.toHaveBeenCalled();
});
test("rejects missing assembled document before projection", async () => {
  const services = { preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: { documents: [], inputs: onboardingInputs } }) }, project: mock() };
  expect(await prepareOnboardingProducts({ ...onboardingRequest, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "onboarding-products", detail: "onboarding must retain one assembled template product and complete same-source authoring provenance" }] });
  expect(services.project).not.toHaveBeenCalled();
});
