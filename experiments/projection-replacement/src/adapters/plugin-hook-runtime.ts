import { z } from "zod";
import { finding, identifierStatus, pathStatus, type Outcome } from "../domain/model.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { PluginHookRuntimeRequest, PluginHookRuntimePreparer, PreparedPluginHookRuntime } from "../domain/plugin-hook-runtime.ts";
import { privateCompilerEnvironment, createNativeCompilerProcessOperations, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";
import { createTemporaryDirectoryOperations } from "./temporary-directory.ts";
import { withTemporaryDirectory, type TemporaryDirectoryOperations } from "../application/temporary-directory.ts";
const pluginHookRuntimeProgram = `
const input = await Bun.stdin.json();
const loadRuntimeApi = async ({ sourceRoot }) => {
  const runtimePath = sourceRoot + "/scripts/plugin-runtime.ts";
  const inventoryPath = sourceRoot + "/core/tools/aidlc-plugin-validate.ts";
  if (!(await Bun.file(runtimePath).exists()) || !(await Bun.file(inventoryPath).exists())) return { status: "unavailable", detail: "source-owned plugin runtime API unavailable" };
  const runtime = await import(Bun.pathToFileURL(runtimePath).href);
  const inventory = await import(Bun.pathToFileURL(inventoryPath).href);
  if (typeof runtime.preparePluginRuntimeArtifacts !== "function" || typeof runtime.createPluginRuntimePort !== "function" || typeof inventory.walkPluginFiles !== "function" || typeof inventory.classifyPluginSourceFile !== "function") return { status: "unavailable", detail: "source-owned plugin runtime exports unavailable" };
  return { status: "ok", value: { runtime, inventory } };
};
const pluginSourceRoot = ({ sourceRoot, pluginId }) => sourceRoot.replace(/[\\\\/]$/, "") + "/plugins/" + pluginId;
const admitRuntimeSources = ({ sources }) => sources.length === 0
  ? { status: "refused", detail: "authored plugin hook runtime inventory is empty" }
  : { status: "ok", value: sources };
const readRuntimeSources = async ({ inventory, pluginRoot }) => {
  const paths = inventory.walkPluginFiles(pluginRoot + "/hooks").filter(file => inventory.classifyPluginSourceFile({ pluginRoot, file }) === "runtime");
  const sources = await Promise.all(paths.map(async path => ({ file: path.replaceAll("\\\\", "/").slice(pluginRoot.replaceAll("\\\\", "/").length + 1), source: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await Bun.file(path).bytes()) })));
  return admitRuntimeSources({ sources });
};
const runtimeModuleSources = ({ sources }) => sources.filter(entry => /\\.[cm]?[jt]s$/.test(entry.file) && !/\\.d\\.[cm]?ts$/.test(entry.file));
const runtimeCompileRequest = ({ runtime, sourceRoot, pluginRoot, sources }) => {
  const modules = runtimeModuleSources({ sources });
  return { pluginRoot, files: sources.map(entry => entry.file), sources: modules, port: runtime.createPluginRuntimePort({ projectRoot: sourceRoot }), closedModules: modules.filter(entry => entry.file.endsWith(".ts")).map(entry => entry.file) };
};
const mergeRuntimeResources = ({ sources, artifacts }) => {
  const replacements = new Map(artifacts.map(entry => [entry.file, entry.content]));
  return [
    ...sources.map(entry => ({ path: entry.file, body: replacements.get(entry.file) ?? entry.source })),
    ...artifacts.filter(entry => !sources.some(source => source.file === entry.file)).map(entry => ({ path: entry.file, body: entry.content })),
  ];
};
const runtimeSourceDigests = ({ sources }) => sources.map(entry => ({ path: entry.file, sha256: new Bun.CryptoHasher("sha256").update(entry.source).digest("hex") }));
const preparedRuntimeResponse = ({ prepared, sources }) => {
  if (prepared.kind === "refused") return { status: "refused", detail: prepared.message };
  if (new Set(prepared.artifacts.map(entry => entry.file)).size !== prepared.artifacts.length) return { status: "refused", detail: "source runtime API emitted duplicate artifacts" };
  return { status: "ok", inputs: runtimeSourceDigests({ sources }), resources: mergeRuntimeResources({ sources, artifacts: prepared.artifacts }) };
};
const compileRuntimeSources = async ({ runtime, sourceRoot, pluginRoot, sources }) => preparedRuntimeResponse({
  prepared: await runtime.preparePluginRuntimeArtifacts(runtimeCompileRequest({ runtime, sourceRoot, pluginRoot, sources })), sources,
});
const continuePreparation = async ({ previous, consume }) => {
  const resolved = await previous;
  if (resolved.status !== "ok") return resolved;
  return consume(resolved.value);
};
const prepare = () => {
  const pluginRoot = pluginSourceRoot(input);
  return continuePreparation({ previous: loadRuntimeApi({ sourceRoot: input.sourceRoot }), consume: (api) => continuePreparation({
    previous: readRuntimeSources({ inventory: api.inventory, pluginRoot }),
    consume: (sources) => compileRuntimeSources({ runtime: api.runtime, sourceRoot: input.sourceRoot, pluginRoot, sources }),
  }) });
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch { process.stdout.write(JSON.stringify({ status: "unavailable", detail: "authored plugin hook runtime preparation failed; inspect source API, imports and dependency availability" })); }
`;


const entrypoint = "scripts/plugin-runtime.ts";
const hookPath = z.string().refine((path) => path.startsWith("hooks/") && pathStatus({ path }) === "safe");
const response = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), inputs: z.array(z.strictObject({ path: hookPath, sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1), resources: z.array(z.strictObject({ path: hookPath, body: z.string() })).min(1) }),
  z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string().min(1) }),
]);
const admitRequest = ({ request, sourceRoot, compiler }: { readonly request: PluginHookRuntimeRequest; readonly sourceRoot: string; readonly compiler: SourceBasis }): Outcome<PluginHookRuntimeRequest> => {
  if (request.binding.harness !== "claude" || request.binding.directory !== ".claude") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hook-runtime", detail: "authored hook runtime preparation is qualified for Claude only" })] };
  if (sourceRoot.trim().length === 0 || compiler.source.kind !== "core" || compiler.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(compiler.pin) || identifierStatus({ identifier: request.pluginId }) !== "valid") return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-hook-runtime", detail: "declare a pinned framework checkout and a canonical plugin identifier within that checkout" })] };
  return { status: "ok", value: request };
};
const decodeRuntime = ({ stdout, request, compiler }: { readonly stdout: string; readonly request: PluginHookRuntimeRequest; readonly compiler: SourceBasis }): Outcome<PreparedPluginHookRuntime> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); } catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "plugin-hook-runtime", detail: "runtime preparation must return one JSON response" })] }; }
  const parsed = response.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hook-runtime", detail: "runtime preparation requires nonempty hook-local files and source digests; unsupported outputs were not dropped" })] };
  const reply = parsed.data;
  if (reply.status !== "ok") return { status: "invalid", findings: [finding({ code: reply.status === "unavailable" ? "capability-gap" : "invalid-input", subject: "plugin-hook-runtime", detail: reply.detail })] };
  if (new Set(reply.inputs.map((entry) => entry.path)).size !== reply.inputs.length || new Set(reply.resources.map((entry) => entry.path)).size !== reply.resources.length || reply.inputs.some((entry) => !reply.resources.some((resource) => resource.path === entry.path))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-hook-runtime", detail: "runtime preparation must preserve every authored hook path exactly once with unique inputs and outputs" })] };
  return { status: "ok", value: { owner: { source: { kind: "plugin", id: request.pluginId }, pin: compiler.pin }, compiler: { ...compiler, path: entrypoint }, binding: request.binding, inputs: reply.inputs, resources: reply.resources.map((resource) => ({ kind: "file", ...resource })) } };
};
const runtimeProcessOutcome = ({ reply, request, compiler }: { readonly reply: NativeCompilerSpawnReply; readonly request: PluginHookRuntimeRequest; readonly compiler: SourceBasis }): Outcome<PreparedPluginHookRuntime> => reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hook-runtime", detail: "source hook runtime process unavailable; no artifacts issued" })] }
  : decodeRuntime({ stdout: reply.stdout, request, compiler });
