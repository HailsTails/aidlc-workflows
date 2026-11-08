import { removeDistributionDirectory, type DistributionDirectories, type DistributionDirectoryFactory } from "./distribution-directory.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { ordinaryCopilotPath, observeCopilotSettingsInputs } from "./copilot-source-contract.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory, privateCompilerEnvironment } from "./native-compiler-process.ts";
import type { HarnessSettingsRequest, PreparedHarnessSettings } from "../domain/harness-settings.ts";
import type { SourceContentDigest } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const output = ".github/hooks/aidlc.json";
const replySchema = z.strictObject({ text: z.string().min(1), launcher: z.string().min(1), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) });
const refuse = (detail: string): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "foreign-content", subject: "copilot-settings", detail })] });
const program = `
const request = await Bun.stdin.json();
const observe = async () => {
  for (const input of request.expected) {
    if (new Bun.CryptoHasher("sha256").update(await Bun.file(request.sourceRoot + "/" + input.path).bytes()).digest("hex") !== input.sha256) throw new Error("Copilot settings source changed during preparation");
  }
};
await observe();
const api = await import(Bun.pathToFileURL(request.sourceRoot + "/harness/copilot/settings.ts").href);
if (typeof api.prepareCopilotHooks !== "function") throw new Error("Copilot hook policy is unavailable");
const text = api.prepareCopilotHooks(request.invocation);
const launcher = api.prepareCopilotLauncher(request.invocation);
if (typeof launcher !== "string" || launcher.length === 0) throw new Error("Copilot launcher must return raw text before serialization");
if (typeof text !== "string" || text.length === 0) throw new Error("Copilot hooks must return raw text before serialization");
await observe();
process.stdout.write(JSON.stringify({ text, launcher, inputs: request.expected }));
`;
export function admitCopilotSettings(candidate: unknown, expected: readonly SourceContentDigest[], mode: number): Outcome<PreparedHarnessSettings> {
  const parsed = replySchema.safeParse(candidate);
  if (!parsed.success) return refuse("Copilot settings require text and exact source evidence");
  const { text, launcher, inputs } = parsed.data;
  if (inputs.length !== expected.length || expected.some(input => inputs.filter(item => item.path === input.path && item.sha256 === input.sha256).length !== 1)) return refuse("Copilot settings require every independently observed source witness exactly once");
  try { JSON.parse(text); } catch { return refuse("Copilot hooks require JSON text"); }
  return { status: "ok", value: { files: [{ path: output, bytes: new TextEncoder().encode(text), mode }, { path: ".aidlc/bin/aidlc-engine", bytes: new TextEncoder().encode(launcher), mode: 0o755 }], preparation: { kind: "harness-settings", paths: [output, ".aidlc/bin/aidlc-engine"], inputs } } };
}
const removeCopilotWorkingRoot = ({ root, owner }: { readonly root: string | undefined; readonly owner: DistributionDirectories | undefined }): void => {
  if (root === undefined) return;
  if (owner === undefined) { rmSync(root, { recursive: true, force: true }); return; }
  removeDistributionDirectory({ directories: owner, root });
};
const requireCopilotWorkingRoot = ({ sourceRoot, root, detail }: { readonly sourceRoot: string; readonly root: string; readonly detail: string }): void => {
  ordinaryCopilotPath(root, true);
  const source = resolve(sourceRoot).toLowerCase(), working = resolve(root).toLowerCase();
  if (source === working || source.startsWith(working + sep) || working.startsWith(source + sep)) throw new Error(detail);
};
export function prepareSourceCopilotSettings(request: HarnessSettingsRequest, options: string | { readonly binary?: string; readonly processes?: NativeCompilerProcessFactory; readonly directories?: DistributionDirectoryFactory | undefined } = {}): Outcome<PreparedHarnessSettings> {
  const { binary = process.execPath, processes = createNativeCompilerProcessOperations, directories } = typeof options === "string" ? { binary: options } : options;
  let owned: string | undefined;
  let owner: DistributionDirectories | undefined;
  try {
    if (request.binding.harness !== "copilot" || request.binding.directory !== ".aidlc" || request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || !["aidlc", "bun .aidlc/tools/aidlc.ts"].includes(request.invocation) || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777 || request.files.filter(path => path === ".aidlc/hooks/aidlc-copilot-adapter.ts").length !== 1) return refuse("Copilot settings require a pinned framework, explicit delivery, file mode and exactly one prepared adapter");
    ordinaryCopilotPath(request.sourceRoot, true);
    requireCopilotWorkingRoot({ sourceRoot: request.sourceRoot, root: request.root, detail: "Copilot settings require a separate private working root" });
    const before = observeCopilotSettingsInputs(request.sourceRoot);
    owner = directories?.();
    owned = directories === undefined ? mkdtempSync(join(request.root, "copilot-settings-")) : owner!.allocate();
    if (directories !== undefined) requireCopilotWorkingRoot({ sourceRoot: request.sourceRoot, root: owned, detail: "Copilot requires a separate private working root" });
    const operations = processes();
    const reply = operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", program], cwd: owned, input: JSON.stringify({ sourceRoot: request.sourceRoot, invocation: request.invocation, expected: before }), env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0) return refuse(reply.stderr || reply.error || "Copilot settings process failed");
    const prepared = admitCopilotSettings(JSON.parse(reply.stdout), before, request.mode);
    return JSON.stringify(before) === JSON.stringify(observeCopilotSettingsInputs(request.sourceRoot)) ? prepared : refuse("Copilot settings source changed during isolated preparation");
  } catch (error) { return refuse(error instanceof Error ? error.message : "Copilot settings preparation unavailable"); }
  finally { removeCopilotWorkingRoot({ root: owned, owner }); }
}
