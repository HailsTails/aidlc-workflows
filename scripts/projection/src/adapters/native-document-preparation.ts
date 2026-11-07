import { qualifiedDeliveryContext } from "./qualified-harness-profile.ts";
import { createNativeDocumentCommandPreparer } from "./native-document-commands.ts";
import type { NativeDocumentCommandPreparer, NativeDocumentCommands } from "../domain/native-document-commands.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import type { NativeResource } from "../domain/native-rendering.ts";
import type { ProjectionSet, ProjectedSetUnit } from "../application/projection-set.ts";
import { finding, type Outcome } from "../domain/model.ts";

export const isNativeDocumentContext = (context: HarnessBinding & { readonly invocation: string; readonly preparationStage?: "before-host" }): boolean => qualifiedDeliveryContext(context) && context.invocation === "aidlc";
export const isClaudeNativeDocumentContext = (context: HarnessBinding & { readonly invocation: string; readonly preparationStage?: "before-host" }): boolean => context.harness === "claude" && isNativeDocumentContext(context);
export const prepareDocumentCommands = ({ sourceRoot, basis, context, documents, preparer = createNativeDocumentCommandPreparer() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: HarnessBinding & { readonly invocation: string; readonly preparationStage?: "before-host" }; readonly documents: readonly { readonly path: string; readonly source: string; readonly namespaceLiterals?: readonly string[] }[]; readonly preparer?: NativeDocumentCommandPreparer }): Outcome<NativeDocumentCommands> => {
  if (context.invocation.startsWith("bun ") || context.preparationStage === "before-host") return { status: "ok", value: { binding: context, compiler: { ...basis, path: "scripts/native-command-text.ts" }, inputs: [], documents: documents.map(document => ({ ...document, text: document.source, origins: [] })) } };
  if (!isNativeDocumentContext(context)) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "native-document-commands", detail: "native document commands require the explicit qualified aidlc profile" })] };
  return preparer.prepare({ sourceRoot, basis, binding: context, documents });
};
export const prepareNativeProjectionCommands = ({ projection, sourceRoot, basis, context, namespaceLiterals = [] }: { readonly namespaceLiterals?: readonly { readonly path: string; readonly text: string }[]; readonly projection: ProjectionSet; readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: HarnessBinding & { readonly invocation: string; readonly preparationStage?: "before-host" } }): Outcome<{ readonly projection: ProjectionSet; readonly inputs: readonly SourceContentDigest[] }> => {
  if (context.invocation.startsWith("bun ") || context.preparationStage === "before-host") return namespaceLiterals.length === 0 ? { status: "ok", value: { projection, inputs: [] } } : { status: "invalid", findings: [finding({ code: "foreign-content", subject: "native-document-commands", detail: "copy documents must not consume native permission exemptions" })] };
  if (projection.units.some(unit => unit.kind === "runners" || unit.kind === "scope")) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "native-document-commands", detail: "runner and scope command preparation belongs to the workflow compiler" })] };
  if (new Set(namespaceLiterals.map(item => item.path)).size !== namespaceLiterals.length || namespaceLiterals.some(item => projection.resources.filter(resource => resource.path === item.path).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "native-document-commands", detail: "native policy literals require unique exact owned resource targets" })] };
  const prepared = prepareDocumentCommands({ sourceRoot, basis, context, documents: projection.resources.map(resource => ({ path: resource.path, source: resource.body, namespaceLiterals: namespaceLiterals.filter(item => item.path === resource.path).map(item => item.text) })) });
  if (prepared.status === "invalid") return prepared;
  const bodies = new Map(prepared.value.documents.map(document => [document.path, document.text]));
  const replace = (resource: NativeResource): NativeResource => ({ ...resource, body: bodies.get(resource.path) ?? resource.body });
  const replaceUnit = (unit: ProjectedSetUnit): ProjectedSetUnit => {
    if (unit.kind === "runners") return unit;
    const origins = prepared.value.documents.filter(document => unit.projection.resources.some(resource => resource.path === document.path)).flatMap(document => document.origins);
    const distinct = [...new Map(origins.map(origin => [origin.path, origin])).values()];
    const resources = unit.projection.resources.map(replace);
    switch (unit.kind) {
      case "stage": return { ...unit, projection: { ...unit.projection, resources, authoring: [...unit.projection.authoring, ...distinct] } };
      case "guidance": return { ...unit, projection: { ...unit.projection, resources, authoring: [...unit.projection.authoring, ...distinct] } };
      case "harness-document": return { ...unit, projection: { ...unit.projection, resources, authoring: [...unit.projection.authoring, ...distinct] } };
      case "agent": case "compiled-agent": return { ...unit, projection: { ...unit.projection, resources, dependencies: [...(unit.projection.dependencies ?? []), ...distinct] } };
      case "knowledge": return { ...unit, projection: { ...unit.projection, resources, dependencies: [...(unit.projection.dependencies ?? []), ...distinct] } };
      case "sensor": return { ...unit, projection: { ...unit.projection, resources, dependencies: [...(unit.projection.dependencies ?? []), ...distinct] } };
      case "skill": return { ...unit, projection: { ...unit.projection, resources, dependencies: [...(unit.projection.dependencies ?? []), ...distinct] } };
      case "scope": return unit;
    }
  };
  return { status: "ok", value: { projection: { ...projection, units: projection.units.map(replaceUnit), resources: projection.resources.map(replace) }, inputs: prepared.value.inputs } };
};
