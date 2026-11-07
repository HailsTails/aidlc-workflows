import { observeKasInputs } from "./kas-source-contract.ts";
import { qualifiedHarnessProfile, qualifiedRootMappings, qualifiedDescriptionPaths } from "./qualified-harness-profile.ts";
import { createHash } from "node:crypto";
import { mergeSourceDigests } from "../domain/source-origin.ts";
import { z } from "zod";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";
import type { DistributionDescriptionRequest, DistributionDescriptionPreparer, PreparedDistributionDescription, PairedCopyDescription, DistributionBuildProfile } from "../domain/distribution-description.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import { continuePreparation } from "../application/preparation-result.ts";

const descriptionSourcePaths = (request: DistributionDescriptionRequest): readonly string[] => {
  const profile = qualifiedHarnessProfile(request.binding);
  if (profile === null) return [];
  const sourcePaths = ["scripts/projection/native/projection-metadata.ts", "scripts/manifest-types.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts", `harness/${profile.harness}/manifest.ts`, `harness/${profile.harness}/onboarding.fills.ts`, ...[...profile.rootMappings, ...profile.copyOnlyRoots].map(mapping => `harness/${profile.harness}/${mapping.src}`), "core/tools/aidlc-distribution.ts", "core/tools/aidlc-root-integration-codec.ts", "core/tools/aidlc-projection-path.ts", "core/tools/aidlc-channel.ts", "core/tools/aidlc-version.ts"];
  const nativeSourcePaths = ["scripts/projection/native/native-delivery.ts", "scripts/projection/src/domain/model.ts", "scripts/copy-era-files.json", "scripts/native-command-text.ts", "scripts/native-command-context.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts", "core/tools/aidlc-runtime-paths.ts"];
  return [...new Set([...(request.invocation === "aidlc" ? [...sourcePaths, ...nativeSourcePaths] : sourcePaths), ...(profile.nativePolicy === "kas-personas" ? observeKasInputs(request.sourceRoot).map(input => input.path) : [])])];
};
export type NativeDescriptionPair = { readonly profile: DistributionBuildProfile; readonly copy: PairedCopyDescription };
export type SourceDescriptionOperations = NativeCompilerProcessOperations & { readonly paths: (input: DistributionDescriptionRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceDescriptionOperations = (): SourceDescriptionOperations => ({ ...createNativeCompilerProcessOperations(), paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }) });
const replySchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), files: z.array(z.strictObject({ file: z.string(), bytes: z.array(z.number().int().min(0).max(255)) })), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }), z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string() })]);
const worker = `
const input = await Bun.stdin.json();
const paths = input.paths;
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceComponents = ({ path }) => {
  const segments = path.split("/");
  return [input.sourceRoot, ...segments.map((_, index) => input.sourceRoot + "/" + segments.slice(0, index + 1).join("/"))];
};
const sourceEligibility = ({ stats }) => stats.some((stat, index) => stat.isSymbolicLink() || (index === stats.length - 1 ? !stat.isFile() : !stat.isDirectory())) ? "unsupported" : "ordinary";
const sourceWitness = async ({ path, stats }) => sourceEligibility({ stats }) === "unsupported" ? null : { path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.sourceRoot + "/" + path).bytes()).digest("hex") };
const observeSourceFile = async ({ path, fileSystem }) => sourceWitness({ path, stats: await Promise.all(sourceComponents({ path }).map(component => fileSystem.lstat(component))) });
const collectWitnesses = ({ inputs }) => inputs.some(witness => witness === null) ? unavailable({ detail: "distribution description requires ordinary authored source files" }) : { status: "ok", inputs };
const observe = async () => {
  const fileSystem = await import("node:fs/promises");
  return collectWitnesses({ inputs: await Promise.all(paths.map(path => observeSourceFile({ path, fileSystem }))) });
};
const loadModule = ({ path }) => import(Bun.pathToFileURL(input.sourceRoot + "/" + path).href);
const importNative = async () => {
  const [manifest, metadata, distribution, version, channel] = await Promise.all([loadModule({ path: "harness/" + input.profile.harness + "/manifest.ts" }), loadModule({ path: "scripts/projection/native/projection-metadata.ts" }), loadModule({ path: "core/tools/aidlc-distribution.ts" }), loadModule({ path: "core/tools/aidlc-version.ts" }), loadModule({ path: "core/tools/aidlc-channel.ts" })]);
  return { manifest, metadata, distribution, version, channel };
};
const rootMappings = input.rootMappings;
const admitNative = ({ manifest, metadata, distribution, version, channel }) => {
  const declaration = manifest.default;
  if (declaration?.name !== input.profile.harness || declaration?.harnessDir !== input.profile.directory || !Array.isArray(declaration.harnessFiles)) return unavailable({ detail: "distribution description requires the qualified authored manifest" });
  const mappings = declaration.harnessFiles.filter(mapping => mapping.projectRoot === true);
  if (mappings.length !== input.profile.rootMappings.length + input.profile.copyOnlyRoots.length || [...input.profile.rootMappings, ...input.profile.copyOnlyRoots].some(expected => mappings.filter(mapping => mapping.src === expected.src && mapping.dst === expected.dst).length !== 1)) return unavailable({ detail: "distribution description qualifies the declared qualified root mappings only" });
  if (typeof metadata.prepareProjectionMetadata !== "function" || typeof distribution.sha256Bytes !== "function" || typeof version.AIDLC_VERSION !== "string" || typeof channel.releaseBuildVersion !== "function") return unavailable({ detail: "source-owned metadata planning, hashing and version capabilities unavailable" });
  return { status: "ok", declaration, prepare: metadata.prepareProjectionMetadata, digest: distribution.sha256Bytes, buildVersion: channel.releaseBuildVersion({ AIDLC_BUILD_VERSION: input.buildVersion }) };
};
const loadNative = async () => {
  const native = admitNative(await importNative());
  if (native.status !== "ok") return native;
  const policy = await loadModule({ path: "scripts/projection/src/adapters/qualified-delivery-policy.ts" });
  try { return { ...native, declaration: policy.prepareDeliveryDeclaration(native.declaration, input.profile, input.delivery) }; }
  catch (error) { return unavailable({ detail: error.message }); }
};
const admitRoot = ({ bytes, mapping, digest }) => {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.includes("{{")) return null;
    return { path: mapping.dst, fileName: mapping.dst, bytes, sha256: digest(bytes) };
};
const collectRoots = ({ roots }) => roots.some(root => root === null) ? unavailable({ detail: "authored root mappings containing projection tokens need their native text owner before publication" }) : { status: "ok", roots };
const readRoots = async ({ digest }) => {
  const roots = await Promise.all(rootMappings.map(async mapping => admitRoot({ bytes: await Bun.file(input.sourceRoot + "/harness/" + input.profile.harness + "/" + mapping.src).bytes(), mapping, digest })));
  for (const path of input.profile.projectedRootPaths) {
    const file = input.finalFiles.find(file => file.path === path);
    if (file === undefined) return unavailable({ detail: "projected root integration requires actual final encoded product bytes" });
    roots.push(admitRoot({ bytes: Buffer.from(file.base64, "base64"), mapping: { dst: path }, digest }));
  }
  return collectRoots({ roots });
};
const admitPrepared = ({ prepared, roots }) => {
  if (prepared?.kind === "refused") return { status: "refused", detail: typeof prepared.message === "string" ? prepared.message : "native metadata preparation refused" };
  if (prepared?.kind !== "prepared" || !Array.isArray(prepared.artifacts) || prepared.artifacts.some(artifact => typeof artifact.file !== "string" || !(artifact.bytes instanceof Uint8Array))) return unavailable({ detail: "native metadata preparation must return byte artifacts" });
  return { status: "ok", files: [...roots.filter(root => !input.profile.projectedRootPaths.includes(root.path)).map(root => ({ file: root.path, bytes: Array.from(root.bytes) })), ...prepared.artifacts.map(artifact => ({ file: artifact.file, bytes: Array.from(artifact.bytes) }))] };
};
const prepareNative = async ({ native, roots }) => {
  let prepared = native.prepare({ declaration: native.declaration, files: input.files, directories: input.directories, rootFiles: roots, buildVersion: native.buildVersion });
  if (input.nativeDelivery && prepared.kind === "prepared") {
    const delivery = await loadModule({ path: "scripts/projection/native/native-delivery.ts" });
    const history = await Bun.file(input.sourceRoot + "/scripts/copy-era-files.json").json();
    const namespaceLiterals = input.profile.nativePolicy === "kas-personas" ? [...native.declaration.frontmatterAdditions.map(item => ({ path: input.profile.directory + "/" + item.file, lines: item.lines })), { path: input.profile.directory + "/tools/data/plugin-agent.md", lines: native.declaration.pluginAgentFrontmatter }].map(item => ({ path: item.path, text: native.declaration.nativeReplacements.find(replacement => item.lines.join("\\n").includes(replacement.from)).to })) : [];
    const finalized = delivery.finalizeNativeMetadata({ namespaceLiterals, harnessDir: input.profile.directory, artifacts: [...roots.filter(root => !input.profile.projectedRootPaths.includes(root.path)).map(root => ({ file: root.path, bytes: root.bytes })), ...prepared.artifacts], nativeFiles: input.nativeDelivery.files.map(file => ({ path: file.path, bytes: Buffer.from(file.base64, "base64") })), copyFiles: input.nativeDelivery.copyFiles, history: history[input.profile.harness] });
    return admitPrepared({ prepared: finalized, roots: [] });
  }
  return admitPrepared({ prepared, roots });
};
const retainStable = ({ before, after, prepared }) => after.status !== "ok" || JSON.stringify(before.inputs) !== JSON.stringify(after.inputs) ? unavailable({ detail: "distribution description source changed during preparation" }) : { ...prepared, inputs: after.inputs };
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const native = await loadNative();
  if (native.status !== "ok") return native;
  const roots = await readRoots({ digest: native.digest });
  if (roots.status !== "ok") return roots;
  const prepared = await prepareNative({ native, roots: roots.roots });
  if (prepared.status !== "ok") return prepared;
  return retainStable({ before, after: await observe(), prepared });
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch { process.stdout.write(JSON.stringify(unavailable({ detail: "distribution description authored inputs or native preparation unavailable" }))); }
`;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-distribution-description", detail })] });
const admitReply = ({ reply, request }: { readonly reply: z.infer<typeof replySchema> & { readonly status: "ok" }; readonly request: DistributionDescriptionRequest }): Outcome<PreparedDistributionDescription> => {
  const sourcePaths = descriptionSourcePaths(request);
  const files = reply.files.map((file) => file.file);
  const expected = qualifiedDescriptionPaths(request.binding, request.invocation);
  if (files.length !== expected.length || expected.some((path) => files.filter((file) => file === path).length !== 1) || reply.inputs.length !== sourcePaths.length || sourcePaths.some((path) => reply.inputs.filter((input) => input.path === path).length !== 1)) return failure({ code: "foreign-content", detail: "distribution description must retain every declared source witness and exactly its qualified producer artifacts" });
  return { status: "ok", value: { files: reply.files.map((file) => ({ path: file.file, bytes: Uint8Array.from(file.bytes), mode: request.mode })), preparation: { kind: "distribution-metadata", paths: files, inputs: reply.inputs } } };
};
const decodeReply = ({ stdout, request }: { readonly stdout: string; readonly request: DistributionDescriptionRequest }): Outcome<PreparedDistributionDescription> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-input", detail: "distribution description process must return one JSON response" }); }
  const parsed = replySchema.safeParse(decoded);
  if (!parsed.success) return failure({ code: "invalid-input", detail: "distribution description requires byte artifacts and SHA-256 source witnesses or explicit unavailability" });
  return parsed.data.status === "ok" ? admitReply({ reply: parsed.data, request }) : failure({ code: parsed.data.status === "refused" ? "invalid-input" : "capability-gap", detail: parsed.data.detail });
};
const processOutcome = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: DistributionDescriptionRequest }): Outcome<PreparedDistributionDescription> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0 ? failure({ detail: "distribution description process unavailable or reported diagnostics" }) : decodeReply({ stdout: reply.stdout, request });
const admitRequest = ({ request }: { readonly request: DistributionDescriptionRequest }): Outcome<DistributionDescriptionRequest> => request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || qualifiedHarnessProfile(request.binding) === null || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777
  ? failure({ detail: "distribution description requires the pinned qualified framework profile and explicit file modes" }) : { status: "ok", value: request };
