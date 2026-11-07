import { qualifiedDeliveryContext, qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { isNativeDocumentContext, prepareDocumentCommands } from "./native-document-preparation.ts";
import { z } from "zod";
import { createWorkflowAuthoringOperations, type WorkflowAuthoringOperations } from "./workflow-authoring-policy.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { renderAuthoredProse } from "../domain/authored-prose.ts";
import { mergeSourceDigests, type SourceContentDigest } from "../domain/source-origin.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import type { PreparedWorkflowReference, WorkflowReferencePreparer, WorkflowReferenceRequest } from "../domain/workflow-reference.ts";
export type { PreparedWorkflowReference, WorkflowReferencePreparer, WorkflowReferenceRequest } from "../domain/workflow-reference.ts";

const helperPath = "scripts/generated-skill-regions.ts";
const utilityPath = "core/tools/aidlc-utility.ts";
const formatterPath = "core/tools/aidlc-compiled-tables.ts";
const nativeRuntimePath = "scripts/native-runtime-text.ts";
const nativeRuntimeSources = [nativeRuntimePath, "scripts/native-command-text.ts", "scripts/native-command-context.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts", "core/tools/aidlc-color.ts", "core/tools/aidlc-runtime-paths.ts"];
const regionsKey = "GENERATED_SKILL_REGIONS";
const digestSchema = z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const manifestSchema = z.strictObject({ capability: z.enum(["declared", "absent"]), inputs: z.array(digestSchema), manifest: z.object({ name: z.string(), harnessDir: z.string(), orchestratorSkillPath: z.string(), harnessFiles: z.array(z.object({ src: z.string(), dst: z.string(), projectRoot: z.boolean().optional() })) }) });
const regionSchema = z.strictObject({ verb: z.enum(["stage-table", "scope-table"]), begin: z.string().min(1), end: z.string().min(1) });
type Region = z.infer<typeof regionSchema>;
type RegionReplacement = (input: { readonly text: string; readonly rendered: string; readonly region: Region; readonly path: string }) => unknown;
const helperSchema = z.unknown().refine((namespace) => typeof namespace === "object" && namespace !== null && Object.hasOwn(namespace, regionsKey) && Object.hasOwn(namespace, "replaceGeneratedSkillRegion")).pipe(z.object({ [regionsKey]: z.tuple([regionSchema.extend({ verb: z.literal("stage-table") }), regionSchema.extend({ verb: z.literal("scope-table") })]), replaceGeneratedSkillRegion: z.custom<RegionReplacement>((capability) => typeof capability === "function") }));
const replacementSchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), text: z.string() }), z.strictObject({ status: z.literal("refused"), detail: z.string().min(1) })]);
type ReferenceHelper = z.infer<typeof helperSchema>;
type ObservedFile = { readonly root: string; readonly path: string; readonly bytes: Uint8Array };
type ReferenceObservation = { readonly files: readonly ObservedFile[]; readonly scopes: readonly string[] };
type ReferenceManifest = { readonly template: string; readonly destination: string };
type ReferenceSourceWitnesses = { readonly inputs: readonly SourceContentDigest[]; readonly helper: SourceContentDigest };
type NativeRegionReply = { readonly exitCode: 0; readonly error: null; readonly stderr: string; readonly stdout: string };
export type WorkflowReferenceOperations = {
  readonly authoring: WorkflowAuthoringOperations["snapshot"];
  readonly read: (input: { readonly root: string; readonly path: string }) => Promise<Outcome<Uint8Array>>;
  readonly scopes: (input: { readonly root: string; readonly directory: string }) => Promise<Outcome<readonly string[]>>;
  readonly module: (input: { readonly sourceRoot: string; readonly path: string; readonly sha256: string }) => Promise<Outcome<unknown>>;
  readonly digest: (input: { readonly bytes: Uint8Array }) => string;
  readonly prose: typeof renderAuthoredProse;
  readonly process: NativeCompilerProcessOperations;
};
const refused = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-input" | "foreign-content" | "harness-mismatch" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "workflow-reference", detail })] });
const readReferenceFile: WorkflowReferenceOperations["read"] = async ({ root, path }) => {
  try { return { status: "ok", value: await Bun.file(`${root}/${path}`).bytes() }; }
  catch { return refused({ detail: `workflow reference input unavailable: ${path}` }); }
};
const readReferenceScopes: WorkflowReferenceOperations["scopes"] = async ({ root, directory }) => {
  try { return { status: "ok", value: Array.from(new Bun.Glob("**/*").scanSync({ cwd: `${root}/${directory}`, onlyFiles: true, followSymlinks: false, dot: true })).map((path) => `${directory}/${path.replaceAll("\\", "/")}`).sort() }; }
  catch { return refused({ detail: "workflow reference runtime scope inventory unavailable" }); }
};
const loadReferenceHelper: WorkflowReferenceOperations["module"] = async ({ sourceRoot, path, sha256 }) => {
  try { return { status: "ok", value: await import(`${Bun.pathToFileURL(`${sourceRoot}/${path}`).href}?source=${sha256}`) }; }
  catch { return refused({ detail: "source-owned generated skill region API unavailable" }); }
};
export const createWorkflowReferenceOperations = (): WorkflowReferenceOperations => ({ authoring: createWorkflowAuthoringOperations().snapshot, read: readReferenceFile, scopes: readReferenceScopes, module: loadReferenceHelper, digest: createOwnershipDigest(), prose: renderAuthoredProse, process: createNativeCompilerProcessOperations() });

