import { z } from "zod";
import type { WorkflowSourceCompiler, WorkflowSourceLocation, CompiledWorkflowSource } from "../domain/workflow-compilation.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import { createNativeCompilerProcessOperations, compilerSystemEnvironment, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
export type WorkflowCompilerOperations = NativeCompilerProcessOperations & { readonly locations: (input: { readonly location: WorkflowSourceLocation }) => { readonly source: string; readonly context: string; readonly moduleUrl: string } };
export const createWorkflowCompilerOperations = (): WorkflowCompilerOperations => ({ ...createNativeCompilerProcessOperations(), locations: ({ location }) => { const source = Bun.fileURLToPath(Bun.pathToFileURL(location.sourceRoot)), context = Bun.fileURLToPath(Bun.pathToFileURL(location.contextRoot)); return { source, context, moduleUrl: Bun.pathToFileURL(`${source}/core/tools/aidlc-graph.ts`).href }; } });
const nativeProgram = `
const input = await Bun.stdin.json();
const preparationRefusal = async () => {
  const prohibited = ["harness.json", "stage-graph.json", "scope-grid.json", "aidlc-projection.json", "aidlc-stamp.json"];
  const present = await Promise.all(prohibited.map(async name => await Bun.file(input.source + "/core/tools/data/" + name).exists() ? name : null));
  const blockedSource = present.find(name => name !== null);
  if (blockedSource) return { status: "unavailable", detail: "raw workflow compilation requires authored core inputs, without native harness configuration or compiled distribution data: " + blockedSource };
  const observeContextInput = async ({ path }) => {
    try { await Bun.file(path).stat(); return { status: "ok", path }; }
    catch (error) {
      return error?.code === "ENOENT" ? { status: "ok", path: null } : { status: "unavailable", detail: "source-only compilation context observation unavailable; no workflow data was prepared" };
    }
  };
  const previous = await Promise.all([process.env.AIDLC_STAGE_GRAPH, process.env.AIDLC_SCOPE_GRID, process.env.AIDLC_COMPOSED_SCOPES_DIR].map(path => observeContextInput({ path })));
  const unavailableContext = previous.find(observed => observed.status !== "ok");
  if (unavailableContext) return unavailableContext;
  const blockedContext = previous.find(observed => observed.path !== null);
  if (blockedContext) return { status: "unavailable", detail: "source-only compilation requires a fresh context without previous graph/grid or composed-scope inputs: " + blockedContext.path };
  return null;
};
const compile = async () => {
  const refused = await preparationRefusal();
  if (refused) return refused;
  const nativeFiles = await import(Bun.pathToFileURL(input.source + "/core/tools/aidlc-distribution.ts").href);
  const roots = ["core/aidlc-common/stages", "core/scopes", "core/agents", "core/memory", "core/sensors"];
  const fingerprint = async () => {
    const paths = ["core/tools/aidlc-graph.ts", ...roots.flatMap(root => nativeFiles.walkFiles(input.source + "/" + root).map(path => root + "/" + path.replaceAll("\\\\", "/")))].sort();
    return Promise.all(paths.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.source + "/" + path).bytes()).digest("hex") })));
  };
  const before = await fingerprint();
  const native = await import(input.moduleUrl);
  if (typeof native.compileStageGraph !== "function") return { status: "unavailable", detail: "pinned native source does not expose compileStageGraph; no workflow data was prepared" };
  const attempt = (() => {
    try { return { status: "ok", compiled: native.compileStageGraph() }; }
    catch (error) { return { status: typeof error?.code === "string" ? "unavailable" : "refused", detail: error instanceof Error ? error.message : String(error) }; }
  })();
  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after)) return { status: "unavailable", detail: "authored workflow inputs changed during compilation; retry from a stable source snapshot" };
  const changedContext = await preparationRefusal();
  if (changedContext) return changedContext;
  if (attempt.status !== "ok") return attempt;
  const compiled = attempt.compiled;
  return { status: "ok", graph: compiled.json, grid: compiled.gridJson, inputs: after };
};
process.stdout.write(JSON.stringify(await compile()));
`;
const response = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }), z.strictObject({ status: z.literal("refused"), detail: z.string().min(1) }), z.strictObject({ status: z.literal("ok"), graph: z.string().min(1), grid: z.string().min(1), inputs: z.array(z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe"), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1) })]);
const decodeCompilation = ({ stdout, location }: { readonly stdout: string; readonly location: WorkflowSourceLocation }): Outcome<CompiledWorkflowSource> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); } catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "workflow-source-compiler", detail: "native workflow compiler must return one JSON response" })] }; }
  const parsed = response.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "workflow-source-compiler", detail: "native workflow compiler requires graph/grid text and safe source digests, or an explicit refusal/unavailability finding" })] };
  if (parsed.data.status === "unavailable") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "workflow-source-compiler", detail: parsed.data.detail })] };
  if (parsed.data.status === "refused") return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "workflow-source-compiler", detail: `native compiler refused the source context: ${parsed.data.detail}` })] };
  if (new Set(parsed.data.inputs.map((entry) => entry.path)).size !== parsed.data.inputs.length || !parsed.data.inputs.some((entry) => entry.path === "core/tools/aidlc-graph.ts")) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "workflow-source-compiler", detail: "workflow source digests must identify the compiler and each source input once" })] };
  return { status: "ok", value: { binding: location.binding, compiler: { ...location.basis, path: "core/tools/aidlc-graph.ts" }, graph: { origin: { ...location.basis, path: `${location.binding.directory}/tools/data/stage-graph.json` }, text: parsed.data.graph }, grid: { origin: { ...location.basis, path: `${location.binding.directory}/tools/data/scope-grid.json` }, text: parsed.data.grid }, inputs: parsed.data.inputs } };
};
const sourceEnvironment = ({ inherited, source, context, location }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly source: string; readonly context: string; readonly location: WorkflowSourceLocation }): Readonly<Record<string, string | undefined>> => ({ ...compilerSystemEnvironment({ inherited }), ...Object.fromEntries([["HOME", context], ["USERPROFILE", context], ["APPDATA", context], ["LOCALAPPDATA", context], ["AIDLC_PROJECT_DIR", context], ["AIDLC_RUNTIME_PROJECT_DIR", context], ["AIDLC_RUNTIME_HARNESS_ROOT", `${source}/core`], ["AIDLC_SRC", `${source}/core`], ["AIDLC_HARNESS_DIR", location.binding.directory], ["AIDLC_HARNESS_NAME", location.binding.harness], ["AIDLC_STAGE_GRAPH", `${context}/source-only-stage-graph.json`], ["AIDLC_SCOPE_GRID", `${context}/source-only-scope-grid.json`], ["AIDLC_STAGES_DIR", `${source}/core/aidlc-common/stages`], ["AIDLC_SCOPES_DIR", `${source}/core/scopes`], ["AIDLC_AGENTS_DIR", `${source}/core/agents`], ["AIDLC_RULES_DIR", `${source}/core/memory`], ["AIDLC_SENSORS_DIR", `${source}/core/sensors`], ["AIDLC_COMPOSED_SCOPES_DIR", `${context}/source-only-composed-scopes`]]) });
export const createWorkflowSourceCompiler = ({ binary = "bun", operations = createWorkflowCompilerOperations() }: { readonly binary?: string; readonly operations?: WorkflowCompilerOperations } = {}): WorkflowSourceCompiler => ({
  compile: ({ location }) => {
    try {
      const paths = operations.locations({ location });
      const reply = operations.spawn({ binary, args: ["--no-install", "--eval", nativeProgram], cwd: paths.context, input: JSON.stringify(paths), env: sourceEnvironment({ inherited: operations.environment(), source: paths.source, context: paths.context, location }) });
      if (reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "workflow-source-compiler", detail: `native workflow compilation unavailable or reported diagnostics: ${reply.error ?? (reply.stderr.trim() || `exit ${reply.exitCode}`)}` })] };
      return decodeCompilation({ stdout: reply.stdout, location });
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "workflow-source-compiler", detail: `workflow source process could not be prepared: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