const admitWorkingPaths = ({ paths }: { readonly paths: { readonly sourceRoot: string; readonly root: string } }): Outcome<{ readonly sourceRoot: string; readonly root: string }> => {
    const source = paths.sourceRoot.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
    const root = paths.root.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
    return root === "" || source === "" || root === source || root.startsWith(`${source}/`) ? failure({ detail: "distribution description requires a working root outside authored source" }) : { status: "ok", value: paths };
};
const processInput = ({ paths, request, binary, operations, buildVersion, nativePair }: { readonly paths: { readonly sourceRoot: string; readonly root: string }; readonly request: DistributionDescriptionRequest; readonly binary: string; readonly operations: SourceDescriptionOperations; readonly buildVersion: string | undefined; readonly nativePair: NativeDescriptionPair | undefined }) => {
    const env = { ...privateCompilerEnvironment({ inherited: operations.environment(), root: `${paths.root}/.description-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) };
    return { binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, env, input: JSON.stringify({ sourceRoot: paths.sourceRoot, profile: qualifiedHarnessProfile(request.binding), delivery: request.invocation === "aidlc" ? "native" : "copy", rootMappings: qualifiedRootMappings(qualifiedHarnessProfile(request.binding)!, request.invocation === "aidlc" ? "native" : "copy"), finalFiles: request.finalFiles?.map(file => ({ path: file.path, base64: Buffer.from(file.bytes).toString("base64") })) ?? [], paths: descriptionSourcePaths(request), files: request.files, directories: request.directories, buildVersion, ...(request.invocation === "aidlc" && nativePair !== undefined ? { nativeDelivery: { files: request.finalFiles?.map(file => ({ path: file.path, base64: Buffer.from(file.bytes).toString("base64") })), copyFiles: nativePair.copy.files.map(file => ({ path: file.path, sha256: `sha256:${createHash("sha256").update(file.bytes).digest("hex")}` })) } } : {}) }) };
};
const execute = async ({ request, binary, operations, buildVersion, nativePair }: { readonly request: DistributionDescriptionRequest; readonly binary: string; readonly operations: SourceDescriptionOperations; readonly buildVersion: string | undefined; readonly nativePair: NativeDescriptionPair | undefined }): Promise<Outcome<PreparedDistributionDescription>> => {
  try { return await continuePreparation({ previous: admitWorkingPaths({ paths: operations.paths(request) }), consume: ({ prepared: paths }) => processOutcome({ reply: operations.spawn(processInput({ paths, request, binary, operations, buildVersion, nativePair })), request }) }); }
  catch { return failure({ detail: "distribution description process capability unavailable" }); }
};
export const createSourceDescriptionPreparer = ({ binary = "bun", operations = createSourceDescriptionOperations(), buildVersion, nativePair }: { readonly binary?: string; readonly operations?: SourceDescriptionOperations; readonly buildVersion?: string; readonly nativePair?: NativeDescriptionPair } = {}): DistributionDescriptionPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  if (admitted.status === "invalid") return admitted;
  if (request.invocation === "aidlc") {
    if (nativePair === undefined || request.finalFiles === undefined || nativePair.profile.buildVersion !== buildVersion || nativePair.copy.profile.buildVersion !== nativePair.profile.buildVersion || nativePair.copy.profile.environmentCap !== nativePair.profile.environmentCap || JSON.stringify(nativePair.copy.basis) !== JSON.stringify(request.basis)) return failure({ code: "foreign-content", detail: "native delivery requires final bytes and an explicitly paired copy artifact from the same source and version/cap profile" });
    const paths = [...request.finalFiles.map(file => file.path), ...(qualifiedDescriptionPaths(request.binding, request.invocation))];
    const copyPaths = nativePair.copy.files.map(file => file.path);
    const omitted = qualifiedHarnessProfile(request.binding)?.copyOnlyRoots.map(mapping => mapping.dst) ?? [];
    const expectedCopy = [...request.files, ...omitted];
    if ([paths, copyPaths, request.files, expectedCopy].some(inventory => new Set(inventory).size !== inventory.length || inventory.some(path => pathStatus({ path }) !== "safe")) || paths.length !== request.files.length || copyPaths.length !== expectedCopy.length || request.files.some(path => !paths.includes(path)) || expectedCopy.some(path => !copyPaths.includes(path))) return failure({ code: "foreign-content", detail: "native final bytes and metadata must cover their exact inventory; paired copy must add exactly the qualified copy-only roots" });
  } else if (nativePair !== undefined) return failure({ code: "foreign-content", detail: "copy delivery must not consume native finalization inputs" });
  const prepared = await execute({ request: admitted.value, binary, operations, buildVersion, nativePair });
  if (prepared.status === "invalid" || nativePair === undefined) return prepared;
  const inputs = mergeSourceDigests({ groups: [prepared.value.preparation.inputs, nativePair.copy.inputs] });
  return inputs.status === "invalid" ? inputs : { status: "ok", value: { ...prepared.value, preparation: { ...prepared.value.preparation, inputs: inputs.value } } };
} });