const hasBasis = ({ origin, request }: { readonly origin: WorkflowReferenceRequest["workflow"]["compiler"]; readonly request: WorkflowReferenceRequest }) => origin.source.kind === request.basis.source.kind && origin.source.id === request.basis.source.id && origin.pin === request.basis.pin;
const admitReferenceRequest = ({ request }: { readonly request: WorkflowReferenceRequest }): Outcome<WorkflowReferenceRequest> => {
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin)) return refused({ code: "foreign-content", detail: "workflow references require the framework basis and full source pin" });
  if (!qualifiedDeliveryContext(request.context)) return refused({ code: "harness-mismatch", detail: "compiled workflow references qualify explicit qualified copy and native profiles" });
  const workflow = request.workflow;
  if (workflow.binding.harness !== request.context.harness || workflow.binding.directory !== request.context.directory || !hasBasis({ origin: workflow.compiler, request }) || workflow.compiler.path !== "core/tools/aidlc-graph.ts" || !hasBasis({ origin: workflow.graph.origin, request }) || !hasBasis({ origin: workflow.grid.origin, request }) || workflow.graph.origin.path !== `${request.context.directory}/tools/data/stage-graph.json` || workflow.grid.origin.path !== `${request.context.directory}/tools/data/scope-grid.json` || !workflow.inputs.some((input) => input.path === workflow.compiler.path)) return refused({ code: "foreign-content", detail: "compiled workflow graph, grid and compiler witnesses must share the requested source basis and binding" });
  if (request.authoring.binding.harness !== request.context.harness || request.authoring.binding.directory !== request.context.directory || (request.context.optionLetters ?? null) !== request.authoring.optionLetters || request.authoring.origins.length !== request.authoring.inputs.length || request.authoring.origins.some((origin) => !hasBasis({ origin, request }) || !request.authoring.inputs.some((input) => input.path === origin.path))) return refused({ code: "foreign-content", detail: "workflow reference authoring policy must match the context and requested source basis" });
  if (request.scopeFiles.length === 0 || request.scopeFiles.some((file) => file.kind !== "file" || (!file.path.startsWith(`${request.context.directory}/scopes/`) || !/^aidlc-[a-z][a-z0-9-]*\.md$/.test(file.path.slice(`${request.context.directory}/scopes/`.length)))) || new Set(request.scopeFiles.map((file) => file.path)).size !== request.scopeFiles.length) return refused({ code: "invalid-input", detail: "supply unique fresh core scope files before preparing their reference tables" });
  return { status: "ok", value: request };
};
const admitManifest = ({ snapshot, request }: { readonly snapshot: unknown; readonly request: WorkflowReferenceRequest }): Outcome<ReferenceManifest> => {
  const parsed = manifestSchema.safeParse(snapshot);
  if (!parsed.success) return refused({ code: "invalid-input", detail: "native authoring snapshot must declare the orchestrator skill and authored harness file mappings" });
  const manifest = parsed.data.manifest;
  const skill = manifest.orchestratorSkillPath;
  const profile = qualifiedHarnessProfile(request.context);
  if (profile === null) return refused({ detail: "workflow reference host profile is not qualified" });
  if (manifest.name !== request.context.harness || manifest.harnessDir !== request.context.directory || pathStatus({ path: skill }) !== "safe" || skill !== `${profile.skillRoot}/aidlc/SKILL.md` || !skill.endsWith("/SKILL.md")) return refused({ code: "foreign-content", detail: "native orchestrator skill must belong to the requested harness" });
  const destination = `${skill.slice(0, -"SKILL.md".length)}tables.md`;
  const declared = manifest.harnessFiles.filter((file) => `${request.context.directory}/${file.dst}` === destination && file.projectRoot !== true);
  const expected = [`harness/${request.context.harness}/manifest.ts`, "scripts/manifest-types.ts"];
  if ((profile.entryMapping === "manifest" ? declared.length !== 1 : declared.length !== 0) || parsed.data.inputs.length !== 2 || request.authoring.inputs.length !== 2 || expected.some((path) => parsed.data.inputs.filter((input) => input.path === path).length !== 1 || request.authoring.inputs.filter((input) => input.path === path).length !== 1) || parsed.data.inputs.some((input) => !request.authoring.inputs.some((previous) => previous.path === input.path && previous.sha256 === input.sha256))) return refused({ code: "foreign-content", detail: "reference template mapping and manifest witnesses must match the prepared authoring policy" });
  const source = profile.entryMapping === "manifest" ? declared[0]?.src : profile.referenceTemplate;
  return source === undefined || pathStatus({ path: source }) !== "safe" ? refused({ code: "invalid-input", detail: "reference template must be a safe authored harness path" }) : { status: "ok", value: { template: `harness/${request.context.harness}/${source}`, destination } };
};
const referenceLocations = ({ request, manifest }: { readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest }): readonly { readonly root: string; readonly path: string }[] => [
  ...[helperPath, utilityPath, formatterPath, manifest.template, ...(isNativeDocumentContext(request.context) ? nativeRuntimeSources : [])].map((path) => ({ root: request.sourceRoot, path })),
  ...[`${request.context.directory}/tools/aidlc-utility.ts`, `${request.context.directory}/tools/aidlc-compiled-tables.ts`, request.workflow.graph.origin.path, request.workflow.grid.origin.path, ...request.scopeFiles.map((file) => file.path)].map((path) => ({ root: request.root, path })),
];
const observeReference = async ({ request, manifest, operations }: { readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest; readonly operations: WorkflowReferenceOperations }): Promise<Outcome<ReferenceObservation>> => {
  const reads = await Promise.all(referenceLocations({ request, manifest }).map(async (location) => ({ ...location, observed: await operations.read(location) })));
  const failure = reads.find(({ observed }) => observed.status === "invalid");
  if (failure?.observed.status === "invalid") return failure.observed;
  const scopes = await operations.scopes({ root: request.root, directory: `${request.context.directory}/scopes` });
  return scopes.status === "invalid" ? scopes : { status: "ok", value: { files: reads.flatMap(({ root, path, observed }) => observed.status === "ok" ? [{ root, path, bytes: observed.value }] : []), scopes: scopes.value } };
};
const sameBytes = ({ first, second }: { readonly first: Uint8Array; readonly second: Uint8Array }) => first.length === second.length && first.every((byte, index) => byte === second[index]);
const findBytes = ({ observed, root, path }: { readonly observed: ReferenceObservation; readonly root: string; readonly path: string }): Uint8Array => observed.files.find((file) => file.root === root && file.path === path)?.bytes ?? new Uint8Array();
const admitRuntimeFacts = ({ observed, request, nativeText }: { readonly observed: ReferenceObservation; readonly request: WorkflowReferenceRequest; readonly nativeText?: (source: string) => string }): Outcome<ReferenceObservation> => {
  const expected = (path: string) => { const bytes = findBytes({ observed, root: request.sourceRoot, path }); return nativeText === undefined ? bytes : new TextEncoder().encode(nativeText(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes))); };
  const mismatch = [utilityPath, formatterPath].some((path) => !sameBytes({ first: expected(path), second: findBytes({ observed, root: request.root, path: `${request.context.directory}/${path.slice("core/".length)}` }) }));
  if (mismatch) return refused({ code: "foreign-content", detail: "runtime utility and compiled-table formatter must match their source-owned bytes" });
  if (!sameBytes({ first: findBytes({ observed, root: request.root, path: request.workflow.graph.origin.path }), second: new TextEncoder().encode(request.workflow.graph.text) }) || !sameBytes({ first: findBytes({ observed, root: request.root, path: request.workflow.grid.origin.path }), second: new TextEncoder().encode(request.workflow.grid.text) })) return refused({ code: "foreign-content", detail: "private runtime graph and grid must be the supplied fresh workflow compilation" });
  if (observed.scopes.length !== request.scopeFiles.length || new Set(observed.scopes).size !== observed.scopes.length || observed.scopes.some((path) => !request.scopeFiles.some((file) => file.path === path)) || request.scopeFiles.some((file) => !sameBytes({ first: findBytes({ observed, root: request.root, path: file.path }), second: new TextEncoder().encode(file.body) }))) return refused({ code: "foreign-content", detail: "private runtime scope inventory and bytes must match the caller's fresh scope projection" });
  return { status: "ok", value: observed };
};
const referenceEnvironment = ({ request, inherited }: { readonly request: WorkflowReferenceRequest; readonly inherited: Readonly<Record<string, string | undefined>> }): Readonly<Record<string, string | undefined>> => ({ ...privateCompilerEnvironment({ inherited, root: `${request.root}/.workflow-reference-home` }), ...Object.fromEntries([["AIDLC_SRC", `${request.root}/${request.context.directory}`], ["AIDLC_HARNESS_DIR", request.context.directory], ["AIDLC_HARNESS_NAME", request.context.harness], ["AIDLC_PROJECT_DIR", request.root], ["AIDLC_RUNTIME_PROJECT_DIR", request.root], ["AIDLC_RUNTIME_HARNESS_ROOT", `${request.root}/${request.context.directory}`], ["AIDLC_STAGE_GRAPH", `${request.root}/${request.workflow.graph.origin.path}`], ["AIDLC_SCOPE_GRID", `${request.root}/${request.workflow.grid.origin.path}`], ["AIDLC_SCOPES_DIR", `${request.root}/${request.context.directory}/scopes`]]) });
const nativeRegionReplySchema = ({ request, region }: { readonly request: WorkflowReferenceRequest; readonly region: Region }): z.ZodType<NativeRegionReply> => z.strictObject({
  exitCode: z.literal(0), error: z.null(), stderr: z.string().refine((diagnostics) => diagnostics.trim().length === 0),
  stdout: z.string().transform((output) => output.trimEnd()).refine((rendered) => rendered.startsWith(`${region.begin}\`${request.context.invocation} engine gen ${region.verb}\``) && rendered.endsWith(region.end)),
});
const admitNativeRegionReply = ({ reply, request, region }: { readonly reply: unknown; readonly request: WorkflowReferenceRequest; readonly region: Region }): Outcome<string> => {
  const admitted = nativeRegionReplySchema({ request, region }).safeParse(reply);
  if (admitted.success) return { status: "ok", value: admitted.data.stdout };
  return admitted.error.issues.some((issue) => issue.path[0] !== "stdout")
    ? refused({ detail: `native ${region.verb} generation unavailable or reported diagnostics` })
    : refused({ code: "invalid-input", detail: `native ${region.verb} output must contain its canonical copy invocation and complete region` });
};
const generateRegion = ({ request, region, operations, binary }: { readonly request: WorkflowReferenceRequest; readonly region: Region; readonly operations: WorkflowReferenceOperations; readonly binary: string }): Outcome<string> => {
  try {
    const reply = operations.process.spawn({ binary, args: ["--no-install", `${request.root}/${request.context.directory}/tools/aidlc-utility.ts`, region.verb], cwd: `${request.root}/${request.context.directory}`, input: "", env: referenceEnvironment({ request, inherited: operations.process.environment() }) });
    return admitNativeRegionReply({ reply, request, region });
  } catch { return refused({ detail: `native ${region.verb} process capability unavailable` }); }
};
const replaceRegion = ({ text, rendered, region, manifest, helper }: { readonly text: string; readonly rendered: string; readonly region: Region; readonly manifest: ReferenceManifest; readonly helper: ReferenceHelper }): Outcome<string> => {
  try {
    const parsed = replacementSchema.safeParse(helper.replaceGeneratedSkillRegion({ text, rendered, region, path: manifest.destination }));
    if (!parsed.success) return refused({ code: "invalid-input", detail: "source-owned region helper returned an unsupported result" });
    return parsed.data.status === "refused" ? refused({ code: "invalid-input", detail: parsed.data.detail }) : { status: "ok", value: parsed.data.text };
  } catch { return refused({ detail: "source-owned region replacement capability unavailable" }); }
};
const prepareRegion = ({ previous, region, request, manifest, helper, operations, binary }: { readonly previous: Outcome<string>; readonly region: Region; readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest; readonly helper: ReferenceHelper; readonly operations: WorkflowReferenceOperations; readonly binary: string }): Outcome<string> => {
  if (previous.status === "invalid") return previous;
  const rendered = generateRegion({ request, region, operations, binary });
  return rendered.status === "invalid" ? rendered : replaceRegion({ text: previous.value, rendered: rendered.value, region, manifest, helper });
};
const decodeReferenceTemplate = ({ bytes }: { readonly bytes: Uint8Array }): Outcome<string> => {
  try { return { status: "ok", value: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).replace(/\r\n/g, "\n") }; }
  catch { return refused({ code: "invalid-input", detail: "authored workflow reference template must contain strict UTF-8" }); }
};
const renderReference = ({ request, manifest, observed, helper, operations, binary }: { readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest; readonly observed: ReferenceObservation; readonly helper: ReferenceHelper; readonly operations: WorkflowReferenceOperations; readonly binary: string }): Outcome<string> => {
  const template = decodeReferenceTemplate({ bytes: findBytes({ observed, root: request.sourceRoot, path: manifest.template }) });
  if (template.status === "invalid") return template;
  const projected = operations.prose({ markdown: template.value, context: request.context, subject: manifest.destination });
  return helper.GENERATED_SKILL_REGIONS.reduce<Outcome<string>>((previous, region) => prepareRegion({ previous, region, request, manifest, helper, operations, binary }), projected);
};
const finishReference = ({ before, after, text, request, manifest, witnessed }: { readonly before: ReferenceObservation; readonly after: ReferenceObservation; readonly text: string; readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest; readonly witnessed: readonly SourceContentDigest[] }): Outcome<PreparedWorkflowReference> => {
  if (before.files.some((file, index) => file.path !== after.files[index]?.path || file.root !== after.files[index]?.root || !sameBytes({ first: file.bytes, second: after.files[index]?.bytes ?? new Uint8Array() })) || before.scopes.length !== after.scopes.length || before.scopes.some((path) => !after.scopes.includes(path))) return refused({ detail: "workflow reference inputs changed during generation; retry from stable source and private runtime inputs" });
  const inputs = mergeSourceDigests({ groups: [request.authoring.inputs, request.workflow.inputs, witnessed] });
  return inputs.status === "invalid" ? inputs : { status: "ok", value: { file: { kind: "file", path: manifest.destination, body: text }, inputs: inputs.value } };
};
const admitReferenceWitnesses = ({ inputs }: { readonly inputs: readonly SourceContentDigest[] }): Outcome<ReferenceSourceWitnesses> => {
  const helper = inputs.find((input) => input.path === helperPath);
  return helper === undefined ? refused({ detail: "source-owned region helper witness unavailable" }) : { status: "ok", value: { inputs, helper } };
};
const prepareReferenceWitnesses = ({ observed, sourceRoot, digest }: { readonly observed: ReferenceObservation; readonly sourceRoot: string; readonly digest: WorkflowReferenceOperations["digest"] }): Outcome<ReferenceSourceWitnesses> => admitReferenceWitnesses({ inputs: observed.files.filter((file) => file.root === sourceRoot).map((file) => ({ path: file.path, sha256: digest({ bytes: file.bytes }) })) });
const admitReferenceHelper = ({ imported }: { readonly imported: unknown }): Outcome<ReferenceHelper> => {
  const helper = helperSchema.safeParse(imported);
  return helper.success ? { status: "ok", value: helper.data } : refused({ code: "invalid-input", detail: "source helper must expose stage-then-scope regions and the region replacement capability" });
};
const prepareReferenceInputs = async ({ request, manifest, operations, binary }: { readonly request: WorkflowReferenceRequest; readonly manifest: ReferenceManifest; readonly operations: WorkflowReferenceOperations; readonly binary: string }): Promise<Outcome<PreparedWorkflowReference>> => {
  const before = await observeReference({ request, manifest, operations });
  if (before.status === "invalid") return before;
  let nativeText: ((source: string) => string) | undefined;
  if (isNativeDocumentContext(request.context)) {
    const bytes = findBytes({ observed: before.value, root: request.sourceRoot, path: nativeRuntimePath });
    const loaded = await operations.module({ sourceRoot: request.sourceRoot, path: nativeRuntimePath, sha256: operations.digest({ bytes }) });
    if (loaded.status === "invalid") return loaded;
    const policy = z.object({ prepareNativeRuntimeText: z.function({ input: [z.string(), z.string(), z.string().optional()], output: z.string() }) }).safeParse(loaded.value);
    if (!policy.success) return refused({ detail: "workflow reference runtime comparison requires source-owned native text preparation" });
    nativeText = source => policy.data.prepareNativeRuntimeText(source, request.context.directory, request.context.harness);
  }
  const facts = admitRuntimeFacts({ observed: before.value, request, ...(nativeText === undefined ? {} : { nativeText }) });
  if (facts.status === "invalid") return facts;
  const witnessed = prepareReferenceWitnesses({ observed: facts.value, sourceRoot: request.sourceRoot, digest: operations.digest });
  if (witnessed.status === "invalid") return witnessed;
  const loaded = await operations.module({ sourceRoot: request.sourceRoot, path: helperPath, sha256: witnessed.value.helper.sha256 });
  if (loaded.status === "invalid") return loaded;
  const helper = admitReferenceHelper({ imported: loaded.value });
  if (helper.status === "invalid") return helper;
  const text = renderReference({ request, manifest, observed: facts.value, helper: helper.value, operations, binary });
  if (text.status === "invalid") return text;
  const after = await observeReference({ request, manifest, operations });
  if (after.status === "invalid") return after;
  const commands = prepareDocumentCommands({ sourceRoot: request.sourceRoot, basis: request.basis, context: request.context, documents: [{ path: manifest.destination, source: text.value }] });
  if (commands.status === "invalid") return commands;
  const document = commands.value.documents[0];
  if (document === undefined) return refused({ detail: "workflow reference native command preparation returned no document" });
  return finishReference({ before: facts.value, after: after.value, text: document.text, request, manifest, witnessed: [...witnessed.value.inputs, ...commands.value.inputs] });
};
const prepareReference = async ({ request, operations, binary }: { readonly request: WorkflowReferenceRequest; readonly operations: WorkflowReferenceOperations; readonly binary: string }): Promise<Outcome<PreparedWorkflowReference>> => {
  try {
    const admitted = admitReferenceRequest({ request });
    if (admitted.status === "invalid") return admitted;
    const snapshot = await operations.authoring({ sourceRoot: request.sourceRoot, basis: request.basis, binding: request.context });
    if (snapshot.status === "invalid") return snapshot;
    const manifest = admitManifest({ snapshot: snapshot.value, request });
    return manifest.status === "invalid" ? manifest : await prepareReferenceInputs({ request, manifest: manifest.value, operations, binary });
  } catch { return refused({ detail: "workflow reference preparation capability unavailable" }); }
};
export const createWorkflowReferencePreparer = ({ binary = "bun", operations = createWorkflowReferenceOperations() }: { readonly binary?: string; readonly operations?: WorkflowReferenceOperations } = {}): WorkflowReferencePreparer => ({ prepare: (request) => prepareReference({ request, operations, binary }) });
