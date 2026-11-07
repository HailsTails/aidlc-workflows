import { qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { z } from "zod";
import { createNativeCompilerProcessOperations, compilerSystemEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnInput, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";
import type { NativeDocumentCommandPreparer, NativeDocumentCommandRequest, NativeDocumentCommands } from "../domain/native-document-commands.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const modules = ["scripts/native-command-text.ts", "scripts/native-command-context.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts", "core/tools/aidlc-color.ts", "core/tools/aidlc-runtime-paths.ts", "scripts/native-runtime-text.ts"] as const;
export const nativeDocumentCommandSourcePaths = (): readonly string[] => modules;
const documentSchema = z.strictObject({ path: z.string().refine((path) => pathStatus({ path }) === "safe"), source: z.string(), text: z.string() });
const responseSchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), documents: z.array(documentSchema).min(1), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }), z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string() })]);
const nativeProgram = `
const input = await Bun.stdin.json();
const modules = ${JSON.stringify(modules)};
const prepare = async () => {
  const absent = (await Promise.all(modules.map(async path => await Bun.file(input.root + "/" + path).exists() ? null : path))).find(path => path !== null);
  if (absent) return { status: "unavailable", detail: "source-owned native command preparation API unavailable: " + absent };
  const fs = await import("node:fs/promises");
  const fingerprint = async () => Promise.all(modules.map(async path => {
    const pieces = path.split("/");
    const locations = [input.root, ...pieces.map((_, index) => input.root + "/" + pieces.slice(0, index + 1).join("/"))];
    const stats = await Promise.all(locations.map(location => fs.lstat(location)));
    if (stats.some((stat, index) => stat.isSymbolicLink() || (index === stats.length - 1 ? !stat.isFile() : !stat.isDirectory()))) throw new Error("native command sources must be ordinary files");
    return { path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.root + "/" + path).bytes()).digest("hex") };
  }));
  const before = await fingerprint();
  const api = await import(Bun.pathToFileURL(input.root + "/scripts/native-command-text.ts").href);
  const factory = await import(Bun.pathToFileURL(input.root + "/scripts/native-command-context.ts").href);
  const prose = await import(Bun.pathToFileURL(input.root + "/scripts/native-runtime-text.ts").href);
  if (typeof api.prepareNativeDocumentText !== "function" || typeof factory.createNativeCommandContext !== "function" || typeof prose.prepareNativeOnboardingText !== "function") return { status: "unavailable", detail: "source-owned native command preparation exports are unavailable" };
  const context = factory.createNativeCommandContext({ harnessDir: input.binding.directory });
  const prepared = input.documents.map(document => ({ document, prepared: api.prepareNativeDocumentText({ source: prose.prepareNativeOnboardingText(document.source, input.exactReads), subject: document.path, context }) }));
  const refusals = prepared.filter(entry => entry.prepared.status !== "ok").flatMap(entry => entry.prepared.problems ?? ["native text preparation refused without diagnostics"]);
  if (refusals.length > 0) return { status: "refused", detail: refusals.join("\\n") };
  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after)) return { status: "unavailable", detail: "native text preparation source changed during execution" };
  return { status: "ok", documents: prepared.map(entry => ({ ...entry.document, text: entry.prepared.text })), inputs: after };
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch { process.stdout.write(JSON.stringify({ status: "unavailable", detail: "native command source observation or preparation unavailable" })); }
`;
const admitReply = ({ decoded, request }: { readonly decoded: unknown; readonly request: NativeDocumentCommandRequest }): Outcome<NativeDocumentCommands> => {
  const parsed = responseSchema.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "native-document-commands", detail: "native preparation must return complete text documents and source witnesses or an explicit refusal" })] };
  if (parsed.data.status !== "ok") return { status: "invalid", findings: [finding({ code: parsed.data.status === "unavailable" ? "capability-gap" : "invalid-input", subject: "native-document-commands", detail: parsed.data.detail })] };
  const reply = parsed.data;
  if (reply.documents.length !== request.documents.length || new Set(reply.documents.map((document) => document.path)).size !== reply.documents.length || reply.documents.some((document) => !request.documents.some((expected) => expected.path === document.path && expected.source === document.source)) || reply.inputs.length !== modules.length || modules.some((path) => reply.inputs.filter((input) => input.path === path).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "native-document-commands", detail: "native prepared texts must bind every requested path and input byte string once, with the declared source witnesses" })] };
  const origins = reply.inputs.map((input) => ({ ...request.basis, path: input.path }));
  return { status: "ok", value: { binding: request.binding, compiler: { ...request.basis, path: "scripts/native-command-text.ts" }, inputs: reply.inputs, documents: reply.documents.map((document) => ({ ...document, origins })) } };
};
const admitStageRequest = ({ request }: { readonly request: NativeDocumentCommandRequest }): Outcome<NativeDocumentCommandRequest> => request.basis.source.kind !== "core" || request.documents.length === 0 || new Set(request.documents.map((document) => document.path)).size !== request.documents.length || request.documents.some((document) => pathStatus({ path: document.path }) === "unsafe")
  ? { status: "invalid", findings: [finding({ code: "invalid-input", subject: "native-document-commands", detail: "prepare nonempty unique core documents with safe relative paths" })] } : { status: "ok", value: request };
