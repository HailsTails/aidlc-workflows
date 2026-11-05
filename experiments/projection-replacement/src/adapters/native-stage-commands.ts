import { z } from "zod";
import { createNativeCompilerProcessOperations, compilerSystemEnvironment, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import type { NativeStageCommandPreparer, NativeStageCommandRequest, NativeStageCommands } from "../domain/native-stage-commands.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const modules = ["scripts/native-command-text.ts", "scripts/native-command-context.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts", "core/tools/aidlc-color.ts"] as const;
const documentSchema = z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe"), source: z.string(), text: z.string() });
const responseSchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), documents: z.array(documentSchema).min(1), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }), z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string() })]);
const nativeProgram = `
const input = await Bun.stdin.json();
const modules = ["scripts/native-command-text.ts", "scripts/native-command-context.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts", "core/tools/aidlc-color.ts"];
const prepare = async () => {
  const absent = (await Promise.all(modules.map(async path => await Bun.file(input.root + "/" + path).exists() ? null : path))).find(path => path !== null);
  if (absent) return { status: "unavailable", detail: "source-owned native command preparation API unavailable: " + absent };
  const fingerprint = async () => Promise.all(modules.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.root + "/" + path).bytes()).digest("hex") })));
  const before = await fingerprint();
  const api = await import(Bun.pathToFileURL(input.root + "/scripts/native-command-text.ts").href);
  const factory = await import(Bun.pathToFileURL(input.root + "/scripts/native-command-context.ts").href);
  if (typeof api.prepareNativeDocumentText !== "function" || typeof factory.createNativeCommandContext !== "function") return { status: "unavailable", detail: "source-owned native command preparation exports are unavailable" };
  const context = factory.createNativeCommandContext({ harnessDir: input.binding.directory });
  const prepared = input.documents.map(document => ({ document, prepared: api.prepareNativeDocumentText({ source: document.source, subject: document.path, context }) }));
  const refusals = prepared.filter(entry => entry.prepared.status !== "ok").flatMap(entry => entry.prepared.problems ?? ["native text preparation refused without diagnostics"]);
  if (refusals.length > 0) return { status: "refused", detail: refusals.join("\\n") };
  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after)) return { status: "unavailable", detail: "native text preparation source changed during execution" };
  return { status: "ok", documents: prepared.map(entry => ({ ...entry.document, text: entry.prepared.text })), inputs: after };
};
process.stdout.write(JSON.stringify(await prepare()));
`;
const admitReply = ({ decoded, request }: { readonly decoded: unknown; readonly request: NativeStageCommandRequest }): Outcome<NativeStageCommands> => {
  const parsed = responseSchema.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "native-stage-commands", detail: "native preparation must return complete text documents and source witnesses or an explicit refusal" })] };
  if (parsed.data.status !== "ok") return { status: "invalid", findings: [finding({ code: parsed.data.status === "unavailable" ? "capability-gap" : "invalid-input", subject: "native-stage-commands", detail: parsed.data.detail })] };
  const reply = parsed.data;
  if (reply.documents.length !== request.documents.length || new Set(reply.documents.map((document) => document.path)).size !== reply.documents.length || reply.documents.some((document) => !request.documents.some((expected) => expected.path === document.path && expected.source === document.source)) || reply.inputs.length !== modules.length || modules.some((path) => reply.inputs.filter((input) => input.path === path).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "native-stage-commands", detail: "native prepared texts must bind every requested path and input byte string once, with the declared source witnesses" })] };
  const origins = reply.inputs.map((input) => ({ ...request.basis, path: input.path }));
  return { status: "ok", value: { binding: request.binding, compiler: { ...request.basis, path: "scripts/native-command-text.ts" }, inputs: reply.inputs, documents: reply.documents.map((document) => ({ ...document, origins })) } };
};
export const createNativeStageCommandPreparer = ({ binary = "bun", operations = createNativeCompilerProcessOperations() }: { readonly binary?: string; readonly operations?: NativeCompilerProcessOperations } = {}): NativeStageCommandPreparer => ({ prepare: (request) => {
  const prefix = `${request.binding.directory}/aidlc-common/stages/`;
  if (request.basis.source.kind !== "core" || request.documents.length === 0 || new Set(request.documents.map((document) => document.path)).size !== request.documents.length || request.documents.some((document) => pathStatus({ path: document.path }) === "unsafe" || !document.path.startsWith(prefix) || !/^(initialization|ideation|inception|construction|operation)\/[a-z][a-z0-9-]*\.md$/.test(document.path.slice(prefix.length)))) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "native-stage-commands", detail: "prepare nonempty unique core stage documents within the selected harness's native phase/slug layout" })] };
  const root = Bun.fileURLToPath(Bun.pathToFileURL(request.sourceRoot));
  const env = { ...compilerSystemEnvironment({ inherited: operations.environment() }), ...Object.fromEntries([["HOME", `${root}/.native-text-home`], ["USERPROFILE", `${root}/.native-text-home`], ["APPDATA", `${root}/.native-text-home`], ["LOCALAPPDATA", `${root}/.native-text-home`], ["AIDLC_RUNTIME_PROJECT_DIR", root], ["AIDLC_PROJECT_DIR", root], ["AIDLC_HARNESS_DIR", request.binding.directory], ["AIDLC_HARNESS_NAME", request.binding.harness]]) };
  const reply = operations.spawn({ binary, args: ["--no-install", "--eval", nativeProgram], cwd: root, env, input: JSON.stringify({ root, binding: request.binding, documents: request.documents }) });
  if (reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "native-stage-commands", detail: `source-owned native text process unavailable or reported diagnostics: ${reply.error ?? reply.stderr.trim()}` })] };
  try { return admitReply({ decoded: JSON.parse(reply.stdout), request }); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "native-stage-commands", detail: "native text process must return one JSON response" })] }; }
} });
