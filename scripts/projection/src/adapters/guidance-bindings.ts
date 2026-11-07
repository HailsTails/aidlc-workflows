import { isClaudeNativeDocumentContext, prepareDocumentCommands } from "./native-document-preparation.ts";
import { guidanceDocumentName } from "../domain/core-guidance.ts";
import { z } from "zod";
import type { CoreGuidanceSources, PreparedCoreGuidance, PreparedGuidance, AuthoredGuidance } from "../domain/core-guidance.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { copyHarnessBinding } from "../domain/harness-binding.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { renderAuthoredProse, type AuthoredProseContext } from "../domain/authored-prose.ts";
import { sourceKey } from "../domain/model.ts";
const selectorPath = "scripts/harness-bindings.ts";
const selectorSchema = z.record(z.string(), z.unknown()).transform((namespaceExports) => ({ headings: namespaceExports["BINDING_HEADINGS"], select: namespaceExports["keepOwnHarnessBindings"] })).pipe(z.object({ headings: z.record(z.string(), z.string().min(1)), select: z.function({ input: [z.string(), z.string(), z.string()] }) }));
export type GuidanceBindingRequest = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly sources: CoreGuidanceSources };
export type GuidanceBindingPreparer = { readonly prepare: (input: GuidanceBindingRequest) => Promise<Outcome<PreparedCoreGuidance>> };
export type GuidanceBindingOperations = { readonly bytes: (input: { readonly sourceRoot: string }) => Promise<Uint8Array>; readonly load: (input: { readonly sourceRoot: string; readonly sha256: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export const createGuidanceBindingOperations = (): GuidanceBindingOperations => ({ bytes: ({ sourceRoot }) => Bun.file(`${sourceRoot}/${selectorPath}`).bytes(), load: ({ sourceRoot, sha256 }) => import(`${Bun.pathToFileURL(`${sourceRoot}/${selectorPath}`).href}?source=${sha256}`), digest: createOwnershipDigest() });
type GuidanceSelector = { readonly select: (input: { readonly document: AuthoredGuidance }) => Outcome<PreparedGuidance> };
const selectProtocolText = ({ document, text, selector, request }: { readonly document: AuthoredGuidance; readonly text: string; readonly selector: z.infer<typeof selectorSchema>; readonly request: GuidanceBindingRequest }): Outcome<PreparedGuidance> => {
  try {
    const selected = z.string().safeParse(selector.select(text, request.context.harness, document.origin.path));
    if (!selected.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: selectorPath, detail: "source-owned guidance selector must return text for each admitted document" })] };
    return { status: "ok", value: { authored: document, text: selected.data, binding: copyHarnessBinding({ binding: request.context }), authoring: [{ ...request.basis, path: selectorPath }] } };
  }
  catch (failure) { return { status: "invalid", findings: [finding({ code: "invalid-input", subject: document.origin.path, detail: failure instanceof Error ? failure.message : "source-owned harness binding selection refused the authored guidance" })] }; }
};
const selectGuidancePlacement = ({ document, text, selector, request }: { readonly document: AuthoredGuidance; readonly text: string; readonly selector: z.infer<typeof selectorSchema>; readonly request: GuidanceBindingRequest }): Outcome<PreparedGuidance> => {
  switch (document.placement.kind) {
    case "conductor": return { status: "ok", value: { authored: document, text, binding: copyHarnessBinding({ binding: request.context }), authoring: [] } };
    case "protocol": return selectProtocolText({ document, text, selector, request });
  }
};
const retainGuidanceProse = ({ rendered, document, selector, request }: { readonly rendered: Outcome<string>; readonly document: AuthoredGuidance; readonly selector: z.infer<typeof selectorSchema>; readonly request: GuidanceBindingRequest }): Outcome<PreparedGuidance> => rendered.status === "invalid" ? rendered : selectGuidancePlacement({ document, text: rendered.value, selector, request });
const admitGuidanceSelector = ({ imported, request, prose }: { readonly imported: unknown; readonly request: GuidanceBindingRequest; readonly prose: typeof renderAuthoredProse }): Outcome<GuidanceSelector> => {
  const parsed = selectorSchema.safeParse(imported);
  if (!parsed.success || parsed.data.headings[request.context.harness] === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: selectorPath, detail: "source-owned guidance selector must export harness headings and keepOwnHarnessBindings for the selected harness" })] };
  return { status: "ok", value: { select: ({ document }) => retainGuidanceProse({ document, request, selector: parsed.data, rendered: prose({ markdown: document.text, context: request.context, subject: document.origin.path }) }) } };
};
const collectGuidanceBindings = ({ selected, request, sha256 }: { readonly selected: readonly Outcome<PreparedGuidance>[]; readonly request: GuidanceBindingRequest; readonly sha256: string }): Outcome<PreparedCoreGuidance> => {
  const findings = selected.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: { documents: selected.flatMap((entry) => entry.status === "ok" ? [entry.value] : []), inputs: [...request.sources.inputs, { path: selectorPath, sha256 }] } };
};
const applyGuidanceSelector = ({ admitted, request, sha256 }: { readonly admitted: Outcome<GuidanceSelector>; readonly request: GuidanceBindingRequest; readonly sha256: string }): Outcome<PreparedCoreGuidance> => admitted.status === "invalid" ? admitted : collectGuidanceBindings({ selected: request.sources.documents.map((document) => admitted.value.select({ document })), request, sha256 });
const selectorFingerprint = async ({ request, operations }: { readonly request: GuidanceBindingRequest; readonly operations: GuidanceBindingOperations }): Promise<string> => operations.digest({ bytes: await operations.bytes({ sourceRoot: request.sourceRoot }) });
const retainStableBindings = ({ prepared, before, after }: { readonly prepared: Outcome<PreparedCoreGuidance>; readonly before: string; readonly after: string }): Outcome<PreparedCoreGuidance> => before !== after ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: selectorPath, detail: "guidance binding selector changed during preparation; retry from stable source" })] } : prepared;
const prepareGuidanceBindings = async ({ request, operations, prose }: { readonly request: GuidanceBindingRequest; readonly operations: GuidanceBindingOperations; readonly prose: typeof renderAuthoredProse }): Promise<Outcome<PreparedCoreGuidance>> => {
  try {
    const sha256 = await selectorFingerprint({ request, operations });
    const prepared = applyGuidanceSelector({ admitted: admitGuidanceSelector({ imported: await operations.load({ sourceRoot: request.sourceRoot, sha256 }), request, prose }), request, sha256 });
    const stable = retainStableBindings({ prepared, before: sha256, after: await selectorFingerprint({ request, operations }) });
    if (stable.status === "invalid") return stable;
    const commands = prepareDocumentCommands({ sourceRoot: request.sourceRoot, basis: request.basis, context: request.context, documents: stable.value.documents.map(document => ({ path: `${request.context.directory}/aidlc-common/${guidanceDocumentName({ placement: document.authored.placement })}`, source: document.text })) });
    if (commands.status === "invalid") return commands;
    const preparedTexts = new Map(commands.value.documents.map(document => [document.path, document]));
    return { status: "ok", value: { documents: stable.value.documents.map(document => {
      const text = preparedTexts.get(`${request.context.directory}/aidlc-common/${guidanceDocumentName({ placement: document.authored.placement })}`);
      return { ...document, text: text?.text ?? document.text, authoring: [...document.authoring, ...(text?.origins ?? [])] };
    }), inputs: [...stable.value.inputs, ...commands.value.inputs] } };
  } catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: selectorPath, detail: "source-owned guidance binding selector unavailable; inspect the selected source checkout and API" })] }; }
};
const admitBindingRequest = ({ request }: { readonly request: GuidanceBindingRequest }): Outcome<GuidanceBindingRequest> => {
  if ((!request.context.invocation.startsWith("bun ") && !isClaudeNativeDocumentContext(request.context))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-guidance-bindings", detail: "guidance text qualifies Bun copy and explicit Claude native delivery" })] };
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || request.sources.documents.length === 0 || request.sources.documents.some((document) => sourceKey(document.origin.source) !== sourceKey(request.basis.source) || document.origin.pin !== request.basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-guidance-bindings", detail: "bind authored guidance from one declared framework source basis" })] };
  return { status: "ok", value: request };
};
const continueBindingRequest = ({ admitted, consume }: { readonly admitted: Outcome<GuidanceBindingRequest>; readonly consume: (request: GuidanceBindingRequest) => Promise<Outcome<PreparedCoreGuidance>> }): Promise<Outcome<PreparedCoreGuidance>> => admitted.status === "invalid" ? Promise.resolve(admitted) : consume(admitted.value);
export const createGuidanceBindingPreparer = ({ operations = createGuidanceBindingOperations(), prose = renderAuthoredProse }: { readonly operations?: GuidanceBindingOperations; readonly prose?: typeof renderAuthoredProse } = {}): GuidanceBindingPreparer => ({ prepare: (request) => continueBindingRequest({ admitted: admitBindingRequest({ request }), consume: (admitted) => prepareGuidanceBindings({ request: admitted, operations, prose }) }) });
