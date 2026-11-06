import { z } from "zod";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";
import { claudeDistributionDescriptionPaths, type DistributionDescriptionRequest, type DistributionDescriptionPreparer, type PreparedDistributionDescription } from "../domain/distribution-description.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { continuePreparation } from "../application/preparation-result.ts";

const sourcePaths = ["scripts/projection-metadata.ts", "scripts/manifest-types.ts", "harness/claude/manifest.ts", "harness/claude/onboarding.fills.ts", "harness/claude/.mcp.json", "harness/claude/dot-gitignore", "core/tools/aidlc-distribution.ts", "core/tools/aidlc-root-integration-codec.ts", "core/tools/aidlc-projection-path.ts", "core/tools/aidlc-channel.ts", "core/tools/aidlc-version.ts"];
export type SourceDescriptionOperations = NativeCompilerProcessOperations & { readonly paths: (input: DistributionDescriptionRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceDescriptionOperations = (): SourceDescriptionOperations => ({ ...createNativeCompilerProcessOperations(), paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }) });
const replySchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), files: z.array(z.strictObject({ file: z.string(), bytes: z.array(z.number().int().min(0).max(255)) })), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }), z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string() })]);
const worker = `
const input = await Bun.stdin.json();
const paths = ${JSON.stringify(sourcePaths)};
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
  const [manifest, metadata, distribution, version] = await Promise.all([loadModule({ path: "harness/claude/manifest.ts" }), loadModule({ path: "scripts/projection-metadata.ts" }), loadModule({ path: "core/tools/aidlc-distribution.ts" }), loadModule({ path: "core/tools/aidlc-version.ts" })]);
  return { manifest, metadata, distribution, version };
};
const rootMappings = [{ src: ".mcp.json", dst: ".mcp.json" }, { src: "dot-gitignore", dst: ".gitignore" }];
const admitNative = ({ manifest, metadata, distribution, version }) => {
  const declaration = manifest.default;
  if (declaration?.name !== "claude" || declaration?.harnessDir !== ".claude" || !Array.isArray(declaration.harnessFiles)) return unavailable({ detail: "distribution description requires the authored Claude manifest" });
  const mappings = declaration.harnessFiles.filter(mapping => mapping.projectRoot === true);
  if (mappings.length !== 2 || rootMappings.some(expected => mappings.filter(mapping => mapping.src === expected.src && mapping.dst === expected.dst).length !== 1)) return unavailable({ detail: "distribution description qualifies the two declared Claude root mappings only" });
  if (typeof metadata.prepareProjectionMetadata !== "function" || typeof distribution.sha256Bytes !== "function" || typeof version.AIDLC_VERSION !== "string") return unavailable({ detail: "source-owned metadata planning, hashing and version capabilities unavailable" });
  return { status: "ok", declaration, prepare: metadata.prepareProjectionMetadata, digest: distribution.sha256Bytes, buildVersion: version.AIDLC_VERSION };
};
const loadNative = async () => admitNative(await importNative());
const admitRoot = ({ bytes, mapping, digest }) => {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.includes("{{")) return null;
    return { path: mapping.dst, fileName: mapping.dst, bytes, sha256: digest(bytes) };
};
const collectRoots = ({ roots }) => roots.some(root => root === null) ? unavailable({ detail: "authored root mappings containing projection tokens need their native text owner before publication" }) : { status: "ok", roots };
const readRoots = async ({ digest }) => collectRoots({ roots: await Promise.all(rootMappings.map(async mapping => admitRoot({ bytes: await Bun.file(input.sourceRoot + "/harness/claude/" + mapping.src).bytes(), mapping, digest }))) });
const admitPrepared = ({ prepared, roots }) => {
  if (prepared?.kind === "refused") return { status: "refused", detail: typeof prepared.message === "string" ? prepared.message : "native metadata preparation refused" };
  if (prepared?.kind !== "prepared" || !Array.isArray(prepared.artifacts) || prepared.artifacts.some(artifact => typeof artifact.file !== "string" || !(artifact.bytes instanceof Uint8Array))) return unavailable({ detail: "native metadata preparation must return byte artifacts" });
  return { status: "ok", files: [...roots.map(root => ({ file: root.path, bytes: Array.from(root.bytes) })), ...prepared.artifacts.map(artifact => ({ file: artifact.file, bytes: Array.from(artifact.bytes) }))] };
};
const prepareNative = ({ native, roots }) => admitPrepared({ prepared: native.prepare({ declaration: native.declaration, files: input.files, directories: input.directories, rootFiles: roots, buildVersion: native.buildVersion }), roots });
const retainStable = ({ before, after, prepared }) => after.status !== "ok" || JSON.stringify(before.inputs) !== JSON.stringify(after.inputs) ? unavailable({ detail: "distribution description source changed during preparation" }) : { ...prepared, inputs: after.inputs };
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const native = await loadNative();
  if (native.status !== "ok") return native;
  const roots = await readRoots({ digest: native.digest });
  if (roots.status !== "ok") return roots;
  const prepared = prepareNative({ native, roots: roots.roots });
  if (prepared.status !== "ok") return prepared;
  return retainStable({ before, after: await observe(), prepared });
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch { process.stdout.write(JSON.stringify(unavailable({ detail: "distribution description authored inputs or native preparation unavailable" }))); }
`;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-distribution-description", detail })] });
const admitReply = ({ reply, request }: { readonly reply: z.infer<typeof replySchema> & { readonly status: "ok" }; readonly request: DistributionDescriptionRequest }): Outcome<PreparedDistributionDescription> => {
  const files = reply.files.map((file) => file.file);
  const expected = claudeDistributionDescriptionPaths();
  if (files.length !== expected.length || expected.some((path) => files.filter((file) => file === path).length !== 1) || reply.inputs.length !== sourcePaths.length || sourcePaths.some((path) => reply.inputs.filter((input) => input.path === path).length !== 1)) return failure({ code: "foreign-content", detail: "distribution description must retain every declared source witness and exactly its six producer artifacts" });
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
const admitRequest = ({ request }: { readonly request: DistributionDescriptionRequest }): Outcome<DistributionDescriptionRequest> => request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || request.binding.harness !== "claude" || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777
  ? failure({ detail: "distribution description requires the pinned framework Claude copy profile and explicit file modes" }) : { status: "ok", value: request };
const admitWorkingPaths = ({ paths }: { readonly paths: { readonly sourceRoot: string; readonly root: string } }): Outcome<{ readonly sourceRoot: string; readonly root: string }> => {
    const source = paths.sourceRoot.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
    const root = paths.root.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
    return root === "" || source === "" || root === source || root.startsWith(`${source}/`) ? failure({ detail: "distribution description requires a working root outside authored source" }) : { status: "ok", value: paths };
};
const processInput = ({ paths, request, binary, operations }: { readonly paths: { readonly sourceRoot: string; readonly root: string }; readonly request: DistributionDescriptionRequest; readonly binary: string; readonly operations: SourceDescriptionOperations }) => {
    const env = { ...privateCompilerEnvironment({ inherited: operations.environment(), root: `${paths.root}/.description-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) };
    return { binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, env, input: JSON.stringify({ sourceRoot: paths.sourceRoot, files: request.files, directories: request.directories }) };
};
const execute = async ({ request, binary, operations }: { readonly request: DistributionDescriptionRequest; readonly binary: string; readonly operations: SourceDescriptionOperations }): Promise<Outcome<PreparedDistributionDescription>> => {
  try { return await continuePreparation({ previous: admitWorkingPaths({ paths: operations.paths(request) }), consume: ({ prepared: paths }) => processOutcome({ reply: operations.spawn(processInput({ paths, request, binary, operations })), request }) }); }
  catch { return failure({ detail: "distribution description process capability unavailable" }); }
};
export const createSourceDescriptionPreparer = ({ binary = "bun", operations = createSourceDescriptionOperations() }: { readonly binary?: string; readonly operations?: SourceDescriptionOperations } = {}): DistributionDescriptionPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : execute({ request: admitted.value, binary, operations });
} });
