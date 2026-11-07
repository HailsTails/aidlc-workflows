import { parseKasWorkerPolicy } from "./kas-agent.ts";
import type { QualifiedHarnessProfile } from "./qualified-harness-profile.ts";
export type KasDeclaration = { readonly frontmatterAdditions?: readonly { readonly file: string; readonly lines: readonly string[] }[]; readonly pluginAgentFrontmatter?: readonly string[]; readonly nativeReplacements?: readonly { readonly from: string; readonly to: string }[] };
export function isKasDenyBlock(text: string): boolean {
  if (!text.startsWith("    - ") || text.split("\n").some(line => !line.startsWith("    "))) return false;
  const parsed = parseKasWorkerPolicy({ input: ['tools: ["shell"]', "permissions:", "  rules:", ...text.split("\n")], name: "native-deny", origin: { source: { kind: "core", id: "framework" }, pin: "source-policy-structure", path: "harness/kiro-ide/manifest.ts" } });
  return parsed.status === "ok" && parsed.value.contract.permissions.rules.length > 0 && parsed.value.contract.permissions.rules.every(rule => rule.capability === "shell" && rule.effect === "deny");
}
export function qualifyKasDeclaration(declaration: KasDeclaration, profile: QualifiedHarnessProfile): void {
  const names = profile.agentPolicyNames ?? [];
  const additions = declaration.frontmatterAdditions ?? [];
  const replacements = declaration.nativeReplacements ?? [];
  if (names.length === 0 || additions.length !== names.length || names.some(name => additions.filter(item => item.file === `agents/${name}.md`).length !== 1) || !declaration.pluginAgentFrontmatter?.length) throw new Error("KAS policy requires the exact qualified persona roster and plugin template");
  const policies = [...additions.map(item => item.lines.join("\n")), declaration.pluginAgentFrontmatter.join("\n")];
  if (replacements.length === 0 || new Set(replacements.map(item => item.from)).size !== replacements.length || replacements.some(item => !isKasDenyBlock(item.from) || !isKasDenyBlock(item.to) || item.from === item.to || !policies.some(policy => policy.split(item.from).length === 2)) || policies.some(policy => replacements.filter(item => policy.includes(item.from)).length !== 1 || replacements.some(item => policy.split(item.from).length > 2))) throw new Error("KAS native replacements require distinct complete deny policies with exactly one declaration per owned persona or plugin template");
}
export function prepareKasPolicyText(text: string, declaration: KasDeclaration, native: boolean): string {
  if (!native) return text;
  const replacement = declaration.nativeReplacements!.filter(item => text.includes(item.from));
  if (replacement.length !== 1 || text.split(replacement[0]!.from).length !== 2) throw new Error("KAS native deny policy must occur exactly once in its owned policy");
  return prepareKasShellText(text.replace(replacement[0]!.from, replacement[0]!.to));
}
// These are KAS permission patterns, not executable command prose.
export function prepareKasShellText(text: string): string {
  return text.replaceAll('- "bun .kiro/tools/aidlc-*"', '- "aidlc engine *"')
    .replaceAll('- "bun .kiro/tools/aidlc.ts engine ', '- "aidlc engine ')
    .replaceAll('- "bun .kiro/tools/aidlc*', '- "aidlc*')
    .replaceAll('- "aidlc engine *"\n        - "aidlc engine *"', '- "aidlc engine *"');
}