const continueRuntimeRequest = ({ admitted, consume }: { readonly admitted: Outcome<PluginHookRuntimeRequest>; readonly consume: (request: PluginHookRuntimeRequest) => Promise<Outcome<PreparedPluginHookRuntime>> }): Promise<Outcome<PreparedPluginHookRuntime>> => admitted.status === "invalid" ? Promise.resolve(admitted) : consume(admitted.value);
const prepareRuntimeInDirectory = async ({ sourceRoot, compiler, binary, operations, request, root }: { readonly sourceRoot: string; readonly compiler: SourceBasis; readonly binary: string; readonly operations: NativeCompilerProcessOperations; readonly request: PluginHookRuntimeRequest; readonly root: string }): Promise<Outcome<PreparedPluginHookRuntime>> => runtimeProcessOutcome({
  reply: operations.spawn({ binary, args: ["--no-install", "--eval", pluginHookRuntimeProgram], cwd: root, env: privateCompilerEnvironment({ inherited: operations.environment(), root }), input: JSON.stringify({ sourceRoot, pluginId: request.pluginId }) }), request, compiler,
});
export const createPluginHookRuntimePreparer = ({ sourceRoot, compiler, binary = "bun", operations = createNativeCompilerProcessOperations(), directories = createTemporaryDirectoryOperations(), withinDirectory = withTemporaryDirectory }: { readonly sourceRoot: string; readonly compiler: SourceBasis; readonly binary?: string; readonly operations?: NativeCompilerProcessOperations; readonly directories?: TemporaryDirectoryOperations; readonly withinDirectory?: typeof withTemporaryDirectory }): PluginHookRuntimePreparer => ({
  prepare: (request) => continueRuntimeRequest({ admitted: admitRequest({ request, sourceRoot, compiler }), consume: (admitted) => withinDirectory({
    directories, consume: ({ root }) => prepareRuntimeInDirectory({ sourceRoot, compiler, binary, operations, request: admitted, root }),
  }) }),
});
