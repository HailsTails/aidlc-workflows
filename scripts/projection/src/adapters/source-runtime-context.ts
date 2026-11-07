import { z } from "zod";
import { finding, type Outcome } from "../domain/model.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { DistributionContextLocation, DistributionContextReader, PreparedDistributionContext } from "../domain/distribution-context.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

export type SourceRuntimeContextOperations = NativeCompilerProcessOperations & {
  readonly paths: (input: DistributionContextLocation) => { readonly sourceRoot: string; readonly root: string };
};
export const createSourceRuntimeContextOperations = (): SourceRuntimeContextOperations => ({
  ...createNativeCompilerProcessOperations(),
  paths: ({ location }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(location.sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(location.root)) }),
});
const directSourcePaths = ({ binding }: { readonly binding: HarnessBinding }): readonly string[] => [`harness/${binding.harness}/manifest.ts`, `harness/${binding.harness}/onboarding.fills.ts`, "scripts/harness-runtime-data.ts", "core/tools/aidlc-runtime-paths.ts"];
const worker = `
const input = await Bun.stdin.json();
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const observe = async () => {
  try {
    return { status: "ok", inputs: await Promise.all(input.paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.sourceRoot + "/" + path).bytes()).digest("hex") }))) };
  } catch { return unavailable({ detail: "source runtime context direct inputs unavailable" }); }
};
const projectModules = ({ manifest, projector, runtime }) => {
  if (!Object.hasOwn(manifest, "default") || !Object.hasOwn(projector, "projectHarnessRuntimeData") || !Object.hasOwn(runtime, "aidlcInvocation")) return unavailable({ detail: "source runtime context modules lack the required native exports" });
  const declaration = manifest.default;
  const projectDescriptor = projector.projectHarnessRuntimeData;
  const invocation = runtime.aidlcInvocation;
  if (typeof declaration !== "object" || declaration === null || typeof projectDescriptor !== "function" || typeof invocation !== "function") return unavailable({ detail: "source runtime context modules require a native manifest and callable projection APIs" });
  return { status: "ok", descriptor: projectDescriptor({ declaration }), invocation: invocation() };
};
const admitStableContext = ({ before, after, projected }) => JSON.stringify(before.inputs) !== JSON.stringify(after.inputs)
  ? unavailable({ detail: "source runtime context direct inputs changed during preparation" })
  : { ...projected, inputs: before.inputs };
const sourceModuleUrl = ({ sourceRoot, path, sha256 }) => Bun.pathToFileURL(sourceRoot + "/" + path).href + "?source=" + sha256;
const project = async ({ before }) => {
  try {
    const manifest = await import(sourceModuleUrl({ sourceRoot: input.sourceRoot, path: input.paths[0], sha256: before.inputs[0].sha256 }));
    const projector = await import(sourceModuleUrl({ sourceRoot: input.sourceRoot, path: input.paths[2], sha256: before.inputs[2].sha256 }));
    const runtime = await import(sourceModuleUrl({ sourceRoot: input.sourceRoot, path: input.paths[3], sha256: before.inputs[3].sha256 }));
    return projectModules({ manifest, projector, runtime });
  } catch { return unavailable({ detail: "source runtime context projection API unavailable" }); }
};
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const projected = await project({ before });
  if (projected.status !== "ok") return projected;
  const after = await observe();
  if (after.status !== "ok") return after;
  return admitStableContext({ before, after, projected });
};
const emit = async () => {
  try { return JSON.stringify(await prepare()); }
  catch { return JSON.stringify(unavailable({ detail: "source runtime context could not produce JSON data" })); }
};
process.stdout.write(await emit());
`;
type NativeDescriptor = Readonly<Record<string, unknown>> & { readonly schemaVersion: 1; readonly distribution: HarnessBinding["harness"]; readonly name: HarnessBinding["harness"]; readonly harnessDir: HarnessBinding["directory"]; readonly rulesSubdir: "rules" | "aidlc-rules" | "steering" };
type SourceContextReply = { readonly status: "ok"; readonly descriptor: NativeDescriptor; readonly invocation: string; readonly inputs: readonly { readonly path: string; readonly sha256: string }[] } | { readonly status: "unavailable"; readonly detail: string };
const responseSchema = ({ binding }: { readonly binding: HarnessBinding }): z.ZodType<SourceContextReply> => z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }),
  z.strictObject({ status: z.literal("ok"), descriptor: z.intersection(z.record(z.string(), z.unknown()), z.object({ schemaVersion: z.literal(1), distribution: z.literal(binding.harness), name: z.literal(binding.harness), harnessDir: z.literal(binding.directory), rulesSubdir: z.enum(["rules", "aidlc-rules", "steering"]) })), invocation: z.literal(`bun ${binding.directory}/tools/aidlc.ts`), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).length(4) }),
]);
const failure = ({ code = "capability-gap", detail }: { readonly code?: "capability-gap" | "invalid-input" | "invalid-json" | "harness-mismatch" | "foreign-content"; readonly detail: string }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-runtime-context", detail })] });
const contextEnvironment = ({ inherited, paths, binding }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly paths: { readonly sourceRoot: string; readonly root: string }; readonly binding: HarnessBinding }): Readonly<Record<string, string | undefined>> => ({
  ...privateCompilerEnvironment({ inherited, root: `${paths.root}/.source-runtime-context-home` }),
  ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["AIDLC_HARNESS_DIR", binding.directory], ["AIDLC_HARNESS_NAME", binding.harness], ["AIDLC_SRC", `${paths.sourceRoot}/core`], ["AIDLC_RUNTIME_HARNESS_ROOT", `${paths.sourceRoot}/core`], ["AIDLC_PROJECT_DIR", paths.root], ["AIDLC_RUNTIME_PROJECT_DIR", paths.root]]),
});
const encodeContext = ({ prepared, binding, mode }: { readonly prepared: Extract<SourceContextReply, { readonly status: "ok" }>; readonly binding: HarnessBinding; readonly mode: number }): Outcome<PreparedDistributionContext> => {
  const expected = directSourcePaths({ binding });
  if (prepared.inputs.some((input, index) => input.path !== expected[index])) return failure({ code: "foreign-content", detail: "source runtime context requires its four direct module witnesses once in declared order" });
  return { status: "ok", value: { context: { binding, rulesSubdir: prepared.descriptor.rulesSubdir, invocation: prepared.invocation }, files: [{ path: `${binding.directory}/tools/data/harness.json`, mode, bytes: new TextEncoder().encode(`${JSON.stringify(prepared.descriptor, null, 2)}\n`) }], inputs: prepared.inputs } };
};
const decodeContext = ({ stdout, binding, mode }: { readonly stdout: string; readonly binding: HarnessBinding; readonly mode: number }): Outcome<PreparedDistributionContext> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-json", detail: "source runtime context process must return one JSON response" }); }
  const parsed = responseSchema({ binding }).safeParse(decoded);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "invocation")) return failure({ detail: "source runtime context qualifies Bun copy invocation only; native executable preparation is unsupported" });
    if (parsed.error.issues.some((issue) => issue.path[0] === "descriptor")) return failure({ code: "harness-mismatch", detail: "native source descriptor must declare the requested harness identity, directory and supported rules path" });
    return failure({ code: "invalid-input", detail: "source runtime context requires native descriptor data, copy invocation and four SHA-256 module witnesses" });
  }
  return parsed.data.status === "unavailable" ? failure({ detail: parsed.data.detail }) : encodeContext({ prepared: parsed.data, binding, mode });
};
const admitProcessContext = ({ reply, binding, mode }: { readonly reply: NativeCompilerSpawnReply; readonly binding: HarnessBinding; readonly mode: number }): Outcome<PreparedDistributionContext> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0
  ? failure({ detail: "source runtime context process unavailable or reported diagnostics" })
  : decodeContext({ stdout: reply.stdout, binding, mode });
