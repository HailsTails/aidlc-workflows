import { z } from "zod";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import type { PreparedRuntimeInput, RuntimeInputPreparer, RuntimeInputRequest } from "../domain/runtime-inputs.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

const modulePath = "scripts/plugin-authoring-data.ts";
const templateRoot = "scripts/plugin-hooks-template/";
const canonicalFiles = ["tools/data/plugin-targets.json", "tools/data/plugin-authoring-context.json"];
export type SourcePluginAuthoringOperations = NativeCompilerProcessOperations & { readonly paths: (request: RuntimeInputRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourcePluginAuthoringOperations = (): SourcePluginAuthoringOperations => ({ ...createNativeCompilerProcessOperations(), paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }) });
const worker = `
const input = await Bun.stdin.json();
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceFiles = async ({ directory }) => {
  const fs = await import("node:fs/promises");
  const directoryPath = input.sourceRoot + "/" + directory;
  const observation = await fs.lstat(directoryPath);
  if (observation.isSymbolicLink() || !observation.isDirectory()) return unavailable({ detail: "plugin authoring inputs require real source directories" });
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async entry => {
    const path = directory + "/" + entry.name;
    if (entry.isSymbolicLink()) return unavailable({ detail: "plugin authoring source symlinks are unsupported" });
    if (entry.isDirectory()) return sourceFiles({ directory: path });
    return entry.isFile() ? { status: "ok", paths: [path] } : unavailable({ detail: "plugin authoring source requires ordinary files" });
  }));
  const refused = groups.find(group => group.status !== "ok");
  return refused ?? { status: "ok", paths: groups.flatMap(group => group.paths) };
};
const observe = async () => {
  try {
    const fs = await import("node:fs/promises");
    const root = await fs.lstat(input.sourceRoot);
    if (root.isSymbolicLink() || !root.isDirectory()) return unavailable({ detail: "plugin authoring source root must be a real directory" });
    const groups = await Promise.all(["core/agents", "core/aidlc-common/stages", "scripts", "harness"].map(directory => sourceFiles({ directory })));
    const refused = groups.find(group => group.status !== "ok");
    if (refused) return refused;
    const paths = groups.flatMap(group => group.paths).sort();
    return { status: "ok", inputs: await Promise.all(paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.sourceRoot + "/" + path).bytes()).digest("hex") }))) };
  } catch { return unavailable({ detail: "plugin authoring source inventory unavailable" }); }
};
const sourceModuleUrl = ({ path, inputs }) => {
  const witness = inputs.find(witness => witness.path === path);
  return witness ? Bun.pathToFileURL(input.sourceRoot + "/" + path).href + "?source=" + witness.sha256 : null;
};
const admitApi = ({ namespace }) => {
  if (!Object.hasOwn(namespace, "projectPluginTargets") || !Object.hasOwn(namespace, "preparePluginAuthoringArtifacts")) return unavailable({ detail: "plugin authoring native source lacks required exports" });
  const projectPluginTargets = namespace.projectPluginTargets;
  const preparePluginAuthoringArtifacts = namespace.preparePluginAuthoringArtifacts;
  return typeof projectPluginTargets === "function" && typeof preparePluginAuthoringArtifacts === "function" ? { status: "ok", projectPluginTargets, preparePluginAuthoringArtifacts } : unavailable({ detail: "plugin authoring native exports must be callable" });
};
const loadNativeApi = async ({ inputs }) => {
  const url = sourceModuleUrl({ path: "scripts/plugin-authoring-data.ts", inputs });
  if (url === null) return unavailable({ detail: "plugin authoring native source API is missing" });
  return admitApi({ namespace: await import(url) });
};
const selectManifestInputs = ({ inputs }) => {
  const paths = inputs.map(witness => witness.path).filter(path => {
    const segments = path.split("/");
    return segments.length === 3 && segments[0] === "harness" && segments[2] === "manifest.ts";
  });
  const names = paths.map(path => path.split("/")[1]).sort();
  return names.map(name => ({ name, path: "harness/" + name + "/manifest.ts" }));
};
const admitManifestNamespaces = ({ namespaces }) => {
  const declarations = namespaces.map(({ name, namespace }) => ({ name, manifest: namespace.default }));
  return declarations.length === 0 || declarations.some(declaration => typeof declaration.manifest !== "object" || declaration.manifest === null || Array.isArray(declaration.manifest))
    ? unavailable({ detail: "plugin authoring requires actual harness manifest declarations" }) : { status: "ok", declarations };
};
const loadDeclarations = async ({ inputs }) => {
  const namespaces = await Promise.all(selectManifestInputs({ inputs }).map(async ({ name, path }) => ({ name, namespace: await import(sourceModuleUrl({ path, inputs })) })));
  return admitManifestNamespaces({ namespaces });
};
const sourceNames = ({ inputs, prefix }) => inputs.filter(witness => witness.path.startsWith(prefix)).map(witness => witness.path.slice(witness.path.lastIndexOf("/") + 1));
const selectTemplateInputs = ({ inputs }) => inputs.filter(witness => witness.path.startsWith("scripts/plugin-hooks-template/"));
const loadTemplates = ({ inputs }) => Promise.all(selectTemplateInputs({ inputs }).map(async witness => ({ file: witness.path.slice("scripts/plugin-hooks-template/".length), bytes: await Bun.file(input.sourceRoot + "/" + witness.path).bytes() })));
const admitPreparedArtifacts = ({ prepared }) => {
  if (prepared?.kind === "refused" && typeof prepared.message === "string") return unavailable({ detail: prepared.message });
  if (prepared?.kind !== "prepared" || !Array.isArray(prepared.artifacts) || prepared.artifacts.some(artifact => typeof artifact.file !== "string" || !(artifact.bytes instanceof Uint8Array))) return unavailable({ detail: "plugin authoring native API must return prepared byte artifacts" });
  return { status: "ok", files: prepared.artifacts.map(artifact => ({ file: artifact.file, bytes: Array.from(artifact.bytes) })) };
};
const prepareNative = async ({ inputs }) => {
  try {
    const api = await loadNativeApi({ inputs });
    if (api.status !== "ok") return api;
    const declarations = await loadDeclarations({ inputs });
    if (declarations.status !== "ok") return declarations;
    const templates = await loadTemplates({ inputs });
    const targets = api.projectPluginTargets({ declarations: declarations.declarations });
    const prepared = api.preparePluginAuthoringArtifacts({ targets, agentNames: sourceNames({ inputs, prefix: "core/agents/" }), stageNames: sourceNames({ inputs, prefix: "core/aidlc-common/stages/" }), templates });
    return admitPreparedArtifacts({ prepared });
  } catch { return unavailable({ detail: "plugin authoring native source APIs unavailable" }); }
};
const admitStableAuthoring = ({ before, after, projected }) => JSON.stringify(before.inputs) === JSON.stringify(after.inputs)
  ? { ...projected, inputs: before.inputs } : unavailable({ detail: "plugin authoring source inputs changed during preparation" });
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const projected = await prepareNative({ inputs: before.inputs });
  if (projected.status !== "ok") return projected;
  const after = await observe();
  if (after.status !== "ok") return after;
  return admitStableAuthoring({ before, after, projected });
};
const emit = async () => {
  try { return JSON.stringify(await prepare()); }
  catch { return JSON.stringify(unavailable({ detail: "plugin authoring preparation could not produce JSON data" })); }
};
process.stdout.write(await emit());
`;
const witnessSchema = z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const replySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }),
  z.strictObject({ status: z.literal("ok"), files: z.array(z.strictObject({ file: z.string(), bytes: z.array(z.number().int().min(0).max(255)).max(8 * 1024 * 1024) })), inputs: z.array(witnessSchema).min(3) }),
]);
type PreparedAuthoringReply = Extract<z.infer<typeof replySchema>, { readonly status: "ok" }>;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-json" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-plugin-authoring", detail })] });
const admitRequest = ({ request }: { readonly request: RuntimeInputRequest }): Outcome<RuntimeInputRequest> => {
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777) return failure({ code: "invalid-input", detail: "plugin authoring requires a file permission mode between 0 and 0777" });
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin)) return failure({ code: "foreign-content", detail: "plugin authoring requires the framework source basis and full source pin" });
  return { status: "ok", value: request };
};
const sourcePathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && ["core/agents/", "core/aidlc-common/stages/", "scripts/", "harness/"].some((root) => path.startsWith(root)) ? "safe" : "unsafe";
const admitAuthoring = ({ prepared, request }: { readonly prepared: PreparedAuthoringReply; readonly request: RuntimeInputRequest }): Outcome<PreparedAuthoringReply> => {
  const inputs = prepared.inputs.map((input) => input.path);
  if ([modulePath, "scripts/manifest-types.ts", `harness/${request.binding.harness}/manifest.ts`].some((path) => !inputs.includes(path)) || inputs.some((path) => sourcePathStatus({ path }) !== "safe") || new Set(inputs.map((path) => path.toLowerCase())).size !== inputs.length) return failure({ code: "foreign-content", detail: "plugin authoring requires unique safe complete source inventory witnesses including its native API, manifest contract and selected harness" });
  const files = prepared.files.map((file) => file.file);
  const templatePaths = inputs.filter((path) => path.startsWith(templateRoot)).map((path) => `tools/data/plugin-hooks-template/${path.slice(templateRoot.length)}`);
  const required = [...canonicalFiles, ...templatePaths];
  if (new Set(files.map((path) => path.toLowerCase())).size !== files.length || files.some((path) => pathStatus({ path }) !== "safe" || !required.includes(path)) || required.some((path) => !files.includes(path))) return failure({ code: "foreign-content", detail: "plugin authoring must emit both native JSON files and exactly its witnessed template paths without aliases or collisions" });
  return { status: "ok", value: prepared };
};
const encodeAuthoring = ({ prepared, request }: { readonly prepared: PreparedAuthoringReply; readonly request: RuntimeInputRequest }): PreparedRuntimeInput => ({ files: prepared.files.map((file) => ({ path: `${request.binding.directory}/${file.file}`, bytes: Uint8Array.from(file.bytes), mode: request.mode })), preparation: { kind: "plugin-authoring", paths: prepared.files.map((file) => `${request.binding.directory}/${file.file}`), inputs: prepared.inputs } });
const decodeAuthoring = ({ stdout, request }: { readonly stdout: string; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => {
  let candidate: unknown;
  try { candidate = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-json", detail: "plugin authoring process must return one JSON response" }); }
  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return failure({ detail: "plugin authoring requires bounded byte artifacts and SHA-256 source witnesses" });
  if (parsed.data.status === "unavailable") return failure({ detail: parsed.data.detail });
  const admitted = admitAuthoring({ prepared: parsed.data, request });
  return admitted.status === "invalid" ? admitted : { status: "ok", value: encodeAuthoring({ prepared: admitted.value, request }) };
};
const admitProcess = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0 ? failure({ detail: "plugin authoring process unavailable or reported diagnostics" }) : decodeAuthoring({ stdout: reply.stdout, request });
const authoringEnvironment = ({ inherited, root }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly root: string }): Readonly<Record<string, string | undefined>> => ({ ...privateCompilerEnvironment({ inherited, root: `${root}/.source-plugin-authoring-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) });
const prepareAuthoring = ({ request, binary, operations }: { readonly request: RuntimeInputRequest; readonly binary: string; readonly operations: SourcePluginAuthoringOperations }): Outcome<PreparedRuntimeInput> => {
  try {
    const paths = operations.paths(request);
    return admitProcess({ reply: operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, input: JSON.stringify({ sourceRoot: paths.sourceRoot }), env: authoringEnvironment({ inherited: operations.environment(), root: paths.root }) }), request });
  } catch { return failure({ detail: "plugin authoring process capability unavailable" }); }
};
export const createSourcePluginAuthoringPreparer = ({ binary = "bun", operations = createSourcePluginAuthoringOperations() }: { readonly binary?: string; readonly operations?: SourcePluginAuthoringOperations } = {}): RuntimeInputPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : prepareAuthoring({ request: admitted.value, binary, operations });
} });
