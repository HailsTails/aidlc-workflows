import { z } from "zod";
import { finding, identifierStatus, pathStatus, sourceKey, type Outcome } from "../domain/model.ts";
import type { PluginHookProjection, PluginHookProjectionRequest, PluginHookProjector } from "../domain/plugin-hook-projection.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { privateCompilerEnvironment, createNativeCompilerProcessOperations, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { createTemporaryDirectoryOperations } from "./temporary-directory.ts";
import { withTemporaryDirectory, type TemporaryDirectoryOperations } from "../application/temporary-directory.ts";

const entrypoint = "core/projection/plugin-hook.ts";
const nativeProgram = `
const input = await Bun.stdin.json();
const prepare = async () => {
  const paths = ["scripts/plugin-hook-source.ts", "core/tools/aidlc-plugin-hook-definition.ts", "core/projection/plugin-hook.ts", "core/tools/aidlc-plugin-hook-registrations.ts"];
  const absent = (await Promise.all(paths.map(async path => await Bun.file(input.sourceRoot + "/" + path).exists() ? null : path))).find(path => path !== null);
  if (absent) return { status: "unavailable", detail: "source-owned plugin hook API unavailable: " + absent };
  let manifest;
  try { manifest = JSON.parse(input.declaration.text); }
  catch { return { status: "refused", detail: "plugin hook declaration must contain valid JSON" }; }
  const source = await import(Bun.pathToFileURL(input.sourceRoot + "/scripts/plugin-hook-source.ts").href);
  const binding = await import(Bun.pathToFileURL(input.sourceRoot + "/core/tools/aidlc-plugin-hook-definition.ts").href);
  const projection = await import(Bun.pathToFileURL(input.sourceRoot + "/core/projection/plugin-hook.ts").href);
  const codec = await import(Bun.pathToFileURL(input.sourceRoot + "/core/tools/aidlc-plugin-hook-registrations.ts").href);
  if (typeof source.readPluginHookSource !== "function" || typeof binding.bindPluginHookSources !== "function" || typeof projection.renderPluginHookContributions !== "function" || typeof codec.projectedPluginHookContributionsSchema?.parse !== "function") return { status: "unavailable", detail: "source-owned plugin hook exports are unavailable; no alternate renderer was used" };
  const pluginName = input.declaration.origin.source.id;
  const parsed = source.readPluginHookSource({ manifest, pluginName, harness: input.binding.harness });
  if (parsed.kind !== "parsed") return { status: "refused", detail: parsed.message };
  const bound = binding.bindPluginHookSources({ rows: parsed.rows, ...input.runtime });
  if (bound.kind !== "bound") return { status: "refused", detail: bound.message };
  const projected = projection.renderPluginHookContributions({ pluginName, harness: input.binding.harness, harnessDir: input.binding.directory, invocation: "bun .claude/tools/aidlc.ts", trustedNamespace: "engine", rows: bound.rows });
  const checked = codec.projectedPluginHookContributionsSchema.parse(projected);
  if (checked.kind !== "parsed") return { status: "refused", detail: "source-owned hook projection refused its native contribution envelope" };
  return { status: "ok", projection: checked.value };
};
process.stdout.write(JSON.stringify(await prepare()));
`;
const response = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), projection: z.strictObject({ schemaVersion: z.literal(1), pluginName: z.string(), harness: z.string(), registrations: z.array(z.unknown()) }) }),
  z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string().min(1) }),
]);
const requestFindings = ({ request, compiler, sourceRoot }: { readonly request: PluginHookProjectionRequest; readonly compiler: SourceBasis; readonly sourceRoot: string }): Outcome<PluginHookProjectionRequest> => {
  if (request.binding.harness !== "claude" || request.binding.directory !== ".claude") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hooks", detail: "this slice admits only the demonstrated native Claude contribution contract" })] };
  if (sourceRoot.trim().length === 0 || compiler.source.kind !== "core" || compiler.source.id !== "framework" || compiler.pin.trim().length === 0 || request.declaration.origin.source.kind !== "plugin" || identifierStatus({ identifier: request.declaration.origin.source.id }) !== "valid" || request.declaration.origin.pin.trim().length === 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-hooks", detail: "declare an exact framework compiler basis and plugin-owned authored declaration" })] };
  if (sourceKey(request.runtime.basis.source) !== sourceKey(request.declaration.origin.source) || request.runtime.basis.pin !== request.declaration.origin.pin) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-hooks", detail: "prepared runtime inventory must match the declaration's exact plugin source basis; filenames cannot establish cross-version compatibility" })] };
  if ([request.declaration.origin.path, ...request.runtime.authoredFiles, ...request.runtime.projectedFiles].some((path) => pathStatus({ path }) === "unsafe")) return { status: "invalid", findings: [finding({ code: "invalid-path", subject: "plugin-hooks", detail: "authored declaration and runtime inventories require safe relative paths" })] };
  return { status: "ok", value: request };
};
const decodeProjection = ({ stdout, request, compiler }: { readonly stdout: string; readonly request: PluginHookProjectionRequest; readonly compiler: SourceBasis }): Outcome<PluginHookProjection> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); } catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "plugin-hooks", detail: "source hook projector must return one JSON response" })] }; }
  const parsed = response.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-hooks", detail: "source hook projector requires a native contribution file or explicit diagnostics" })] };
  const reply = parsed.data;
  if (reply.status !== "ok") return { status: "invalid", findings: [finding({ code: reply.status === "unavailable" ? "capability-gap" : "invalid-input", subject: request.declaration.origin.path, detail: reply.detail })] };
  if (reply.projection.pluginName !== request.declaration.origin.source.id || reply.projection.harness !== request.binding.harness) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-hooks", detail: "native contributions must preserve the selected plugin and harness identity" })] };
  return { status: "ok", value: { owner: { source: request.declaration.origin.source, pin: request.declaration.origin.pin }, declaration: request.declaration.origin, compiler: { ...compiler, path: entrypoint }, runtime: request.runtime.basis, binding: request.binding, registrations: reply.projection.registrations.length, resources: [{ kind: "file", path: "contributions/hook-registrations.json", body: JSON.stringify(reply.projection, null, 2) + "\n" }] } };
};
export const createPluginHookProjector = ({ sourceRoot, compiler, binary = "bun", operations = createNativeCompilerProcessOperations(), directories = createTemporaryDirectoryOperations() }: { readonly sourceRoot: string; readonly compiler: SourceBasis; readonly binary?: string; readonly operations?: NativeCompilerProcessOperations; readonly directories?: TemporaryDirectoryOperations }): PluginHookProjector => ({
  project: (request) => {
    const admitted = requestFindings({ request, compiler, sourceRoot });
    if (admitted.status === "invalid") return Promise.resolve(admitted);
    return withTemporaryDirectory({ directories, consume: async ({ root }) => {
      const env = privateCompilerEnvironment({ inherited: operations.environment(), root });
      const reply = operations.spawn({ binary, args: ["--no-install", "--eval", nativeProgram], cwd: root, env, input: JSON.stringify({ ...request, sourceRoot }) });
      return reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0 ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-hooks", detail: `source hook projection unavailable: ${reply.error ?? (reply.stderr.trim() || `exit ${reply.exitCode}`)}` })] } : decodeProjection({ stdout: reply.stdout, request, compiler });
    } });
  },
});
