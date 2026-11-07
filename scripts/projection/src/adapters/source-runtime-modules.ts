import { z } from "zod";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import type { PreparedRuntimeInput, RuntimeInputPreparer, RuntimeInputRequest } from "../domain/runtime-inputs.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

const requiredSources = ["scripts/projection-text.ts", "scripts/version-module.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-version.ts"];
export type SourceRuntimeModuleOperations = NativeCompilerProcessOperations & { readonly paths: (request: RuntimeInputRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceRuntimeModuleOperations = ({ create = createNativeCompilerProcessOperations }: { readonly create?: typeof createNativeCompilerProcessOperations } = {}): SourceRuntimeModuleOperations => ({
  ...create({ timeout: 30000, maxBuffer: 32 * 1024 * 1024 }),
  paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }),
});

const worker = `
const request = await Bun.stdin.json();
const required = ["scripts/projection-text.ts", "scripts/version-module.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-version.ts"];
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceFiles = async directory => {
  const fs = await import("node:fs/promises");
  const groups = await Promise.all((await fs.readdir(request.sourceRoot + "/" + directory, { withFileTypes: true })).map(async entry => {
    const path = directory + "/" + entry.name;
    if (entry.isSymbolicLink()) throw new Error("symbolic runtime input");
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile()) throw new Error("unsupported runtime input");
    return [path];
  }));
  return groups.flat();
};
const observe = async () => {
  const paths = [...new Set([...required, ...(await Promise.all(["core/tools", "core/hooks"].map(sourceFiles))).flat()])].sort();
  return Promise.all(paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(request.sourceRoot + "/" + path).bytes()).digest("hex") })));
};
const module = path => import(Bun.pathToFileURL(request.sourceRoot + "/" + path).href);
const prepare = async () => {
  const before = await observe();
  const [text, version, commands, stamp] = await Promise.all(required.map(module));
  if (typeof text.substituteInvocationTokens !== "function" || typeof version.prepareVersionModuleText !== "function" || typeof commands.TRUSTED_ROUTE_NAMESPACE !== "string" || typeof stamp.AIDLC_VERSION !== "string") return unavailable({ detail: "upstream runtime text and version APIs unavailable" });
  const modules = before.map(input => input.path).filter(path => (path.startsWith("core/tools/") || path.startsWith("core/hooks/")) && path.endsWith(".ts")).map(path => path.slice("core/".length));
  const binding = { invoke: request.invoke, toolPrefix: "bun " + request.harnessDir + "/tools/", trustedNamespace: commands.TRUSTED_ROUTE_NAMESPACE };
  const files = await Promise.all(modules.map(async file => {
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await Bun.file(request.sourceRoot + "/core/" + file).bytes());
    const stamped = file.endsWith("/aidlc-version.ts") ? version.prepareVersionModuleText({ source, buildVersion: request.buildVersion ?? stamp.AIDLC_VERSION }) : { kind: "prepared", content: source };
    if (stamped.kind !== "prepared") throw new Error(stamped.message);
    return { file, content: text.substituteInvocationTokens({ source: stamped.content, binding }) };
  }));
  const after = await observe();
  if (JSON.stringify(before) !== JSON.stringify(after)) return unavailable({ detail: "source runtime module inventories changed during preparation" });
  return { status: "ok", modules, files, inputs: before };
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch (error) { process.stdout.write(JSON.stringify(unavailable({ detail: "upstream runtime module preparation unavailable: " + (error instanceof Error ? error.message : String(error)) }))); }
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
const modulePathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && /^(?:tools|hooks)\/.+\.ts$/.test(path) ? "safe" : "unsafe";
const artifactPathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && (path.startsWith("tools/") || path.startsWith("hooks/") ) ? "safe" : "unsafe";
const witnessPathStatus = ({ path }: { readonly path: string }): "safe" | "unsafe" => pathStatus({ path }) === "safe" && (path.startsWith("core/tools/") || path.startsWith("core/hooks/") || path.startsWith("core/projection/") || path.startsWith("scripts/")) ? "safe" : "unsafe";
const uniquePaths = ({ paths }: { readonly paths: readonly string[] }): "unique" | "collision" => new Set(paths.map((path) => path.toLowerCase())).size === paths.length ? "unique" : "collision";
const admitModuleEvidence = ({ prepared }: { readonly prepared: PreparedModuleReply }): Outcome<PreparedModuleReply> => {
  const inputs = prepared.inputs.map((input) => input.path);
  const files = prepared.files.map((file) => file.file);
  if (requiredSources.some((path) => !inputs.includes(path)) || inputs.some((path) => witnessPathStatus({ path }) !== "safe") || uniquePaths({ paths: inputs }) !== "unique") return failure({ code: "foreign-content", detail: "runtime modules require complete unique safe core/tools, core/hooks, core/projection and scripts witnesses including all native APIs" });
  if (prepared.modules.some((path) => modulePathStatus({ path }) !== "safe" || !inputs.includes(`core/${path}`) || !files.includes(path)) || uniquePaths({ paths: prepared.modules }) !== "unique") return failure({ code: "foreign-content", detail: "runtime modules require unique direct module witnesses and a prepared output for each module" });
  if (files.some((path) => artifactPathStatus({ path }) !== "safe") || uniquePaths({ paths: files }) !== "unique") return failure({ code: "foreign-content", detail: "runtime module outputs require unique safe tools/hooks resources" });
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