const admitContextRequest = ({ input, mode }: { readonly input: DistributionContextLocation; readonly mode: number }): Outcome<DistributionContextLocation> => {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) return failure({ code: "invalid-input", detail: "source runtime context requires a file permission mode between 0 and 0777" });
  if (input.location.basis.source.kind !== "core" || input.location.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(input.location.basis.pin)) return failure({ code: "foreign-content", detail: "source runtime context requires the framework source basis and full source pin" });
  return { status: "ok", value: input };
};
const loadContext = ({ input, mode, binary, operations }: { readonly input: DistributionContextLocation; readonly mode: number; readonly binary: string; readonly operations: SourceRuntimeContextOperations }): Outcome<PreparedDistributionContext> => {
  try {
    const paths = operations.paths(input);
    const reply = operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root, input: JSON.stringify({ sourceRoot: paths.sourceRoot, paths: directSourcePaths({ binding: input.binding }) }), env: contextEnvironment({ inherited: operations.environment(), paths, binding: input.binding }) });
    return admitProcessContext({ reply, binding: input.binding, mode });
  } catch { return failure({ detail: "source runtime context process capability unavailable" }); }
};
export const createSourceRuntimeContextReader = ({ mode, binary = "bun", operations = createSourceRuntimeContextOperations() }: { readonly mode: number; readonly binary?: string; readonly operations?: SourceRuntimeContextOperations }): DistributionContextReader => ({ load: async (input) => {
  const admitted = admitContextRequest({ input, mode });
  return admitted.status === "invalid" ? admitted : loadContext({ input: admitted.value, mode, binary, operations });
} });
