import { mkdtempSync, rmSync } from "node:fs";
import { join, isAbsolute, resolve, sep } from "node:path";
import { isKasDenyBlock } from "./qualified-kas-policy.ts";
import { parseKasWorkerPolicy } from "./kas-agent.ts";
import { observeKasInputs, ordinaryKasPath } from "./kas-source-contract.ts";
import { qualifiedHarnessByName } from "./qualified-harness-profile.ts";
import type { SourceContentDigest } from "../domain/source-origin.ts";
import { z } from "zod";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment } from "./native-compiler-process.ts";
import { finding, type Outcome, type Tier } from "../domain/model.ts";
const modulePath = "harness/kiro-ide/settings.ts";
const response = z.strictObject({
  agents: z.array(z.strictObject({ name: z.string(), lines: z.array(z.string()), namespaceLiteral: z.string().nullable() })),
  settings: z.array(z.strictObject({ path: z.string(), text: z.string() })),
  inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })),
  toolScripts: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.ts$/)),
});
export type KasSourcePreparation = z.infer<typeof response>;
const program = `
const request = await Bun.stdin.json();
const path = request.sourceRoot + "/${modulePath}";
const before = new Bun.CryptoHasher("sha256").update(await Bun.file(path).bytes()).digest("hex");
const module = await import(Bun.pathToFileURL(path).href);
const prepared = module.readKasSourcePolicy(request);
if (prepared.inputs.find(input => input.path === "${modulePath}")?.sha256 !== before) throw new Error("Kas preparation module changed before source observation");
process.stdout.write(JSON.stringify(prepared));
`;
const refuse = (detail: string): Outcome<never> => ({ status: "invalid", findings: [finding({ code: "foreign-content", subject: "kas-source-preparation", detail })] });
export function admitKasSourcePreparation(candidate: unknown, expected: readonly SourceContentDigest[], invocation: string): Outcome<KasSourcePreparation> {
  const parsed = response.safeParse(candidate);
  if (!parsed.success) return refuse("Kas preparation requires typed source-backed artifacts and policy evidence");
  const prepared = parsed.data;
  if (prepared.inputs.length !== expected.length || expected.some(input => prepared.inputs.filter(witness => witness.path === input.path && witness.sha256 === input.sha256).length !== 1)) return refuse("Kas preparation must witness every exact policy, profile and knowledge input once without missing, unrelated or duplicate paths");
  const profile = qualifiedHarnessByName({ name: "kiro-ide", harnessDir: ".kiro" })!;
  const agents = profile.agentPolicyNames!;
  const settings = [...profile.settingsMappings.map(mapping => `.kiro/${mapping.dst}`), ".kiro/tools/data/plugin-agent.md"];
  if (prepared.agents.length !== agents.length || agents.some(name => prepared.agents.filter(agent => agent.name === name).length !== 1) || prepared.settings.length !== settings.length || settings.some(path => prepared.settings.filter(file => file.path === path).length !== 1)) return refuse("KAS preparation requires the exact selected persona and settings inventory");
  if (!["aidlc", "bun .kiro/tools/aidlc.ts"].includes(invocation)) return refuse("KAS preparation requires its exact delivery invocation");
  const manifestPath = "harness/kiro-ide/manifest.ts";
  const pin = expected.find(input => input.path === manifestPath)?.sha256;
  if (pin === undefined) return refuse("KAS policy requires its observed source manifest");
  const plugin = prepared.settings.find(file => file.path === ".kiro/tools/data/plugin-agent.md")!.text;
  if (!plugin.startsWith("---\n") || !plugin.endsWith("\n---\n")) return refuse("KAS plugin template requires only a complete frontmatter policy");
  const leaves = [...prepared.agents, { name: "plugin-agent", lines: plugin.slice(4,-5).split("\n") }];
  for (const leaf of leaves) {
    const policy = parseKasWorkerPolicy({ input: leaf.lines, name: leaf.name, origin: { source: { kind: "core", id: "framework" }, pin, path: manifestPath } });
    if (policy.status === "invalid") return policy;
  }
  if (prepared.agents.some(agent => invocation === "aidlc" ? agent.namespaceLiteral === null || !isKasDenyBlock(agent.namespaceLiteral) || agent.lines.join("\n").split(agent.namespaceLiteral).length !== 2 : agent.namespaceLiteral !== null)) return refuse("KAS namespace literals must bind exactly once within each native persona's prepared policy, never its prose or copy output");
  return { status: "ok", value: prepared };
}
export const readSourceKasPreparation = ({ sourceRoot, workRoot, invocation, environmentCap = null, binary = "bun", inherited }: { readonly workRoot: string; readonly inherited?: Readonly<Record<string, string | undefined>>; readonly binary?: string; readonly sourceRoot: string; readonly invocation: string; readonly environmentCap?: Tier | null }): Outcome<KasSourcePreparation> => {
  let owned: string | undefined;
  try {
    const process = createNativeCompilerProcessOperations({ timeout: 30000 });
    if (!isAbsolute(sourceRoot) || !isAbsolute(workRoot)) return refuse("KAS preparation requires absolute source and work roots");
    const root = resolve(sourceRoot);
    const scratch = resolve(workRoot);
    if (scratch.toLowerCase() === root.toLowerCase() || scratch.toLowerCase().startsWith(root.toLowerCase() + sep) || root.toLowerCase().startsWith(scratch.toLowerCase() + sep)) return refuse("Kas preparation requires an explicit working root outside authored source");
    ordinaryKasPath(root); ordinaryKasPath(scratch);
    const before = observeKasInputs(root);
    owned = mkdtempSync(join(scratch, "kas-policy-"));
    if (!resolve(owned).startsWith(scratch + sep)) throw new Error("Kas preparation escaped its working root");
    const reply = process.spawn({ binary, args: ["--no-env-file", "--no-install", "--eval", program], cwd: owned, input: JSON.stringify({ sourceRoot: root, workRoot: owned, invocation, environmentCap }), env: { ...privateCompilerEnvironment({ inherited: inherited ?? process.environment(), root: owned }), BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", BUN_INSTALL_AUTO: "disable" } });
    if (reply.exitCode !== 0 || reply.error !== null || reply.stderr.trim().length > 0) throw new Error(reply.stderr || reply.error || "Kas policy process failed");
    const prepared = admitKasSourcePreparation(JSON.parse(reply.stdout), before, invocation);
    if (prepared.status === "invalid") return prepared;
    return JSON.stringify(before) === JSON.stringify(observeKasInputs(root)) ? prepared : refuse("Kas source changed during isolated preparation");
  } catch (error) {
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "kas-source-preparation", detail: error instanceof Error ? error.message : String(error) })] };
  } finally {
    if (owned !== undefined) rmSync(owned, { recursive: true, force: true });
  }
};
