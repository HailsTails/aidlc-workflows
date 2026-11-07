import { z } from "zod";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnReply, type NativeCompilerSpawnInput } from "./native-compiler-process.ts";
import { renderAuthoredProse, type AuthoredProseContext } from "../domain/authored-prose.ts";
import type { PreparedHarnessDocuments } from "../domain/harness-document.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { copyHarnessBinding } from "../domain/harness-binding.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { continuePreparation } from "../application/preparation-result.ts";

const sourcePaths = ["harness/claude/manifest.ts", "harness/claude/onboarding.fills.ts", "core/templates/onboarding.md", "core/templates/onboarding-harness.md", "scripts/onboarding.ts", "scripts/onboarding-projection.ts"];
const nativeSourcePaths = ["scripts/native-runtime-text.ts", "scripts/native-command-context.ts", "scripts/native-command-text.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-routes.ts"];
export const onboardingSourcePaths = ({ invocation }: { readonly invocation: string }): readonly string[] => [...sourcePaths, ...(invocation === "aidlc" ? nativeSourcePaths : [])];
export type OnboardingRequest = { readonly sourceRoot: string; readonly workRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext };
export type OnboardingOperations = NativeCompilerProcessOperations & { readonly paths: (input: OnboardingRequest) => { readonly root: string; readonly workRoot: string }; readonly prose: typeof renderAuthoredProse };
export const createOnboardingOperations = (): OnboardingOperations => ({ ...createNativeCompilerProcessOperations(), paths: ({ sourceRoot, workRoot }) => ({ root: Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), workRoot: Bun.fileURLToPath(Bun.pathToFileURL(workRoot)) }), prose: renderAuthoredProse });
export type OnboardingPreparer = { readonly prepare: (input: OnboardingRequest) => Promise<Outcome<PreparedHarnessDocuments>> };
const replySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ok"), text: z.string().min(1), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }),
  z.strictObject({ status: z.literal("unavailable"), detail: z.string() }),
]);
const worker = `
const input = await Bun.stdin.json();
const paths = input.paths;
const unavailable = ({ detail }) => ({ status: "unavailable", detail });
const observe = async () => {
  const fs = await import("node:fs/promises");
  const observed = await Promise.all(paths.map(async path => {
    const segments = path.split("/");
    const components = [input.root, ...segments.map((_, index) => input.root + "/" + segments.slice(0, index + 1).join("/"))];
    const stats = await Promise.all(components.map(component => fs.lstat(component)));
    if (stats.some((stat, index) => stat.isSymbolicLink() || (index === stats.length - 1 ? !stat.isFile() : !stat.isDirectory()))) return null;
    return { path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.root + "/" + path).bytes()).digest("hex") };
  }));
  return observed.some(witness => witness === null) ? unavailable({ detail: "onboarding requires ordinary authored files without source symlinks" }) : { status: "ok", inputs: observed };
};
const admitManifest = ({ manifest }) => {
  const spec = manifest?.onboarding;
  if (manifest?.name !== "claude" || manifest?.harnessDir !== ".claude" || spec?.dst !== "CLAUDE.md" || spec.projectRoot !== undefined && spec.projectRoot !== false || spec.harnessDst !== undefined || Object.keys(spec).some(key => !["dst", "fills", "projectRoot"].includes(key))) return unavailable({ detail: "onboarding requires the declared Claude combined harness destination; split or project-root placement is not qualified" });
  if (typeof spec.fills?.invoke !== "string" || typeof spec.fills?.slots !== "object" || spec.fills.slots === null || Array.isArray(spec.fills.slots) || Object.values(spec.fills.slots).some(fill => typeof fill !== "string") || Object.keys(spec.fills).some(key => !["invoke", "slots"].includes(key))) return unavailable({ detail: "onboarding requires native string slot fills" });
  return { status: "ok", spec };
};
const loadSourceModule = ({ path }) => import(Bun.pathToFileURL(input.root + "/" + path).href);
const importNative = async () => {
  const [manifestModule, renderer, projection] = await Promise.all([loadSourceModule({ path: "harness/claude/manifest.ts" }), loadSourceModule({ path: "scripts/onboarding.ts" }), loadSourceModule({ path: "scripts/onboarding-projection.ts" })]);
  return { manifestModule, renderer, projection };
};
const admitNative = ({ manifestModule, renderer, projection }) => {
  const admitted = admitManifest({ manifest: manifestModule.default });
  if (admitted.status !== "ok") return admitted;
  return typeof renderer.renderNeutralOnboarding !== "function" || typeof renderer.renderOnboarding !== "function" || typeof projection.projectOnboardingDocuments !== "function" ? unavailable({ detail: "onboarding native rendering capabilities unavailable" }) : { ...admitted, renderer, projection };
};
const loadNative = async () => admitNative(await importNative());
const readText = async ({ path }) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await Bun.file(input.root + "/" + path).bytes());
const admitCombinedDocument = ({ documents, spec }) => {
  if (!Array.isArray(documents) || documents.length !== 1 || documents[0]?.kind !== "combined" || documents[0]?.destination?.root !== "harness" || documents[0]?.destination?.path !== spec.dst || typeof documents[0]?.content !== "string") return unavailable({ detail: "onboarding native placement returned an unsupported document set" });
  return { status: "ok", content: documents[0].content };
};
const renderCombined = ({ documents, spec, renderer }) => {
  const admitted = admitCombinedDocument({ documents, spec });
  if (admitted.status !== "ok") return admitted;
  return { status: "ok", text: renderer.renderOnboarding(admitted.content, spec.fills) };
};
const renderNative = async ({ spec, renderer, projection }) => {
  const neutral = renderer.renderNeutralOnboarding(await readText({ path: "core/templates/onboarding.md" }));
  const nativeSkeleton = await readText({ path: "core/templates/onboarding-harness.md" });
  const documents = projection.projectOnboardingDocuments({ neutral, nativeSkeleton, shared: { root: "harness", path: spec.dst }, nativePath: null });
  return renderCombined({ documents, spec, renderer });
};
const retainStable = ({ before, after, rendered }) => after.status !== "ok" || JSON.stringify(before.inputs) !== JSON.stringify(after.inputs) ? unavailable({ detail: "onboarding source changed during preparation" }) : { ...rendered, inputs: after.inputs };
const prepare = async () => {
  const before = await observe();
  if (before.status !== "ok") return before;
  const native = await loadNative();
  if (native.status !== "ok") return native;
  let rendered = await renderNative(native);
  if (rendered.status === "ok" && input.invocation === "aidlc") {
    const policy = await loadSourceModule({ path: "scripts/native-runtime-text.ts" });
    rendered = { ...rendered, text: policy.prepareClaudeNativeRuntimeText(policy.prepareNativeOnboardingText(rendered.text, true)) };
  }
  if (rendered.status !== "ok") return rendered;
  return retainStable({ before, after: await observe(), rendered });
};
try { process.stdout.write(JSON.stringify(await prepare())); }
catch { process.stdout.write(JSON.stringify(unavailable({ detail: "onboarding authored inputs or native rendering unavailable" }))); }
`;
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "foreign-content" | "invalid-input" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "onboarding-source", detail })] });
const admitRequest = ({ request }: { readonly request: OnboardingRequest }): Outcome<OnboardingRequest> => request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || request.context.harness !== "claude" || request.context.directory !== ".claude" || !["bun .claude/tools/aidlc.ts", "aidlc"].includes(request.context.invocation) || request.context.rulesSubdir !== "rules"
  ? failure({ detail: "onboarding qualifies a pinned framework source with the Claude copy or native binding and declared rules directory" }) : { status: "ok", value: request };
