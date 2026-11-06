import { z } from "zod";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import type { PreparedRuntimeInput, RuntimeInputPreparer, RuntimeInputRequest } from "../domain/runtime-inputs.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

const requiredSources = ["scripts/runtime-module.ts", "scripts/runtime-source.ts", "scripts/plugin-runtime.ts", "scripts/core-runtime.ts", "core/tools/aidlc-version.ts", "core/projection/plugin-hook-types.ts"];
export type SourceRuntimeModuleOperations = NativeCompilerProcessOperations & { readonly paths: (request: RuntimeInputRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceRuntimeModuleOperations = ({ create = createNativeCompilerProcessOperations }: { readonly create?: typeof createNativeCompilerProcessOperations } = {}): SourceRuntimeModuleOperations => ({
  ...create({ timeout: 30000, maxBuffer: 32 * 1024 * 1024 }),
  paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }),
});

const worker = `
const request = await Bun.stdin.json();
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceFiles = async ({ directory }) => {
  const fs = await import("node:fs/promises");
  const entries = await fs.readdir(request.sourceRoot + "/" + directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async entry => {
    const path = directory + "/" + entry.name;
    if (entry.isSymbolicLink()) return unavailable({ detail: "source runtime module inventory contains a symbolic link" });
    if (entry.isDirectory()) return sourceFiles({ directory: path });
    return entry.isFile() ? { status: "ok", paths: [path] } : unavailable({ detail: "source runtime module inventory contains an unsupported entry" });
  }));
  const failed = groups.find(group => group.status !== "ok");
  return failed ?? { status: "ok", paths: groups.flatMap(group => group.paths) };
};
const observe = async () => {
  try {
    const groups = await Promise.all(["core/tools", "core/hooks", "core/projection", "scripts"].map(directory => sourceFiles({ directory })));
    const failed = groups.find(group => group.status !== "ok");
    if (failed !== undefined) return failed;
    const paths = groups.flatMap(group => group.paths).sort();
    const inputs = await Promise.all(paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(request.sourceRoot + "/" + path).bytes()).digest("hex") })));
    return { status: "ok", inputs };
  } catch { return unavailable({ detail: "source runtime module inventories unavailable" }); }
};
const sourceModuleUrl = ({ path }) => Bun.pathToFileURL(request.sourceRoot + "/" + path).href;
const admitApis = ({ text, selection, compiler, core, version }) => {
  if (typeof text.prepareRuntimeModuleText !== "function" || typeof selection.runtimeSourceRole !== "function" || typeof version.AIDLC_VERSION !== "string" ||
    typeof compiler.createPluginRuntimeCompiler !== "function" || typeof compiler.createPluginRuntimeSourcePort !== "function" || typeof core.prepareCoreRuntimeArtifacts !== "function") {
    return unavailable({ detail: "source runtime module APIs require native text, selection, Core compiler and version exports" });
  }
  return { status: "ok", text, selection, compiler, core, version: version.AIDLC_VERSION };
};
const loadApis = async () => admitApis({
  text: await import(sourceModuleUrl({ path: "scripts/runtime-module.ts" })),
  selection: await import(sourceModuleUrl({ path: "scripts/runtime-source.ts" })),
  compiler: await import(sourceModuleUrl({ path: "scripts/plugin-runtime.ts" })),
  core: await import(sourceModuleUrl({ path: "scripts/core-runtime.ts" })),
  version: await import(sourceModuleUrl({ path: "core/tools/aidlc-version.ts" })),
});
const selectModules = ({ before, apis }) => {
  const paths = before.inputs.map(input => input.path).filter(path => (path.startsWith("core/tools/") || path.startsWith("core/hooks/")) && path.endsWith(".ts"));
  const classified = paths.map(path => ({ path, role: apis.selection.runtimeSourceRole({ file: path }) }));
  if (classified.some(module => module.role !== "runtime" && module.role !== "test")) return unavailable({ detail: "source runtime module selection returned an unknown role" });
  const selected = classified.filter(module => module.role === "runtime");
  if (selected.some(module => module.path.slice(module.path.startsWith("core/tools/") ? "core/tools/".length : "core/hooks/".length).includes("/"))) return unavailable({ detail: "nested core runtime modules require an explicit projection contract" });
  if (selected.length === 0) return unavailable({ detail: "source runtime module inventory has no direct runtime modules" });
  return { status: "ok", modules: selected.map(module => module.path.slice("core/".length)) };
};
const prepareText = async ({ file, apis }) => {
  const bytes = await Bun.file(request.sourceRoot + "/core/" + file).bytes();
  const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const prepared = apis.text.prepareRuntimeModuleText({ file: file.slice("tools/".length), source, harnessDir: request.harnessDir, invoke: request.invoke, sourceVersion: apis.version, buildVersion: apis.version });
  if (prepared.kind !== "prepared" || typeof prepared.content !== "string") return unavailable({ detail: "native runtime module text preparation refused: " + file });
  return { status: "ok", file, source, content: prepared.content };
};
const overlayArtifacts = ({ originals, compiled }) => {
  const overwritten = compiled.artifacts.find(artifact => originals.some(original => original.file === artifact.file && original.source !== original.content));
  if (overwritten !== undefined) return unavailable({ detail: "compiler overlay would discard prepared runtime module text: " + overwritten.file });
  const files = [...new Map([...originals.map(original => [original.file, { file: original.file, content: original.content }]), ...compiled.artifacts.map(artifact => [artifact.file, artifact])]).values()];
  return { status: "ok", files };
};
const admitCompiledHooks = ({ modules, compiled }) => {
  if (compiled.kind !== "prepared") return unavailable({ detail: "native Core runtime compiler refused preparation" });
  const missing = modules.filter(file => file.startsWith("hooks/")).find(file => !compiled.artifacts.some(artifact => artifact.file === file));
  return missing === undefined ? { status: "ok", compiled } : unavailable({ detail: "native Core runtime compiler omitted requested hook: " + missing });
};
const compileModules = async ({ apis, modules, originals }) => {
  const available = await apis.compiler.createPluginRuntimeCompiler({ projectRoot: request.sourceRoot });
  if (available.kind !== "ready") return unavailable({ detail: "native runtime module compiler unavailable" });
  const prepared = await apis.core.prepareCoreRuntimeArtifacts({ pluginRoot: request.sourceRoot + "/core", files: modules, sourcePort: apis.compiler.createPluginRuntimeSourcePort(), runtimePort: available.port });
  const admitted = admitCompiledHooks({ modules, compiled: prepared });
  return admitted.status !== "ok" ? admitted : overlayArtifacts({ originals, compiled: admitted.compiled });
};
const toolTextModules = ({ modules }) => modules.filter(file => file.startsWith("tools/"));
const prepareSelectedModules = async ({ apis, selected }) => {
  const originals = await Promise.all(toolTextModules({ modules: selected.modules }).map(file => prepareText({ file, apis })));
  const failed = originals.find(original => original.status !== "ok");
  if (failed !== undefined) return failed;
  return compileModules({ apis, modules: selected.modules, originals });
};
const project = async ({ before }) => {
  const apis = await loadApis();
  if (apis.status !== "ok") return apis;
  const selected = selectModules({ before, apis });
  if (selected.status !== "ok") return selected;
  const projected = await prepareSelectedModules({ apis, selected });
  return projected.status !== "ok" ? projected : { ...projected, modules: selected.modules };
};
const admitStableModules = ({ before, after, projected }) => JSON.stringify(before.inputs) !== JSON.stringify(after.inputs)
  ? unavailable({ detail: "source runtime module inventories changed during preparation" }) : { ...projected, inputs: before.inputs };
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const projected = await project({ before });
  if (projected.status !== "ok") return projected;
  const after = await observe();
  if (after.status !== "ok") return after;
  return admitStableModules({ before, after, projected });
};
const emit = async () => {
  try { return JSON.stringify(await prepare()); }
  catch { return JSON.stringify(unavailable({ detail: "source runtime module preparation API or source unavailable" })); }
};
process.stdout.write(await emit());
`;

