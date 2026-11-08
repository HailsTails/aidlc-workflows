import { z } from "zod";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import type { PreparedRuntimeInput, RuntimeInputPreparer, RuntimeInputRequest } from "../domain/runtime-inputs.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

const directPaths = ["core/tools/aidlc-settings.ts", "core/tools/aidlc-model-policy.ts"];
export type SourceRuntimeContractOperations = NativeCompilerProcessOperations & { readonly paths: (request: RuntimeInputRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceRuntimeContractOperations = ({ processes = createNativeCompilerProcessOperations }: { readonly processes?: NativeCompilerProcessFactory } = {}): SourceRuntimeContractOperations => ({ ...processes(), paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }) });
const worker = `
const input = await Bun.stdin.json();
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceFiles = async ({ directory }) => {
  const fs = await import("node:fs/promises");
  const entries = await fs.readdir(input.sourceRoot + "/" + directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async entry => {
    const path = directory + "/" + entry.name;
    if (entry.isSymbolicLink()) return { status: "unavailable" };
    if (entry.isDirectory()) return sourceFiles({ directory: path });
    return entry.isFile() ? { status: "ok", paths: [path] } : { status: "unavailable" };
  }));
  if (groups.some(group => group.status !== "ok")) return { status: "unavailable" };
  return { status: "ok", paths: groups.flatMap(group => group.paths) };
};
const observe = async () => {
  try {
    const agents = await sourceFiles({ directory: "core/agents" });
    if (agents.status !== "ok") return unavailable({ detail: "source runtime contract agent inventory unavailable" });
    const paths = [...input.paths, ...agents.paths.sort()];
    return { status: "ok", inputs: await Promise.all(paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.sourceRoot + "/" + path).bytes()).digest("hex") }))) };
  } catch { return unavailable({ detail: "source runtime contract inputs unavailable" }); }
};
const projectModules = ({ settings, policy }) => {
  if (!Object.hasOwn(settings, "AIDLC_SETTINGS_SCHEMA") || !Object.hasOwn(policy, "agentTiersFromAuthoredDirectory") || !Object.hasOwn(policy, "serializeAgentTiers")) return unavailable({ detail: "source runtime contract modules lack required native exports" });
  const schema = settings.AIDLC_SETTINGS_SCHEMA;
  const readTiers = policy.agentTiersFromAuthoredDirectory;
  const serializeTiers = policy.serializeAgentTiers;
  if (typeof schema !== "object" || schema === null || Array.isArray(schema) || typeof readTiers !== "function" || typeof serializeTiers !== "function") return unavailable({ detail: "source runtime contracts require a schema record and callable native tier APIs" });
  const tiers = readTiers(input.sourceRoot + "/core/agents");
  if (typeof tiers !== "object" || tiers === null || Array.isArray(tiers)) return unavailable({ detail: "source runtime tier API must return a record" });
  return { status: "ok", schema, serializedTiers: serializeTiers(tiers) };
};
const sourceModuleUrl = ({ sourceRoot, path, sha256 }) => Bun.pathToFileURL(sourceRoot + "/" + path).href + "?source=" + sha256;
const admitStableContracts = ({ before, after, projected }) => JSON.stringify(before.inputs) !== JSON.stringify(after.inputs)
  ? unavailable({ detail: "source runtime contract inputs changed during preparation" })
  : { ...projected, inputs: before.inputs };
const project = async ({ before }) => {
  try {
    const settings = await import(sourceModuleUrl({ sourceRoot: input.sourceRoot, path: input.paths[0], sha256: before.inputs[0].sha256 }));
    const policy = await import(sourceModuleUrl({ sourceRoot: input.sourceRoot, path: input.paths[1], sha256: before.inputs[1].sha256 }));
    return projectModules({ settings, policy });
  } catch { return unavailable({ detail: "source runtime contract APIs unavailable" }); }
};
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const projected = await project({ before });
  if (projected.status !== "ok") return projected;
  const after = await observe();
  if (after.status !== "ok") return after;
  return admitStableContracts({ before, after, projected });
};
const emit = async () => {
  try { return JSON.stringify(await prepare()); }
  catch { return JSON.stringify(unavailable({ detail: "source runtime contracts could not produce JSON data" })); }
};
process.stdout.write(await emit());
`;
const witnessSchema = z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const replySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }),
  z.strictObject({ status: z.literal("ok"), schema: z.record(z.string(), z.unknown()), serializedTiers: z.string().min(1), inputs: z.array(witnessSchema).min(2) }),
]);
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-json" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-runtime-contracts", detail })] });
const admitRequest = ({ request }: { readonly request: RuntimeInputRequest }): Outcome<RuntimeInputRequest> => {
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777) return failure({ code: "invalid-input", detail: "source runtime contracts require a file permission mode between 0 and 0777" });
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin)) return failure({ code: "foreign-content", detail: "source runtime contracts require the framework source basis and full source pin" });
  return { status: "ok", value: request };
};
const encodeContracts = ({ prepared, request }: { readonly prepared: Extract<z.infer<typeof replySchema>, { readonly status: "ok" }>; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => {
  const paths = prepared.inputs.map((input) => input.path);
  if (paths[0] !== directPaths[0] || paths[1] !== directPaths[1] || new Set(paths).size !== paths.length || paths.slice(2).some((path) => !path.startsWith("core/agents/") || pathStatus({ path }) !== "safe")) return failure({ code: "foreign-content", detail: "source runtime contracts require both direct module witnesses and unique safe authored core agent paths" });
  const schemaPath = `${request.binding.directory}/tools/data/aidlc-settings.schema.json`;
  const tiersPath = `${request.binding.directory}/tools/data/agent-tiers.json`;
  return { status: "ok", value: { files: [{ path: schemaPath, mode: request.mode, bytes: new TextEncoder().encode(`${JSON.stringify(prepared.schema, null, 2)}\n`) }, { path: tiersPath, mode: request.mode, bytes: new TextEncoder().encode(prepared.serializedTiers) }], preparation: { kind: "runtime-contracts", paths: [schemaPath, tiersPath], inputs: prepared.inputs } } };
};
const decodeContracts = ({ stdout, request }: { readonly stdout: string; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => {
  let candidate: unknown;
  try { candidate = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-json", detail: "source runtime contract process must return one JSON response" }); }
  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return failure({ detail: "source runtime contracts require a native schema record, serialized tiers and SHA-256 source witnesses" });
  return parsed.data.status === "unavailable" ? failure({ detail: parsed.data.detail }) : encodeContracts({ prepared: parsed.data, request });
};
const admitProcess = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: RuntimeInputRequest }): Outcome<PreparedRuntimeInput> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0 ? failure({ detail: "source runtime contract process unavailable or reported diagnostics" }) : decodeContracts({ stdout: reply.stdout, request });
const contractEnvironment = ({ inherited, root }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly root: string }): Readonly<Record<string, string | undefined>> => ({ ...privateCompilerEnvironment({ inherited, root: `${root}/.source-runtime-contract-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"]]) });
const prepareContracts = ({ request, binary, operations }: { readonly request: RuntimeInputRequest; readonly binary: string; readonly operations: SourceRuntimeContractOperations }): Outcome<PreparedRuntimeInput> => {
  try {
    const paths = operations.paths(request);
    return admitProcess({ reply: operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, input: JSON.stringify({ sourceRoot: paths.sourceRoot, paths: directPaths }), env: contractEnvironment({ inherited: operations.environment(), root: paths.root }) }), request });
  }
  catch { return failure({ detail: "source runtime contract process capability unavailable" }); }
};
export const createSourceRuntimeContractPreparer = ({ binary = "bun", processes = createNativeCompilerProcessOperations, operations = createSourceRuntimeContractOperations({ processes }) }: { readonly binary?: string; readonly processes?: NativeCompilerProcessFactory; readonly operations?: SourceRuntimeContractOperations } = {}): RuntimeInputPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : prepareContracts({ request: admitted.value, binary, operations });
} });