type PreparedOnboardingReply = z.infer<typeof replySchema> & { readonly status: "ok" };
const admitWitnesses = ({ prepared, request }: { readonly prepared: PreparedOnboardingReply; readonly request: OnboardingRequest }): Outcome<PreparedOnboardingReply> => {
  const sourcePaths = onboardingSourcePaths({ invocation: request.context.invocation });
  if (prepared.inputs.length !== sourcePaths.length || sourcePaths.some((path) => prepared.inputs.filter((input) => input.path === path).length !== 1)) return failure({ code: "foreign-content", detail: "onboarding must witness every declared template, fill, manifest and rendering module exactly once" });
  return { status: "ok", value: prepared };
};
const retainRenderedOnboarding = ({ prepared, request, text }: { readonly prepared: PreparedOnboardingReply; readonly request: OnboardingRequest; readonly text: string }): Outcome<PreparedHarnessDocuments> => /\{\{[^{}\r\n]+\}\}/.test(text)
  ? failure({ code: "invalid-input", detail: "onboarding contains an unsupported authored template marker" })
  : { status: "ok", value: { inputs: prepared.inputs, documents: [{ authored: { role: "onboarding", origin: { ...request.basis, path: "core/templates/onboarding.md" }, text: prepared.text }, binding: copyHarnessBinding({ binding: request.context }), text, authoring: prepared.inputs.filter((input) => input.path !== "core/templates/onboarding.md").map((input) => ({ ...request.basis, path: input.path })) }] } };