const witnessSchema = z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const replySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }),
  z.strictObject({ status: z.literal("ok"), files: z.array(z.strictObject({ file: z.string(), content: z.string() })).min(1), modules: z.array(z.string()).min(1), inputs: z.array(witnessSchema).min(6) }),
]);
type PreparedModuleReply = Extract<z.infer<typeof replySchema>, { readonly status: "ok" }>;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-json" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-runtime-modules", detail })] });
const admitRequest = ({ request }: { readonly request: RuntimeInputRequest }): Outcome<RuntimeInputRequest> => {
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777) return failure({ code: "invalid-input", detail: "source runtime modules require a file permission mode between 0 and 0777" });
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin)) return failure({ code: "foreign-content", detail: "source runtime modules require the framework source basis and full source pin" });
  if (request.invocation !== `bun ${request.binding.directory}/tools/aidlc.ts`) return failure({ detail: "source runtime modules qualify explicit Bun copy invocation; missing or native-release invocation is unsupported" });
  return { status: "ok", value: request };
};
const modulePathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && /^(?:tools|hooks)\/[^/]+\.ts$/.test(path) ? "safe" : "unsafe";
const artifactPathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && (path.startsWith("tools/") || path.startsWith("hooks/") || path === "projection/plugin-hook-types.d.ts") ? "safe" : "unsafe";
const witnessPathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && (path.startsWith("core/tools/") || path.startsWith("core/hooks/") || path.startsWith("core/projection/") || path.startsWith("scripts/")) ? "safe" : "unsafe";
const uniquePaths = ({ paths }: { readonly paths: readonly string[] }): "unique" | "collision" => new Set(paths.map((path) => path.toLowerCase())).size === paths.length ? "unique" : "collision";
const admitModuleEvidence = ({ prepared }: { readonly prepared: PreparedModuleReply }): Outcome<PreparedModuleReply> => {
  const inputs = prepared.inputs.map((input) => input.path);
  const files = prepared.files.map((file) => file.file);
  if (requiredSources.some((path) => !inputs.includes(path)) || inputs.some((path) => witnessPathStatus({ path }) !== "safe") || uniquePaths({ paths: inputs }) !== "unique") return failure({ code: "foreign-content", detail: "runtime modules require complete unique safe core/tools, core/hooks, core/projection and scripts witnesses including all native APIs" });
  if (prepared.modules.some((path) => modulePathStatus({ path }) !== "safe" || !inputs.includes(`core/${path}`) || !files.includes(path)) || uniquePaths({ paths: prepared.modules }) !== "unique") return failure({ code: "foreign-content", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" });
  if (files.some((path) => artifactPathStatus({ path }) !== "safe") || uniquePaths({ paths: files }) !== "unique" || !files.includes("projection/plugin-hook-types.d.ts")) return failure({ code: "foreign-content", detail: "runtime module outputs require unique safe tools/hooks resources and the Core hook declaration" });
  return { status: "ok", value: prepared };
};
const encodeModules = ({ prepared, request }: { readonly prepared: PreparedModuleReply; readonly request: RuntimeInputRequest }): PreparedRuntimeInput => ({
  files: prepared.files.map((file) => ({ path: `${request.binding.directory}/${file.file}`, bytes: new TextEncoder().encode(file.content), mode: request.mode })),
  preparation: { kind: "runtime-modules", paths: prepared.files.map((file) => `${request.binding.directory}/${file.file}`), inputs: prepared.inputs },
});
const decodeModules = ({ stdout, request }: { readonly stdout: string; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => {
  let candidate: unknown;
  try { candidate = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-json", detail: "source runtime module process must return one JSON response" }); }
  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return failure({ detail: "source runtime modules require native text artifacts, selected modules and SHA-256 inventory witnesses" });
  if (parsed.data.status === "unavailable") return failure({ detail: parsed.data.detail });
  const admitted = admitModuleEvidence({ prepared: parsed.data });
  return admitted.status === "invalid" ? admitted : { status: "ok", value: encodeModules({ prepared: admitted.value, request }) };
};
const admitProcess = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0 ? failure({ detail: "source runtime module process unavailable or reported diagnostics" }) : decodeModules({ stdout: reply.stdout, request });
const moduleEnvironment = ({ inherited, root }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly root: string }): Readonly<Record<string, string | undefined>> => ({ ...privateCompilerEnvironment({ inherited, root: `${root}/.source-runtime-module-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"]]) });
const prepareModules = ({ request, binary, operations }: { readonly request: RuntimeInputRequest; readonly binary: string; readonly operations: SourceRuntimeModuleOperations }): Outcome<PreparedRuntimeInput> => {
  try {
    const paths = operations.paths(request);
    return admitProcess({ reply: operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, input: JSON.stringify({ sourceRoot: paths.sourceRoot, harnessDir: request.binding.directory, invoke: request.invocation }), env: moduleEnvironment({ inherited: operations.environment(), root: paths.root }) }), request });
  } catch { return failure({ detail: "source runtime module process capability unavailable" }); }
};
export const createSourceRuntimeModulePreparer = ({ binary = "bun", operations = createSourceRuntimeModuleOperations() }: { readonly binary?: string; readonly operations?: SourceRuntimeModuleOperations } = {}): RuntimeInputPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : prepareModules({ request: admitted.value, binary, operations });
} });
