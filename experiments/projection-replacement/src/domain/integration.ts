import {
  renderNativeResources,
  type HarnessTarget,
  type NativeContribution,
} from "./native-rendering.ts";
import { finding, type Outcome } from "./model.ts";
import { isProjectedDocument, type ProjectedDocument } from "./projection.ts";
export type { HarnessTarget, NativeResource, NativeContribution } from "./native-rendering.ts";
const integrated = Symbol("native-bundle");
export type NativeBundle = NativeContribution & { readonly [integrated]: true };
export { resourceKey } from "./native-rendering.ts";
export type IntegrationInput = {
  readonly document: ProjectedDocument;
  readonly target: HarnessTarget;
};
export type Integrator = (input: IntegrationInput) => Outcome<NativeBundle>;
export type IntegrationDependencies = {
  readonly accepts: (input: { readonly candidate: unknown }) => "accepted" | "rejected";
  readonly render: typeof renderNativeResources;
};
export const createIntegrationDependencies = (): IntegrationDependencies => ({
  accepts: (input) => (isProjectedDocument(input) ? "accepted" : "rejected"),
  render: renderNativeResources,
});
export const createIntegrator = (
  dependencies: IntegrationDependencies = createIntegrationDependencies(),
): IntegrationService => {
  const bundles = new WeakSet<object>();
  const isNativeBundle = (input: {
    readonly candidate: unknown;
  }): input is { readonly candidate: NativeBundle } =>
    typeof input.candidate === "object" && input.candidate !== null && bundles.has(input.candidate);
  const integrate: Integrator = (input) => {
    if (dependencies.accepts({ candidate: input.document }) === "rejected")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "unvalidated-document",
            subject: "integration",
            detail: "only live projector output is accepted",
          }),
        ],
      };
    const rendered = dependencies.render(input);
    if (rendered.status === "invalid") return rendered;
    const nativeBundle = Object.freeze<NativeBundle>({
      [integrated]: true,
      harness: input.document.harness,
      unit: input.document.key,
      source: input.document.source,
      resources: Object.freeze(rendered.value.map((resource) => Object.freeze({ ...resource }))),
    });
    bundles.add(nativeBundle);
    return { status: "ok", value: nativeBundle };
  };

  return Object.freeze({ integrate, isNativeBundle });
};
export type IntegrationService = {
  readonly integrate: Integrator;
  readonly isNativeBundle: (input: {
    readonly candidate: unknown;
  }) => input is { readonly candidate: NativeBundle };
};
const canonicalIntegration = createIntegrator();
export const integrate = canonicalIntegration.integrate;
export const isNativeBundle = canonicalIntegration.isNativeBundle;