const retainOnboarding = ({ prepared, request, operations }: { readonly prepared: PreparedOnboardingReply; readonly request: OnboardingRequest; readonly operations: OnboardingOperations }): Promise<Outcome<PreparedHarnessDocuments>> => continuePreparation({ previous: admitWitnesses({ prepared, request }), consume: ({ prepared: admitted }) => continuePreparation({ previous: operations.prose({ markdown: admitted.text, context: { ...request.context, optionLetters: null }, subject: "core/templates/onboarding.md" }), consume: ({ prepared: text }) => retainRenderedOnboarding({ prepared: admitted, request, text }) }) });
const decodeOnboarding = async ({ stdout, request, operations }: { readonly stdout: string; readonly request: OnboardingRequest; readonly operations: OnboardingOperations }): Promise<Outcome<PreparedHarnessDocuments>> => {
  let decoded: unknown;
  try { decoded = JSON.parse(stdout); }
  catch { return failure({ code: "invalid-input", detail: "onboarding process must return one JSON response" }); }
  const parsed = replySchema.safeParse(decoded);
  if (!parsed.success) return failure({ code: "invalid-input", detail: "onboarding process must return native text and SHA-256 input witnesses or explicit unavailability" });
  return parsed.data.status === "unavailable" ? failure({ detail: parsed.data.detail }) : retainOnboarding({ prepared: parsed.data, request, operations });
};
const processOutcome = async ({ reply, request, operations }: { readonly reply: NativeCompilerSpawnReply; readonly request: OnboardingRequest; readonly operations: OnboardingOperations }): Promise<Outcome<PreparedHarnessDocuments>> => reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0
  ? failure({ detail: "onboarding process unavailable or reported diagnostics" }) : decodeOnboarding({ stdout: reply.stdout, request, operations });
const admitWorkingPaths = ({ root, workRoot }: { readonly root: string; readonly workRoot: string }): Outcome<{ readonly root: string; readonly workRoot: string }> => {
  const source = root.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
  const scratch = workRoot.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
  return source === "" || scratch === "" || scratch === source || scratch.startsWith(`${source}/`) ? failure({ detail: "onboarding requires a separate working root outside its authored source tree" }) : { status: "ok", value: { root, workRoot } };
};
const processInput = ({ paths, binary, operations, invocation }: { readonly invocation: string; readonly paths: { readonly root: string; readonly workRoot: string }; readonly binary: string; readonly operations: OnboardingOperations }): NativeCompilerSpawnInput => {
  const { root, workRoot } = paths;
  const env = { ...privateCompilerEnvironment({ inherited: operations.environment(), root: `${workRoot}/.onboarding-home` }), ...Object.fromEntries([["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]) };
  return { binary, args: ["--no-env-file", "--no-install", "--eval", worker], cwd: workRoot, env, input: JSON.stringify({ root, invocation, paths: onboardingSourcePaths({ invocation }) }) };
};
const executeOnboarding = async ({ request, binary, operations }: { readonly request: OnboardingRequest; readonly binary: string; readonly operations: OnboardingOperations }): Promise<Outcome<PreparedHarnessDocuments>> => {
  try { return await continuePreparation({ previous: admitWorkingPaths(operations.paths(request)), consume: ({ prepared: paths }) => processOutcome({ reply: operations.spawn(processInput({ paths, binary, operations, invocation: request.context.invocation })), request, operations }) }); }
  catch { return failure({ detail: "onboarding process capability unavailable" }); }
};
export const createOnboardingPreparer = ({ binary = "bun", operations = createOnboardingOperations() }: { readonly binary?: string; readonly operations?: OnboardingOperations } = {}): OnboardingPreparer => ({ prepare: async (request) => {
  const admitted = admitRequest({ request });
  return admitted.status === "invalid" ? admitted : executeOnboarding({ request: admitted.value, binary, operations });
} });