const stageProcessEnvironment = ({ root, request, inherited }: { readonly root: string; readonly request: NativeDocumentCommandRequest; readonly inherited: Readonly<Record<string, string | undefined>> }): Readonly<Record<string, string | undefined>> => ({
  ...compilerSystemEnvironment({ inherited }), ...Object.fromEntries([["HOME", `${root}/.native-text-home`], ["USERPROFILE", `${root}/.native-text-home`], ["APPDATA", `${root}/.native-text-home`], ["LOCALAPPDATA", `${root}/.native-text-home`], ["AIDLC_RUNTIME_PROJECT_DIR", root], ["AIDLC_PROJECT_DIR", root], ["AIDLC_HARNESS_DIR", request.binding.directory], ["AIDLC_HARNESS_NAME", request.binding.harness]]),
});
const stageProcessInput = ({ request, binary, operations }: { readonly request: NativeDocumentCommandRequest; readonly binary: string; readonly operations: NativeCompilerProcessOperations }): NativeCompilerSpawnInput => {
  const root = Bun.fileURLToPath(Bun.pathToFileURL(request.sourceRoot));
  return { binary, args: ["--no-env-file", "--no-install", "--eval", nativeProgram], cwd: root, env: { ...stageProcessEnvironment({ root, request, inherited: operations.environment() }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" }, input: JSON.stringify({ root, binding: request.binding, documents: request.documents, exactReads: qualifiedHarnessProfile(request.binding)?.exactNativeReads ?? false }) };
};
const decodeStageReply = ({ stdout, request }: { readonly stdout: string; readonly request: NativeDocumentCommandRequest }): Outcome<NativeDocumentCommands> => {
  try { return admitReply({ decoded: JSON.parse(stdout), request }); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "native-document-commands", detail: "native text process must return one JSON response" })] }; }
};
const stageProcessOutcome = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: NativeDocumentCommandRequest }): Outcome<NativeDocumentCommands> => reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "native-document-commands", detail: `source-owned native text process unavailable or reported diagnostics: ${reply.error ?? reply.stderr.trim()}` })] }
  : decodeStageReply({ stdout: reply.stdout, request });
const executeStagePreparation = ({ request, binary, operations }: { readonly request: NativeDocumentCommandRequest; readonly binary: string; readonly operations: NativeCompilerProcessOperations }): Outcome<NativeDocumentCommands> => stageProcessOutcome({ reply: operations.spawn(stageProcessInput({ request, binary, operations })), request });
const continueStageRequest = ({ admitted, consume }: { readonly admitted: Outcome<NativeDocumentCommandRequest>; readonly consume: (request: NativeDocumentCommandRequest) => Outcome<NativeDocumentCommands> }): Outcome<NativeDocumentCommands> => admitted.status === "invalid" ? admitted : consume(admitted.value);
export const createNativeDocumentCommandPreparer = ({ binary = "bun", operations = createNativeCompilerProcessOperations() }: { readonly binary?: string; readonly operations?: NativeCompilerProcessOperations } = {}): NativeDocumentCommandPreparer => ({ prepare: (request) => continueStageRequest({ admitted: admitStageRequest({ request }), consume: (admitted) => executeStagePreparation({ request: admitted, binary, operations }) }) });
