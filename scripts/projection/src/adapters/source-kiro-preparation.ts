import { mkdtempSync, readdirSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { kiroPolicySourcePaths } from "./kiro-source-contract.ts";
import { qualifiedHarnessByName } from "./qualified-harness-profile.ts";
import type { SourceContentDigest } from "../domain/source-origin.ts";
import { z } from "zod";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment } from "./native-compiler-process.ts";
import { finding, type Outcome, type Tier } from "../domain/model.ts";
const modulePath = "harness/kiro/settings.ts";
const response = z.strictObject({
  agents: z.array(z.strictObject({ path: z.string().regex(/^harness\/kiro\/agents\/aidlc-[a-z-]+-agent\.json$/), text: z.string(), additions: z.array(z.string()) })),
  settings: z.array(z.strictObject({ path: z.string(), text: z.string() })),
  inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })),
  shellCommands: z.array(z.string()).min(1), toolScripts: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.ts$/)), sharedResources: z.array(z.string()), hookSuffix: z.literal("; exit $LASTEXITCODE"),
});
export type KiroSourcePreparation = z.infer<typeof response>;
const program = `
const request = await Bun.stdin.json();
const path = request.sourceRoot + "/${modulePath}";
const before = new Bun.CryptoHasher("sha256").update(await Bun.file(path).bytes()).digest("hex");
const module = await import(Bun.pathToFileURL(path).href);
const prepared = module.readKiroSourcePolicy(request);
if (prepared.inputs.find(input => input.path === "${modulePath}")?.sha256 !== before) throw new Error("Kiro preparation module changed before source observation");
process.stdout.write(JSON.stringify(prepared));
`;
const refuse = (detail: string): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "foreign-content", subject: "kiro-source-preparation", detail })] });
export function admitKiroSourcePreparation(candidate: unknown, expected: readonly SourceContentDigest[]): Outcome<KiroSourcePreparation> {
  const parsed = response.safeParse(candidate);
  if (!parsed.success) return refuse("Kiro preparation requires typed source-backed artifacts and policy evidence");
  const prepared = parsed.data;
  if (prepared.inputs.length !== expected.length || expected.some(input => prepared.inputs.filter(witness => witness.path === input.path && witness.sha256 === input.sha256).length !== 1)) return refuse("Kiro preparation must witness every exact policy, profile and knowledge input once without missing, unrelated or duplicate paths");
  const profile = qualifiedHarnessByName({ name: "kiro", harnessDir: ".kiro" })!;
  const agents = (profile.agentMappings ?? []).map(mapping => `harness/kiro/${mapping.src}`);
  const settings = profile.settingsMappings.map(mapping => `.kiro/${mapping.dst}`);
  if (prepared.agents.length !== agents.length || agents.some(path => prepared.agents.filter(agent => agent.path === path).length !== 1) || prepared.settings.length !== settings.length || settings.some(path => prepared.settings.filter(file => file.path === path).length !== 1)) return refuse("Kiro preparation must retain the exact selected settings and persona inventory");
  const shared = prepared.sharedResources.map(resource => resource.replace("file://.kiro/knowledge/aidlc-shared/", "core/knowledge/aidlc-shared/"));
  if (new Set(shared).size !== shared.length || shared.some(path => !/^core\/knowledge\/aidlc-shared\/[a-z][a-z0-9-]*\.md$/.test(path) || !expected.some(input => input.path === path))) return refuse("Kiro shared resource references require distinct witnessed methodology files");
  return { status: "ok", value: prepared };
}
function observeInputs(sourceRoot: string): readonly SourceContentDigest[] {
  const profile = qualifiedHarnessByName({ name: "kiro", harnessDir: ".kiro" })!;
  const knowledge = readdirSync(join(sourceRoot, "core/knowledge/aidlc-shared")).sort().map(path => `core/knowledge/aidlc-shared/${path}`);
  const paths = [...kiroPolicySourcePaths, ...[...profile.settingsMappings, ...(profile.agentMappings ?? [])].map(mapping => `harness/kiro/${mapping.src}`), ...knowledge];
  return paths.map(path => {
    const parts = path.split("/");
    for (let index = 0; index <= parts.length; index++) {
      const stat = lstatSync(join(sourceRoot, ...parts.slice(0, index)));
      if (stat.isSymbolicLink() || (index === parts.length ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Kiro source requires ordinary witnessed files: ${path}`);
    }
    return { path, sha256: new Bun.CryptoHasher("sha256").update(readFileSync(join(sourceRoot, path))).digest("hex") };
  });
}
export const readSourceKiroPreparation = ({ sourceRoot, workRoot, invocation, environmentCap = null, binary = "bun", inherited }: { readonly workRoot: string; readonly inherited?: Readonly<Record<string, string | undefined>>; readonly binary?: string; readonly sourceRoot: string; readonly invocation: string; readonly environmentCap?: Tier | null }): Outcome<KiroSourcePreparation> => {
  let owned: string | undefined;
  try {
    const process = createNativeCompilerProcessOperations({ timeout: 30000 });
    const root = resolve(sourceRoot);
    const scratch = resolve(workRoot);
    if (scratch.toLowerCase() === root.toLowerCase() || scratch.toLowerCase().startsWith(root.toLowerCase() + sep)) return refuse("Kiro preparation requires an explicit working root outside authored source");
    const before = observeInputs(root);
    owned = mkdtempSync(join(scratch, "kiro-policy-"));
    if (!resolve(owned).startsWith(scratch + sep)) throw new Error("Kiro preparation escaped its working root");
    const reply = process.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", program], cwd: owned, input: JSON.stringify({ sourceRoot: root, invocation, environmentCap }), env: { ...privateCompilerEnvironment({ inherited: inherited ?? process.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0) throw new Error(reply.stderr || reply.error || "Kiro policy process failed");
    const prepared = admitKiroSourcePreparation(JSON.parse(reply.stdout), before);
    if (prepared.status === "invalid") return prepared;
    return JSON.stringify(before) === JSON.stringify(observeInputs(root)) ? prepared : refuse("Kiro source changed during isolated preparation");
  } catch (error) {
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "kiro-source-preparation", detail: error instanceof Error ? error.message : String(error) })] };
  } finally {
    if (owned !== undefined) rmSync(owned, { recursive: true, force: true });
  }
};
