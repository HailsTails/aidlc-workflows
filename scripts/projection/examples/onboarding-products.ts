import { continuePreparation } from "../src/application/preparation-result.ts";
import { createOnboardingPreparer, onboardingSourcePaths, type OnboardingPreparer, type OnboardingRequest } from "../src/adapters/onboarding-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { SourceContentDigest } from "../src/domain/source-origin.ts";
import { copyHarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";
import type { PreparedHarnessDocuments } from "../src/domain/harness-document.ts";

export type OnboardingProducts = { readonly projection: ProjectionSet; readonly inputs: readonly SourceContentDigest[] };
export type OnboardingProductServices = { readonly preparation: OnboardingPreparer; readonly project: typeof projectProjectionSet };
export const createOnboardingProductServices = (): OnboardingProductServices => ({ preparation: createOnboardingPreparer(), project: projectProjectionSet });
const selectOnboarding = ({ prepared, request }: { readonly prepared: PreparedHarnessDocuments; readonly request: OnboardingRequest }): Outcome<ProjectionSetRequest> => {
  const document = prepared.documents[0];
  const requiredAuthoring = onboardingSourcePaths({ invocation: request.context.invocation }).filter(path => path !== "core/templates/onboarding.md");
  if (prepared.documents.length !== 1 || document?.authored.role !== "onboarding" || document.authored.origin.path !== "core/templates/onboarding.md" || sourceKey(document.authored.origin.source) !== sourceKey(request.basis.source) || document.authored.origin.pin !== request.basis.pin || document.authoring.length !== requiredAuthoring.length || requiredAuthoring.some((path) => document.authoring.filter((origin) => origin.path === path).length !== 1) || document.authoring.some((origin) => sourceKey(origin.source) !== sourceKey(request.basis.source) || origin.pin !== request.basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "onboarding-products", detail: "onboarding must retain one assembled template product and complete same-source authoring provenance" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: request.context }), units: [{ kind: "harness-document", key: "harness-onboarding", input: { document, context: copyHarnessBinding({ binding: request.context }) } }] } };
};
export const prepareOnboardingProducts = ({ services = createOnboardingProductServices(), ...request }: OnboardingRequest & { readonly mode?: number; readonly services?: OnboardingProductServices }): Promise<Outcome<OnboardingProducts>> => continuePreparation({ previous: services.preparation.prepare(request), consume: ({ prepared }) => continuePreparation({ previous: selectOnboarding({ prepared, request }), consume: ({ prepared: selection }) => continuePreparation({ previous: services.project(selection), consume: ({ prepared: projection }) => ({ status: "ok", value: { projection, inputs: prepared.inputs } }) }) }) });
