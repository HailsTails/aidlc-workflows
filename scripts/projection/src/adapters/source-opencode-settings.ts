import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { ordinarySourcePath, verifyProductionInputs } from "./source-input-contract.ts";
import { observeOpenCodeInputs } from "./opencode-source-contract.ts";
import { assertPlainSourceData } from "./plain-source-data.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment } from "./native-compiler-process.ts";
import type { HarnessSettingsRequest, PreparedHarnessSettings } from "../domain/harness-settings.ts";
import type { SourceContentDigest } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const outputs = [".opencode/plugin/aidlc-opencode-adapter.ts", ".opencode/command/aidlc.md", "opencode.json"];
const response = z.strictObject({ files: z.array(z.strictObject({ path: z.string(), text: z.string().min(1) })), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) });
const refuse = (detail: string): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "foreign-content", subject: "opencode-settings", detail })] });
const program = `
const request = await Bun.stdin.json();
const { types } = await import("node:util");
const isProxy = types.isProxy;
const assertPlainSourceData = ${assertPlainSourceData.toString()};
const observe = async () => {
  for (const input of request.expected) if (new Bun.CryptoHasher("sha256").update(await Bun.file(request.sourceRoot + "/" + input.path).bytes()).digest("hex") !== input.sha256) throw new Error("OpenCode source changed during isolated preparation");
};
await observe();
const load = path => import(Bun.pathToFileURL(request.sourceRoot + "/" + path).href);
const [api, manifest, delivery, profiles] = await Promise.all(["harness/opencode/settings.ts", "harness/opencode/manifest.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts", "scripts/projection/src/adapters/qualified-harness-profile.ts"].map(load));
const { manifestEmitter } = await load("scripts/projection/src/adapters/manifest-capabilities.ts");
manifestEmitter(manifest.default);
const profile = profiles.qualifiedHarnessByName({ name: "opencode", harnessDir: ".aidlc" });
delivery.qualifyDeliveryDeclaration(manifest.default, profile);
const expectedMappings = [...profile.entryDocuments.map(item => ({ src: item.source, dst: item.destination.slice(".aidlc/".length) })), { src: profile.referenceTemplate, dst: profile.referenceDestination.slice(".aidlc/".length) }, ...profile.rootMappings.map(item => ({ ...item, projectRoot: true }))];
const actual = manifest.default.harnessFiles;
if (actual.length !== expectedMappings.length || expectedMappings.some(mapping => actual.filter(item => item.src === mapping.src && item.dst === mapping.dst && (item.projectRoot ?? false) === (mapping.projectRoot ?? false) && !item.copyOnly && Object.keys(item).every(key => ["src", "dst", "projectRoot", "copyOnly"].includes(key))).length !== 1)) throw new Error("OpenCode requires exact declared entry and root mappings");
const read = async path => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await Bun.file(request.sourceRoot + "/harness/opencode/" + path).bytes());
const files = api.prepareOpenCodeSurfaces({ invocation: request.invocation, beforeHost: request.beforeHost, files: request.files, adapter: await read("plugin/aidlc-opencode-adapter.ts"), command: await read("command/aidlc.md"), config: await read("opencode.json") });
assertPlainSourceData(files);
await observe();
process.stdout.write(JSON.stringify({ files, inputs: request.expected }));
`;
export function admitOpenCodeSettings(candidate: unknown, expected: readonly SourceContentDigest[], mode: number): Outcome<PreparedHarnessSettings> {
  const parsed = response.safeParse(candidate);
  if (!parsed.success) return refuse("OpenCode requires text artifacts and source witnesses");
  const { files, inputs } = parsed.data;
  try { verifyProductionInputs(expected, inputs); } catch (error) { return refuse(String(error)); }
  if (files.length !== outputs.length || outputs.some(path => files.filter(file => file.path === path).length !== 1)) return refuse("OpenCode requires exactly its external adapter, command and ordered root config");
  try { JSON.parse(files.find(file => file.path === "opencode.json")!.text); } catch { return refuse("OpenCode configuration requires JSON text"); }
  return { status: "ok", value: { files: files.map(file => ({ path: file.path, bytes: new TextEncoder().encode(file.text), mode })), preparation: { kind: "harness-settings", paths: outputs, inputs } } };
}
export function prepareSourceOpenCodeSettings(request: HarnessSettingsRequest, binary = process.execPath): Outcome<PreparedHarnessSettings> {
  let owned: string | undefined;
  try {
    if (request.binding.harness !== "opencode" || request.binding.directory !== ".aidlc" || request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin) || !["aidlc", "bun .aidlc/tools/aidlc.ts"].includes(request.invocation) || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777 || request.files.filter(path => path === ".aidlc/tools/aidlc.ts").length !== 1) return refuse("OpenCode requires a pinned framework, explicit delivery, file mode and prepared dispatcher");
    ordinarySourcePath(request.sourceRoot, true); ordinarySourcePath(request.root, true);
    const source = resolve(request.sourceRoot).toLowerCase(), work = resolve(request.root).toLowerCase();
    if (source === work || source.startsWith(work + sep) || work.startsWith(source + sep)) return refuse("OpenCode requires an explicit separate working root");
    const before = observeOpenCodeInputs(request.sourceRoot);
    owned = mkdtempSync(join(request.root, "opencode-settings-"));
    const operations = createNativeCompilerProcessOperations();
    const reply = operations.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", program], cwd: owned, input: JSON.stringify({ sourceRoot: request.sourceRoot, invocation: request.invocation, beforeHost: request.preparationStage === "before-host", files: request.files, expected: before }), env: { ...privateCompilerEnvironment({ inherited: operations.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0) return refuse(reply.stderr || reply.error || "OpenCode settings process failed");
    verifyProductionInputs(before, observeOpenCodeInputs(request.sourceRoot));
    return admitOpenCodeSettings(JSON.parse(reply.stdout), before, request.mode);
  } catch (error) { return refuse(error instanceof Error ? error.message : "OpenCode settings preparation unavailable"); }
  finally { if (owned !== undefined) rmSync(owned, { recursive: true, force: true }); }
}
