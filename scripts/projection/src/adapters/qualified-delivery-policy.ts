import type { KasDeclaration } from "./qualified-kas-policy.ts";
import type { ExecutableDelivery, QualifiedHarnessProfile } from "./qualified-harness-profile.ts";

type DeliveryDeclaration = KasDeclaration & {
  readonly name: string;
  readonly harnessDir: string;
  readonly harnessFiles: readonly { readonly src: string; readonly dst: string; readonly projectRoot?: boolean; readonly copyOnly?: boolean }[];
  readonly rootIntegrations: readonly { readonly path: string; readonly policy: string; readonly marker?: string; readonly shared?: string; readonly optional?: boolean }[];
  readonly tierFlavor?: string;
  readonly nativeRootIntegrations?: unknown;
  readonly nativeReplacements?: readonly { readonly from: string; readonly to: string }[];
};

// Delivery declarations are admitted independently of layout and model invocation.
export function qualifyDeliveryDeclaration(declaration: DeliveryDeclaration, profile: QualifiedHarnessProfile): void {
  if (declaration.name !== profile.harness || declaration.harnessDir !== profile.directory || !Array.isArray(declaration.harnessFiles) || !Array.isArray(declaration.rootIntegrations)) throw new Error("delivery requires the qualified authored manifest");
  if (profile.harness === "copilot") {
    const roots = declaration.rootIntegrations;
    const exact = (path: string, policy: string, marker: string | undefined, shared: string | undefined, optional: boolean | undefined) => roots.filter(root => root.path === path && root.policy === policy && root.marker === marker && root.shared === shared && root.optional === optional).length === 1;
    if (declaration.tierFlavor !== "copilot" || roots.length !== 3 || !exact("AGENTS.md", "managed-block", "agents", undefined, undefined) || !exact(".gitignore", "managed-block", "gitignore", "union", undefined) || !exact(".vscode/settings.json", "jsonc-settings", undefined, undefined, true)) throw new Error("Copilot requires model inheritance, exclusive root guidance, union ignore rules and optional additive editor settings");
  }
  if (declaration.nativeRootIntegrations !== undefined) throw new Error("delivery does not admit nativeRootIntegrations declarations");
  const omitted = declaration.harnessFiles.filter(mapping => mapping.copyOnly);
  if (omitted.length !== profile.copyOnlyRoots.length || profile.copyOnlyRoots.some(expected => omitted.filter(mapping => mapping.src === expected.src && mapping.dst === expected.dst && mapping.projectRoot === true && mapping.copyOnly === true).length !== 1 || declaration.rootIntegrations.filter(integration => integration.path === expected.dst && integration.policy === expected.policy).length !== 1)) throw new Error("delivery does not admit unqualified copyOnly resources or root ownership");
  if (profile.nativePolicy === "kas-personas") {
    const { qualifyKasDeclaration } = require("./qualified-kas-policy.ts") as typeof import("./qualified-kas-policy.ts");
    qualifyKasDeclaration(declaration, profile); return;
  }
  const replacements = declaration.nativeReplacements;
  if (profile.nativeReplacementCount === 0 ? replacements !== undefined : !Array.isArray(replacements) || replacements.length !== profile.nativeReplacementCount || profile.nativeTextSources.length !== 1 || replacements.some(replacement => typeof replacement.from !== "string" || replacement.from.length === 0 || typeof replacement.to !== "string" || replacement.to.length === 0 || replacement.from === replacement.to)) throw new Error("delivery does not admit unqualified nativeReplacements declarations");
}

export function prepareDeliveryDeclaration<Declaration extends DeliveryDeclaration>(declaration: Declaration, profile: QualifiedHarnessProfile, delivery: ExecutableDelivery): Declaration {
  qualifyDeliveryDeclaration(declaration, profile);
  return delivery === "copy" ? declaration : { ...declaration, rootIntegrations: declaration.rootIntegrations.filter(integration => !profile.copyOnlyRoots.some(mapping => mapping.dst === integration.path)) };
}

export function prepareQualifiedNativeDocument({ declaration, profile, path, text }: { readonly declaration: DeliveryDeclaration; readonly profile: QualifiedHarnessProfile; readonly path: string; readonly text: string }): string {
  qualifyDeliveryDeclaration(declaration, profile);
  if (!profile.nativeTextSources.some(source => path === `harness/${profile.harness}/${source}`)) return text;
  let prepared = text;
  for (const replacement of declaration.nativeReplacements ?? []) {
    if (prepared.split(replacement.from).length !== 2) throw new Error("qualified native replacement requires exactly one occurrence in its owned document");
    prepared = prepared.replaceAll(replacement.from, replacement.to);
  }
  return prepared;
}
