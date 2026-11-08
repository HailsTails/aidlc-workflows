import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "./native-compiler-process.ts";
import { createNativeDocumentCommandPreparer } from "./native-document-commands.ts";
import type { NativeDocumentCommandPreparer } from "../domain/native-document-commands.ts";
import { qualifiedDeliveryContext, qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { prepareDocumentCommands } from "./native-document-preparation.ts";
import { z } from "zod";
import type { HarnessDocumentSources, PreparedHarnessDocuments, PreparedHarnessDocument, AuthoredHarnessDocument } from "../domain/harness-document.ts";
import { renderAuthoredProse, type AuthoredProseContext } from "../domain/authored-prose.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { copyHarnessBinding } from "../domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../domain/model.ts";
import { createHarnessDocumentSourceOperations, type HarnessDocumentSourceOperations } from "./harness-document-sources.ts";

const helperPath = "scripts/earlier-release-regions.ts";
type NativeSkillTextPreparation = (input: { readonly text: string; readonly skillRel: string; readonly harnessDir: string }) => unknown;
const helperSchema = z.object({ prepareEarlierReleaseSkillText: z.custom<NativeSkillTextPreparation>((capability) => typeof capability === "function") });
type NativeCompatibilityPolicy = z.infer<typeof helperSchema>;
export type HarnessDocumentPreparationRequest = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly sources: HarnessDocumentSources };
export type HarnessDocumentPreparationOperations = HarnessDocumentSourceOperations;
export type HarnessDocumentPreparer = { readonly prepare: (input: HarnessDocumentPreparationRequest) => Promise<Outcome<PreparedHarnessDocuments>> };
export const createHarnessDocumentPreparationOperations = (): HarnessDocumentPreparationOperations => createHarnessDocumentSourceOperations();
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "harness-document-preparation", detail })] });
const admitRequest = ({ request }: { readonly request: HarnessDocumentPreparationRequest }): Outcome<HarnessDocumentPreparationRequest> => {
  if (!qualifiedDeliveryContext(request.context)) return failure({ detail: "authored entry document preparation qualifies explicit Claude copy and native invocations" });
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || request.sources.documents.some((document) => sourceKey(document.origin.source) !== sourceKey(request.basis.source) || document.origin.pin !== request.basis.pin) || request.sources.authoring.some((origin) => sourceKey(origin.source) !== sourceKey(request.basis.source) || origin.pin !== request.basis.pin)) return failure({ code: "foreign-content", detail: "entry documents and manifest provenance must retain the requested framework source basis" });
  return { status: "ok", value: request };
};
const invokeNativeTextPreparation = ({ text, skillRel, harnessDir, policy }: { readonly text: string; readonly skillRel: string; readonly harnessDir: string; readonly policy: NativeCompatibilityPolicy }): Outcome<string> => {
  try {
    const prepared = z.string().safeParse(policy.prepareEarlierReleaseSkillText({ text, skillRel, harnessDir }));
    return prepared.success ? { status: "ok", value: prepared.data } : failure({ detail: "source-owned earlier-release preparation must return native document text" });
  } catch { return failure({ detail: "source-owned earlier-release text preparation unavailable" }); }
};
const prepareDocumentText = ({ document, rendered, policy, request }: { readonly document: AuthoredHarnessDocument; readonly rendered: string; readonly policy: NativeCompatibilityPolicy; readonly request: HarnessDocumentPreparationRequest }): Outcome<PreparedHarnessDocument> => {
  const placement = qualifiedHarnessProfile(request.context)?.entryDocuments.find((candidate) => candidate.role === document.role);
  if (placement === undefined) return failure({ detail: "authored entry document role has no supported destination" });
  const prepared: Outcome<string> = request.context.preparationStage === "before-host" ? { status: "ok", value: rendered } : invokeNativeTextPreparation({ text: rendered, skillRel: placement.destination, harnessDir: request.context.directory, policy });
  return prepared.status === "invalid" ? prepared : { status: "ok", value: { authored: document, destination: placement.destination, text: prepared.value, binding: copyHarnessBinding({ binding: request.context }), authoring: [...request.sources.authoring, { ...request.basis, path: helperPath }] } };
};
const admitRenderedEntryText = ({ rendered, subject }: { readonly rendered: string; readonly subject: string }): Outcome<string> => {
  const unsupported = rendered.match(/\{\{[^{}\r\n]+\}\}/);
  return unsupported === null ? { status: "ok", value: rendered } : { status: "invalid", findings: [finding({ code: "unresolved-token", subject, detail: `unsupported authored entry token ${unsupported[0]}` })] };
};
const prepareDocument = ({ document, policy, request, prose }: { readonly document: AuthoredHarnessDocument; readonly policy: NativeCompatibilityPolicy; readonly request: HarnessDocumentPreparationRequest; readonly prose: typeof renderAuthoredProse }): Outcome<PreparedHarnessDocument> => {
  const rendered = prose({ markdown: document.text, context: request.context, subject: document.origin.path });
  if (rendered.status === "invalid") return rendered;
  const admitted = admitRenderedEntryText({ rendered: rendered.value, subject: document.origin.path });
  return admitted.status === "invalid" ? admitted : prepareDocumentText({ document, rendered: admitted.value, policy, request });
};
const collectDocuments = ({ prepared, request, sha256 }: { readonly prepared: readonly Outcome<PreparedHarnessDocument>[]; readonly request: HarnessDocumentPreparationRequest; readonly sha256: string }): Outcome<PreparedHarnessDocuments> => {
  const findings = prepared.flatMap((document) => document.status === "invalid" ? document.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { documents: prepared.flatMap((document) => document.status === "ok" ? [document.value] : []), inputs: [...request.sources.inputs, { path: helperPath, sha256 }] } };
};
const applyCompatibilityPolicy = ({ imported, request, sha256, prose }: { readonly imported: unknown; readonly request: HarnessDocumentPreparationRequest; readonly sha256: string; readonly prose: typeof renderAuthoredProse }): Outcome<PreparedHarnessDocuments> => {
  const parsed = helperSchema.safeParse(imported);
  if (!parsed.success) return failure({ detail: "source-owned earlier release module must export its native text preparation capability" });
  return collectDocuments({ prepared: request.sources.documents.map((document) => prepareDocument({ document, policy: parsed.data, request, prose })), request, sha256 });
};
const retainStablePreparation = ({ prepared, before, after }: { readonly prepared: Outcome<PreparedHarnessDocuments>; readonly before: string; readonly after: string }): Outcome<PreparedHarnessDocuments> => before === after ? prepared : failure({ code: "foreign-content", detail: "earlier-release policy changed during entry document preparation" });
const prepareDeliveryDocuments = async ({ prepared, request, operations }: { readonly prepared: PreparedHarnessDocuments; readonly request: HarnessDocumentPreparationRequest; readonly operations: HarnessDocumentPreparationOperations }): Promise<Outcome<PreparedHarnessDocuments>> => {
  const profile = qualifiedHarnessProfile(request.context);
  if (profile === null || profile.nativeTextSources.length === 0) return { status: "ok", value: prepared };
  const paths = ["scripts/projection/src/adapters/qualified-delivery-policy.ts", `harness/${profile.harness}/manifest.ts`];
  const observed = [];
  for (const path of paths) {
    const bytes = await operations.read({sourceRoot:request.sourceRoot,path});
    if (bytes.status === "invalid") return bytes;
    const sha256 = operations.digest({bytes:bytes.value});
    const previous = prepared.inputs.find(input => input.path === path);
    if (previous !== undefined && previous.sha256 !== sha256) return failure({code:"foreign-content",detail:"delivery declaration changed after document observation"});
    const loaded = await operations.module({sourceRoot:request.sourceRoot,path,sha256});
    if (loaded.status === "invalid") return loaded;
    observed.push({path,sha256,module:loaded.value});
  }
  const policy = z.object({qualifyDeliveryDeclaration:z.custom<(declaration:unknown,profile:unknown)=>void>(value=>typeof value === "function"),prepareQualifiedNativeDocument:z.custom<(input:unknown)=>string>(value=>typeof value === "function")}).safeParse(observed[0]!.module);
  const manifest = z.object({default:z.unknown()}).safeParse(observed[1]!.module);
  if (!policy.success || !manifest.success) return failure({detail:"qualified document delivery APIs unavailable"});
  try {
    policy.data.qualifyDeliveryDeclaration(manifest.data.default,profile);
    const documents = prepared.documents.map(document => ({...document,text:request.context.invocation === "aidlc" ? policy.data.prepareQualifiedNativeDocument({declaration:manifest.data.default,profile,path:document.authored.origin.path,text:document.text}) : document.text,authoring:[...document.authoring,{...request.basis,path:paths[0]!}]}));
    for (const input of observed) {
      const after = await operations.read({sourceRoot:request.sourceRoot,path:input.path});
      if (after.status === "invalid") return after;
      if (operations.digest({bytes:after.value}) !== input.sha256) return failure({code:"foreign-content",detail:"delivery sources changed during document preparation"});
    }
    return {status:"ok",value:{documents,inputs:[...prepared.inputs,...observed.filter(input=>!prepared.inputs.some(previous=>previous.path===input.path)).map(({path,sha256})=>({path,sha256}))]}};
  } catch { return failure({detail:"qualified native document delivery refused the authored declaration or text"}); }
};
const prepareDocuments = async ({ request, operations, prose, preparer }: { readonly request: HarnessDocumentPreparationRequest; readonly operations: HarnessDocumentPreparationOperations; readonly prose: typeof renderAuthoredProse; readonly preparer: NativeDocumentCommandPreparer }): Promise<Outcome<PreparedHarnessDocuments>> => {
  const before = await operations.read({ sourceRoot: request.sourceRoot, path: helperPath });
  if (before.status === "invalid") return before;
  const sha256 = operations.digest({ bytes: before.value });
  const imported = await operations.module({ sourceRoot: request.sourceRoot, path: helperPath, sha256 });
  if (imported.status === "invalid") return imported;
  const prepared = applyCompatibilityPolicy({ imported: imported.value, request, sha256, prose });
  if (prepared.status === "invalid") return prepared;
  const after = await operations.read({ sourceRoot: request.sourceRoot, path: helperPath });
  if (after.status === "invalid") return after;
  const retained = retainStablePreparation({ prepared, before: sha256, after: operations.digest({ bytes: after.value }) });
  if (retained.status === "invalid") return retained;
  const stable = await prepareDeliveryDocuments({prepared:retained.value,request,operations});
  if (stable.status === "invalid") return stable;
  const documents = stable.value.documents.map(document => ({ path: document.authored.origin.path, source: document.text }));
  const commands = prepareDocumentCommands({ preparer, sourceRoot: request.sourceRoot, basis: request.basis, context: request.context, documents });
  if (commands.status === "invalid") return commands;
  const texts = new Map(commands.value.documents.map(document => [document.path, document]));
  return { status: "ok", value: { documents: stable.value.documents.map(document => {
    const text = texts.get(document.authored.origin.path);
    return { ...document, text: text?.text ?? document.text, authoring: [...document.authoring, ...(text?.origins ?? [])] };
  }), inputs: [...stable.value.inputs, ...commands.value.inputs] } };
};
export const createHarnessDocumentPreparer = ({ processes = createNativeCompilerProcessOperations, operations = createHarnessDocumentPreparationOperations(), prose = renderAuthoredProse, commands = createNativeDocumentCommandPreparer({ processes }) }: { readonly processes?: NativeCompilerProcessFactory; readonly operations?: HarnessDocumentPreparationOperations; readonly prose?: typeof renderAuthoredProse; readonly commands?: NativeDocumentCommandPreparer } = {}): HarnessDocumentPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : prepareDocuments({ request: admitted.value, operations, prose, preparer: commands });
} });
