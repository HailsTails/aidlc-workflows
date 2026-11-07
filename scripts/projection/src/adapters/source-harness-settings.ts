import { readSourceKiroPreparation } from "./source-kiro-preparation.ts";
import type { Tier } from "../domain/model.ts";
import { z } from "zod";
import { qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";
import { claudeSettingsPaths, codexSettingsPaths, cursorSettingsPaths, type HarnessSettingsRequest, type HarnessSettingsPreparer, type PreparedHarnessSettings } from "../domain/harness-settings.ts";
import { continuePreparation } from "../application/preparation-result.ts";
import { finding, type Outcome } from "../domain/model.ts";

const sourcePaths = ["scripts/projection-text.ts", "scripts/claude-settings.ts", "harness/claude/manifest.ts", "harness/claude/onboarding.fills.ts", "harness/claude/settings.json", "harness/claude/settings.local.json.example", "core/tools/aidlc.ts", "core/tools/aidlc-copy-preapproval.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-settings.ts", "core/tools/aidlc-runtime-paths.ts", "core/tools/aidlc-version.ts", "scripts/native-runtime-text.ts", "scripts/native-command-context.ts", "scripts/native-command-text.ts", "core/tools/aidlc-routes.ts"];
const codexSourcePaths = ["harness/codex/settings.ts", "harness/codex/manifest.ts", "harness/codex/onboarding.fills.ts", "core/tools/aidlc.ts", "core/tools/aidlc-copy-preapproval.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-runtime-budget.ts", "core/tools/aidlc-routes.ts", "scripts/projection-text.ts"];
const cursorSourcePaths = ["harness/cursor/manifest.ts", "harness/cursor/onboarding.fills.ts", "harness/cursor/hooks.json", "harness/cursor/cli.json", "scripts/cursor-settings.ts", "scripts/projection-text.ts", "scripts/native-runtime-text.ts", "scripts/native-command-context.ts", "scripts/native-command-text.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts", "core/tools/aidlc.ts", "core/tools/aidlc-copy-preapproval.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts"];
const settingsSourcePaths = (request: HarnessSettingsRequest): readonly string[] => request.binding.harness === "cursor" ? cursorSourcePaths : request.binding.harness === "codex" ? codexSourcePaths : sourcePaths;
export type SourceHarnessSettingsOperations = NativeCompilerProcessOperations & { readonly paths: (input: HarnessSettingsRequest) => { readonly sourceRoot: string; readonly root: string } };
export const createSourceHarnessSettingsOperations = (): SourceHarnessSettingsOperations => ({ ...createNativeCompilerProcessOperations(), paths: ({ sourceRoot, root }) => ({ sourceRoot: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), root: Bun.fileURLToPath(Bun.pathToFileURL(root)) }) });
const replySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), files: z.array(z.strictObject({ file: z.string(), bytes: z.array(z.number().int().min(0).max(255)) })), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }),
  z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string().min(1) }),
]);
const worker = `
const input = await Bun.stdin.json();
const paths = input.paths;
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const sourceComponents = ({ path }) => {
  const segments = path.split("/");
  return [input.sourceRoot, ...segments.map((_, index) => input.sourceRoot + "/" + segments.slice(0, index + 1).join("/"))];
};
const sourceEligibility = ({ stats }) => stats.some((stat, index) => stat.isSymbolicLink() || (index === stats.length - 1 ? !stat.isFile() : !stat.isDirectory())) ? "unsupported" : "ordinary";
const sourceWitness = async ({ path, stats }) => sourceEligibility({ stats }) === "unsupported" ? null : { path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.sourceRoot + "/" + path).bytes()).digest("hex") };
const observeSourceFile = async ({ path, fileSystem }) => sourceWitness({ path, stats: await Promise.all(sourceComponents({ path }).map(component => fileSystem.lstat(component))) });
const collectWitnesses = ({ inputs }) => inputs.some(witness => witness === null) ? unavailable({ detail: "harness settings require ordinary authored source files" }) : { status: "ok", inputs };
const observe = async () => {
  const fileSystem = await import("node:fs/promises");
  return collectWitnesses({ inputs: await Promise.all(paths.map(path => observeSourceFile({ path, fileSystem }))) });
};
const sourceModuleUrl = ({ path, inputs }) => Bun.pathToFileURL(input.sourceRoot + "/" + path).href + "?source=" + inputs.find(witness => witness.path === path).sha256;
const loadModule = ({ path, inputs }) => import(sourceModuleUrl({ path, inputs }));
const importNative = async ({ inputs }) => {
  const [manifest, authored, settings, dispatcher, command, runtimeText] = await Promise.all([loadModule({ path: "harness/claude/manifest.ts", inputs }), loadModule({ path: "scripts/projection-text.ts", inputs }), loadModule({ path: "scripts/claude-settings.ts", inputs }), loadModule({ path: "core/tools/aidlc.ts", inputs }), loadModule({ path: "core/tools/aidlc-command.ts", inputs }), loadModule({ path: "scripts/native-runtime-text.ts", inputs })]);
  return { manifest, authored, settings, dispatcher, command, runtimeText };
};
const settingsMappings = [{ src: "settings.json", dst: "settings.json" }, { src: "settings.local.json.example", dst: "settings.local.json.example" }];
const nativeSchema = ({ z }) => z.object({
  manifest: z.object({ default: z.object({ name: z.literal("claude"), harnessDir: z.literal(".claude"), tierFlavor: z.literal("claude"), harnessFiles: z.array(z.looseObject({ src: z.string(), dst: z.string(), projectRoot: z.boolean().optional() })) }) }),
  authored: z.object({ substituteAuthoredTokens: z.custom(candidate => typeof candidate === "function") }),
  settings: z.object({ prepareClaudeCopyAllowList: z.custom(candidate => typeof candidate === "function"), prepareClaudeNativeAllowList: z.custom(candidate => typeof candidate === "function") }),
  command: z.object({ TRUSTED_ROUTE_NAMESPACE: z.string(), trustedCommand: z.custom(candidate => typeof candidate === "function") }),
  runtimeText: z.object({ prepareClaudeNativeRuntimeText: z.custom(candidate => typeof candidate === "function") }),
  dispatcher: z.object({ copyChannelDispatcherCommands: z.custom(candidate => typeof candidate === "function"), copyChannelToolScripts: z.custom(candidate => typeof candidate === "function") }),
});
const admitMappings = ({ native }) => {
  const candidates = native.manifest.default.harnessFiles.filter(mapping => settingsMappings.some(expected => mapping.src === expected.src || mapping.dst === expected.dst));
  return candidates.length !== 2 || settingsMappings.some(expected => candidates.filter(mapping => mapping.src === expected.src && mapping.dst === expected.dst && mapping.projectRoot !== true).length !== 1)
    ? unavailable({ detail: "harness settings qualify the two declared Claude settings mappings only" })
    : { status: "ok", project: native.authored.substituteAuthoredTokens, expand: native.settings.prepareClaudeCopyAllowList, commands: native.dispatcher.copyChannelDispatcherCommands, scripts: native.dispatcher.copyChannelToolScripts, trustedNamespace: native.command.TRUSTED_ROUTE_NAMESPACE, nativeAllow: native.settings.prepareClaudeNativeAllowList, trustedCommand: native.command.trustedCommand, runtimeText: native.runtimeText.prepareClaudeNativeRuntimeText };
};
const loadNative = async ({ inputs, z }) => {
  const parsed = nativeSchema({ z }).safeParse(await importNative({ inputs }));
  return parsed.success ? admitMappings({ native: parsed.data }) : unavailable({ detail: "harness settings require the Claude manifest and callable native text and capability APIs" });
};
const capabilitySchema = ({ z }) => z.strictObject({ dispatcherCommands: z.array(z.string().min(1)), toolScripts: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\\.ts$/)) });
const admitCapabilityFiles = ({ capabilities }) => ["aidlc.ts", ...capabilities.toolScripts].some(script => input.files.filter(file => file === ".claude/tools/" + script).length !== 1)
  ? unavailable({ detail: "harness settings require the prepared dispatcher and every declared preapproved tool exactly once before permissions can be emitted" })
  : { status: "ok", capabilities };
const loadCapabilities = ({ native, z }) => {
  const parsed = capabilitySchema({ z }).safeParse({ dispatcherCommands: native.commands(), toolScripts: native.scripts() });
  return parsed.success ? admitCapabilityFiles({ capabilities: parsed.data }) : unavailable({ detail: "native copy capability producers must return command strings and ordinary tool script names" });
};
const settingsReplySchema = ({ z }) => z.discriminatedUnion("kind", [z.object({ kind: z.literal("prepared"), content: z.string() }), z.object({ kind: z.literal("refused"), message: z.string().min(1) })]);
const admitSettingsText = ({ prepared, z }) => {
  const parsed = settingsReplySchema({ z }).safeParse(prepared);
  if (!parsed.success) return unavailable({ detail: "native Claude settings preparation must return prepared text or an explicit refusal" });
  return parsed.data.kind === "refused" ? { status: "refused", detail: parsed.data.message } : { status: "ok", content: parsed.data.content };
};
const admitProjectedText = ({ candidate, z }) => {
  const parsed = z.string().safeParse(candidate);
  return parsed.success ? { status: "ok", text: parsed.data } : unavailable({ detail: "native authored text projection must return text" });
};
const projectSettings = ({ native, capabilities, text, z }) => {
  const projected = admitProjectedText({ candidate: native.project({ source: text, harnessDir: ".claude", binding: { invoke: input.invocation, toolPrefix: "bun .claude/tools/", trustedNamespace: native.trustedNamespace } }), z });
  if (projected.status !== "ok") return projected;
  const value = JSON.parse(input.invocation === "aidlc" ? native.runtimeText(projected.text) : projected.text);
  const prepared = input.invocation === "aidlc" ? native.nativeAllow({ allow: value.permissions?.allow, authority: { trustedCommand: ({ args }) => native.trustedCommand(args), dispatcherCommands: () => capabilities.dispatcherCommands.map(command => "aidlc " + command) } }) : native.expand({ allow: value.permissions?.allow, authority: { dispatcherCommands: () => capabilities.dispatcherCommands, toolScripts: () => capabilities.toolScripts } });
  if (prepared.kind === "refused") return { status: "refused", detail: prepared.message };
  value.permissions.allow = prepared.allow;
  return admitSettingsText({ prepared: { kind: "prepared", content: JSON.stringify(value, null, 2) + String.fromCharCode(10) }, z });
};
const readSettings = async () => ({ text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await Bun.file(input.sourceRoot + "/harness/claude/settings.json").bytes()), example: await Bun.file(input.sourceRoot + "/harness/claude/settings.local.json.example").bytes() });
const encodeFiles = ({ prepared, authored }) => ({ status: "ok", files: [{ file: ".claude/settings.json", bytes: Array.from(new TextEncoder().encode(prepared.content)) }, { file: ".claude/settings.local.json.example", bytes: Array.from(authored.example) }] });
const prepareNative = async ({ native, capabilities, z }) => {
  const authored = await readSettings();
  const prepared = projectSettings({ native, capabilities, text: authored.text, z });
  return prepared.status !== "ok" ? prepared : encodeFiles({ prepared, authored });
};
const retainStable = ({ before, after, prepared }) => after.status !== "ok" || JSON.stringify(before.inputs) !== JSON.stringify(after.inputs) ? unavailable({ detail: "harness settings source changed during preparation" }) : { ...prepared, inputs: after.inputs };
const prepareCodex = async ({ inputs }) => {
  const [settings, dispatcher, command, authored, manifest] = await Promise.all(["harness/codex/settings.ts", "core/tools/aidlc.ts", "core/tools/aidlc-command.ts", "scripts/projection-text.ts", "harness/codex/manifest.ts"].map(path => loadModule({ path, inputs })));
  const declaration = manifest.default;
  if (declaration.name !== "codex" || declaration.harnessDir !== ".codex" || declaration.harnessFiles?.some(file => file.copyOnly) || declaration.nativeRootIntegrations !== undefined || declaration.nativeReplacements !== undefined) return unavailable({ detail: "unsupported Codex settings declarations" });
  if (["emitHooksJson", "emitConfigToml", "emitDefaultRules", "emitTrustSeed"].some(name => typeof settings[name] !== "function") || typeof dispatcher.copyChannelToolScripts !== "function") return unavailable({ detail: "Codex settings capabilities unavailable" });
  const scripts = dispatcher.copyChannelToolScripts();
  if (!Array.isArray(scripts) || scripts.some(script => typeof script !== "string" || input.files.filter(file => file === ".codex/tools/" + script).length !== 1)) return unavailable({ detail: "Codex settings require every declared preapproved tool" });
  const substitute = source => authored.substituteAuthoredTokens({ source, harnessDir: ".codex", binding: { invoke: input.invocation, toolPrefix: "bun .codex/tools/", trustedNamespace: command.TRUSTED_ROUTE_NAMESPACE } });
  const values = [settings.emitHooksJson(substitute, "codex", command.TRUSTED_ROUTE_NAMESPACE), settings.emitConfigToml(input.onboarding), settings.emitDefaultRules(".codex", input.invocation, command.TRUSTED_ROUTE_NAMESPACE), settings.emitTrustSeed(".codex", "codex", input.invocation, command.TRUSTED_ROUTE_NAMESPACE)];
  return { status: "ok", files: input.outputPaths.map((file, index) => ({ file, bytes: Array.from(new TextEncoder().encode(values[index])) })) };
};
const prepareCursor = async ({ inputs }) => {
  const [manifest, settings, dispatcher, command, authored, runtime, delivery] = await Promise.all(["harness/cursor/manifest.ts", "scripts/cursor-settings.ts", "core/tools/aidlc.ts", "core/tools/aidlc-command.ts", "scripts/projection-text.ts", "scripts/native-runtime-text.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts"].map(path => loadModule({ path, inputs })));
  delivery.qualifyDeliveryDeclaration(manifest.default, input.profile);
  for (const path of ["hooks.json", "cli.json"]) if (manifest.default.harnessFiles.filter(mapping => mapping.src === path && mapping.dst === path && mapping.projectRoot !== true && !mapping.copyOnly).length !== 1) return unavailable({ detail: "Cursor settings require exactly the declared hooks and CLI mappings" });
  const scripts = dispatcher.copyChannelToolScripts();
  if (!Array.isArray(scripts) || scripts.some(script => typeof script !== "string" || input.files.filter(file => file === ".cursor/tools/" + script).length !== 1)) return unavailable({ detail: "Cursor settings require every declared preapproved tool" });
  const read = async path => new TextDecoder("utf-8", {fatal:true}).decode(await Bun.file(input.sourceRoot + "/harness/cursor/" + path).bytes());
  const substitute = source => authored.substituteAuthoredTokens({ source, harnessDir: ".cursor", binding: { invoke: input.invocation, toolPrefix: "bun .cursor/tools/", trustedNamespace: command.TRUSTED_ROUTE_NAMESPACE } });
  const hooksText = substitute(await read("hooks.json"));
  const hooks = input.invocation === "aidlc" ? runtime.prepareNativeRuntimeText(hooksText, ".cursor") : hooksText;
  JSON.parse(hooks);
  const cli = JSON.parse(substitute(await read("cli.json")));
  const authority = { dispatcherCommands: dispatcher.copyChannelDispatcherCommands, toolScripts: dispatcher.copyChannelToolScripts, trustedShell: command.cursorTrustedShell };
  const prepared = input.invocation === "aidlc" ? settings.prepareCursorNativeAllowList({allow:cli.permissions?.allow,authority}) : settings.prepareCursorCopyAllowList({allow:cli.permissions?.allow,authority});
  if (prepared.kind === "refused") return {status:"refused",detail:prepared.message};
  cli.permissions.allow = prepared.allow;
  return {status:"ok",files:[{file:".cursor/hooks.json",bytes:Array.from(new TextEncoder().encode(hooks))},{file:".cursor/cli.json",bytes:Array.from(new TextEncoder().encode(JSON.stringify(cli,null,2)+String.fromCharCode(10)))}]};
};
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  if (input.harness === "cursor") {
    const prepared = await prepareCursor({ inputs: before.inputs });
    return prepared.status === "ok" ? retainStable({ before, after: await observe(), prepared }) : prepared;
  }
  if (input.harness === "codex") {
    const prepared = await prepareCodex({ inputs: before.inputs });
    return prepared.status === "ok" ? retainStable({ before, after: await observe(), prepared }) : prepared;
  }
  const { z } = await import(Bun.pathToFileURL(Bun.resolveSync("zod", input.sourceRoot)).href);
  const native = await loadNative({ inputs: before.inputs, z });
  if (native.status !== "ok") return native;
  const capabilities = loadCapabilities({ native, z });
  if (capabilities.status !== "ok") return capabilities;
  const prepared = await prepareNative({ native, capabilities: capabilities.capabilities, z });
  if (prepared.status !== "ok") return prepared;
  return retainStable({ before, after: await observe(), prepared });
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch (error) { process.stdout.write(JSON.stringify(unavailable({ detail: "harness settings authored inputs or native preparation unavailable: " + (error instanceof Error ? error.message : String(error)) }))); }
`;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "invalid-input" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-harness-settings", detail })] });
const admitReply = ({ reply, request }: { readonly reply: Extract<z.infer<typeof replySchema>, { readonly status: "ok" }>; readonly request: HarnessSettingsRequest }): Outcome<PreparedHarnessSettings> => {
  const paths = reply.files.map((file) => file.file);
  const expected = request.binding.harness === "cursor" ? cursorSettingsPaths() : request.binding.harness === "codex" ? codexSettingsPaths() : claudeSettingsPaths();
  const sourcePaths = settingsSourcePaths(request);
  if (paths.length !== expected.length || expected.some((path) => paths.filter((file) => file === path).length !== 1) || reply.inputs.length !== sourcePaths.length || sourcePaths.some((path) => reply.inputs.filter((input) => input.path === path).length !== 1)) return failure({ code: "foreign-content", detail: "harness settings must retain every declared source witness and exactly its declared settings artifacts" });
  return { status: "ok", value: { files: reply.files.map((file) => ({ path: file.file, bytes: Uint8Array.from(file.bytes), mode: request.mode })), preparation: { kind: "harness-settings", paths, inputs: reply.inputs } } };
};
const decodeReply = ({ stdout, request }: { readonly stdout: string; readonly request: HarnessSettingsRequest }): Outcome<PreparedHarnessSettings> => {
  let candidate: unknown;
  try { candidate = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-input", detail: "harness settings process must return one JSON response" }); }
  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return failure({ code: "invalid-input", detail: "harness settings require byte artifacts and SHA-256 source witnesses or explicit unavailability" });
  return parsed.data.status === "ok" ? admitReply({ reply: parsed.data, request }) : failure({ code: parsed.data.status === "refused" ? "invalid-input" : "capability-gap", detail: parsed.data.detail });
};
const processOutcome = ({ reply, request }: { readonly reply: NativeCompilerSpawnReply; readonly request: HarnessSettingsRequest }): Outcome<PreparedHarnessSettings> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0 ? failure({ detail: "harness settings process unavailable or reported diagnostics" }) : decodeReply({ stdout: reply.stdout, request });
const admitRequest = ({ request }: { readonly request: HarnessSettingsRequest }): Outcome<HarnessSettingsRequest> => {
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || !((request.binding.harness === "claude" && request.binding.directory === ".claude") || (request.binding.harness === "codex" && request.binding.directory === ".codex") || (request.binding.harness === "cursor" && request.binding.directory === ".cursor")) || ![`bun ${request.binding.directory}/tools/aidlc.ts`, "aidlc"].includes(request.invocation) || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777) return failure({ detail: "harness settings require the pinned framework qualified copy or native profile, exact invocation and explicit file modes" });
  if (request.files.filter((path) => path === `${request.binding.directory}/tools/aidlc.ts`).length !== 1) return failure({ detail: "harness settings require exactly one prepared host dispatcher before source capability discovery" });
  if (request.binding.harness === "codex" && (typeof request.onboarding !== "string" || request.onboarding.length === 0)) return failure({ detail: "Codex settings require the shared prepared onboarding text" });
  return { status: "ok", value: request };
};
const admitWorkingPaths = ({ paths }: { readonly paths: { readonly sourceRoot: string; readonly root: string } }): Outcome<{ readonly sourceRoot: string; readonly root: string }> => {
  const source = paths.sourceRoot.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
  const root = paths.root.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
  return root === "" || source === "" || root === source || root.startsWith(`${source}/`) ? failure({ detail: "harness settings require a working root outside authored source" }) : { status: "ok", value: paths };
};
const processInput = ({ paths, request, binary, operations }: { readonly paths: { readonly sourceRoot: string; readonly root: string }; readonly request: HarnessSettingsRequest; readonly binary: string; readonly operations: SourceHarnessSettingsOperations }) => ({
  binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: paths.root,
  env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: `${paths.root}/.settings-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) },
  input: JSON.stringify({ sourceRoot: paths.sourceRoot, files: request.files, invocation: request.invocation, onboarding: request.onboarding, harness: request.binding.harness, profile: qualifiedHarnessProfile(request.binding), paths: settingsSourcePaths(request), outputPaths: codexSettingsPaths() }),
});
const execute = async ({ request, binary, operations }: { readonly request: HarnessSettingsRequest; readonly binary: string; readonly operations: SourceHarnessSettingsOperations }): Promise<Outcome<PreparedHarnessSettings>> => {
  try { return await continuePreparation({ previous: admitWorkingPaths({ paths: operations.paths(request) }), consume: ({ prepared: paths }) => processOutcome({ reply: operations.spawn(processInput({ paths, request, binary, operations })), request }) }); }
  catch { return failure({ detail: "harness settings process capability unavailable" }); }
};
export const createSourceHarnessSettingsPreparer = ({ binary = "bun", operations = createSourceHarnessSettingsOperations(), environmentCap = null }: { readonly environmentCap?: Tier | null; readonly binary?: string; readonly operations?: SourceHarnessSettingsOperations } = {}): HarnessSettingsPreparer => ({ prepare: async (request) => {
  if (request.binding.harness === "kiro") {
    if (request.binding.directory !== ".kiro" || request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || !["aidlc", "bun .kiro/tools/aidlc.ts"].includes(request.invocation) || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777 || request.files.filter(file => file === ".kiro/tools/aidlc.ts").length !== 1) return failure({ detail: "Kiro settings require the pinned framework, exact invocation, modes and prepared dispatcher" });
    const paths = admitWorkingPaths({ paths: operations.paths(request) });
    if (paths.status === "invalid") return paths;
    const prepared = readSourceKiroPreparation({ sourceRoot: paths.value.sourceRoot, workRoot: paths.value.root, invocation: request.invocation, environmentCap, binary });
    if (prepared.status === "invalid") return prepared;
    const expected = qualifiedHarnessProfile(request.binding)!.settingsMappings.map(mapping => `.kiro/${mapping.dst}`);
    if (prepared.value.settings.length !== expected.length || expected.some(path => prepared.value.settings.filter(file => file.path === path).length !== 1) || prepared.value.toolScripts.some(script => request.files.filter(file => file === `.kiro/tools/${script}`).length !== 1)) return failure({ detail: "Kiro settings require every declared artifact and preapproved tool" });
    return { status: "ok", value: { files: prepared.value.settings.map(file => ({ path: file.path, bytes: new TextEncoder().encode(file.text), mode: request.mode })), preparation: { kind: "harness-settings", paths: expected, inputs: prepared.value.inputs } } };
  }
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : execute({ request: admitted.value, binary, operations });
} });
