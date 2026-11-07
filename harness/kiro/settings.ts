import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { z } from "zod";
import manifest from "./manifest.ts";
import { copyChannelDispatcherCommands, copyChannelToolScripts } from "../../core/tools/aidlc.ts";
import { trustedCommand, TRUSTED_ROUTE_NAMESPACE } from "../../core/tools/aidlc-command.ts";
import { readMemoryCap } from "../../core/tools/aidlc-tiers.ts";
import { writeKiroCliSurface } from "../../core/tools/aidlc-model-policy.ts";
import { SHIPPED_FORMAT_DOCS } from "../../core/tools/aidlc-inline-context.ts";
import { substituteAuthoredTokens } from "../../scripts/projection-text.ts";
import { prepareNativeRuntimeText } from "../../scripts/native-runtime-text.ts";
import { kiroCopyCommandPatterns } from "../../scripts/projection/src/adapters/kiro-agent.ts";
import { qualifyDeliveryDeclaration } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
import { qualifiedHarnessByName } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import type { Tier } from "../../scripts/projection/src/domain/model.ts";

import { kiroPolicySourcePaths } from "../../scripts/projection/src/adapters/kiro-source-contract.ts";
const hook = z.strictObject({ matcher: z.string().optional(), command: z.string(), timeout_ms: z.number().positive() });
const conductor = z.strictObject({ name: z.literal("aidlc"), description: z.string().min(1), prompt: z.string().min(1), includeMcpJson: z.literal(true), tools: z.array(z.string()), allowedTools: z.array(z.string()), toolsSettings: z.strictObject({ execute_bash: z.strictObject({ allowedCommands: z.array(z.string()), deniedCommands: z.array(z.string()).optional() }), fs_write: z.strictObject({ allowedPaths: z.array(z.string()) }), subagent: z.strictObject({ trustedAgents: z.array(z.string()) }) }), resources: z.array(z.string()), hooks: z.record(z.string(), z.array(hook)) });
const pattern = "bun (run )?[\"']?\\.kiro/tools/[A-Za-z0-9._-]+\\.ts[\"']?( .*)?";
const escapePattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export type KiroSourceRequest = { readonly sourceRoot: string; readonly invocation: string; readonly environmentCap: Tier | null };
export function readKiroSourcePolicy(request: KiroSourceRequest) {
  const profile = qualifiedHarnessByName({ name: "kiro", harnessDir: ".kiro" })!;
  qualifyDeliveryDeclaration(manifest, profile);
  if (manifest.kiroLayout !== "agent-v1" || manifest.tierFlavor !== "kiro" || manifest.hookCommandSuffix !== "; exit $LASTEXITCODE") throw new Error("Kiro preparation requires the qualified agent-v1 layout and exit-status policy");
  const mappings = [...profile.settingsMappings, ...(profile.agentMappings ?? [])];
  if (mappings.some(expected => manifest.harnessFiles.filter(file => file.src === expected.src && file.dst === expected.dst && !file.projectRoot && !file.copyOnly).length !== 1)) throw new Error("Kiro preparation requires exact authored settings and persona mappings");
  const paths = [...kiroPolicySourcePaths, ...mappings.map(mapping => `harness/kiro/${mapping.src}`)];
  const knowledgeRoot = "core/knowledge/aidlc-shared";
  const knowledge = readdirSync(`${request.sourceRoot}/${knowledgeRoot}`).sort();
  paths.push(...knowledge.map(path => `${knowledgeRoot}/${path}`));
  const observe = () => paths.map(path => {
    const parts = path.split("/");
    for (let index = 0; index <= parts.length; index++) {
      const stat = lstatSync([request.sourceRoot, ...parts.slice(0, index)].join("/"));
      if (stat.isSymbolicLink() || (index === parts.length ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Kiro policy requires ordinary source: ${path}`);
    }
    const bytes = readFileSync(`${request.sourceRoot}/${path}`);
    return { path, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") };
  });
  const before = observe();
  const read = (path: string) => readFileSync(`${request.sourceRoot}/harness/kiro/${path}`, "utf8");
  const substitute = (source: string) => substituteAuthoredTokens({ source, harnessDir: ".kiro", binding: { invoke: request.invocation, toolPrefix: "bun .kiro/tools/", trustedNamespace: TRUSTED_ROUTE_NAMESPACE } });
  const project = (source: string) => request.invocation === "aidlc" ? prepareNativeRuntimeText(substitute(source), ".kiro") : substitute(source);
  const dispatcherCommands = copyChannelDispatcherCommands();
  const toolScripts = copyChannelToolScripts();
  const shellCommands = request.invocation === "aidlc" ? [trustedCommand(".*"), ...dispatcherCommands.map(command => escapePattern(`aidlc ${command}`))] : [...kiroCopyCommandPatterns({ dispatcherCommands, toolScripts, dialect: "paired-quotes" })];
  const sharedResources = knowledge.filter(file => file.endsWith(".md") && !SHIPPED_FORMAT_DOCS.has(file)).map(file => `file://.kiro/knowledge/aidlc-shared/${file}`);
  if (manifest.frontmatterAdditions?.length !== profile.agentMappings?.length) throw new Error("Kiro prompt metadata requires exactly the qualified persona roster");
  const agents = (profile.agentMappings ?? []).map(mapping => {
    const name = mapping.src.slice("agents/".length, -".json".length);
    const additions = manifest.frontmatterAdditions?.filter(addition => addition.file === `agents/${name}.md`) ?? [];
    if (additions.length !== 1 || additions[0]!.lines.join("\n") !== 'tools: ["read", "write", "shell"]\nincludeMcpJson: true') throw new Error(`Kiro persona requires qualified prompt metadata: ${name}`);
    return { path: `harness/kiro/${mapping.src}`, text: substitute(read(mapping.src)), additions: additions[0]!.lines };
  });
  const value = conductor.parse(JSON.parse(substitute(read("agents/aidlc.json"))));
  if (value.toolsSettings.execute_bash.allowedCommands.length !== 1 || value.toolsSettings.execute_bash.allowedCommands[0] !== pattern) throw new Error("Kiro conductor grants require the authored tool-script pattern");
  value.toolsSettings.execute_bash.allowedCommands = shellCommands;
  value.resources = value.resources.flatMap(resource => resource === "file://.kiro/knowledge/aidlc-shared/*.md" ? sharedResources : [resource]);
  for (const hooks of Object.values(value.hooks)) for (const item of hooks) item.command += manifest.hookCommandSuffix!;
  const environmentCap = z.enum(["judgment", "balanced", "templated"]).nullable().parse(request.environmentCap);
  const cap = environmentCap ?? readMemoryCap(`${request.sourceRoot}/core/memory`);
  const settings = profile.settingsMappings.map(mapping => ({ path: `.kiro/${mapping.dst}`, text: mapping.src === "agents/aidlc.json" ? project(`${JSON.stringify(value, null, 2)}\n`) : mapping.src === "settings/cli.json" ? writeKiroCliSurface(project(read(mapping.src)), [], cap) : project(read(mapping.src)) }));
  for (const setting of settings) JSON.parse(setting.text);
  const after = observe();
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(knowledge) !== JSON.stringify(readdirSync(`${request.sourceRoot}/${knowledgeRoot}`).sort())) throw new Error("Kiro policy source changed during preparation");
  return { agents, settings, inputs: before, shellCommands, toolScripts, sharedResources, hookSuffix: manifest.hookCommandSuffix };
}
