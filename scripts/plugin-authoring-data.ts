import type { HarnessManifest } from "./manifest-types.ts";
import type { PluginTarget, PluginTargetTable } from "../core/tools/aidlc-plugin-emit.ts";

export type PluginAuthoringTemplate = { readonly file: string; readonly bytes: Uint8Array };
export type PluginAuthoringArtifact = { readonly file: string; readonly bytes: Uint8Array };
export type PluginAuthoringPreparation = { readonly kind: "prepared"; readonly artifacts: readonly PluginAuthoringArtifact[] } | { readonly kind: "refused"; readonly message: string };
export type PluginTargetDeclaration = { readonly name: string; readonly manifest: HarnessManifest };
export type PluginAuthoringRequest = { readonly targets: PluginTargetTable; readonly agentNames: readonly string[]; readonly stageNames: readonly string[]; readonly templates: readonly PluginAuthoringTemplate[] };

function topLevelRoots({ paths }: { readonly paths: readonly string[] }): readonly string[] {
  return paths.flatMap((path) => {
    const top = path.split(/[\\/]/).filter(Boolean)[0];
    return top ? [top] : [];
  });
}

function manifestInstallRoots({ manifest }: { readonly manifest: HarnessManifest }): string[] {
  const paths = [
    ...manifest.harnessFiles.filter((file) => file.projectRoot).map((file) => file.dst),
    ...(manifest.onboarding?.projectRoot ? [manifest.onboarding.dst] : []),
    ...(manifest.orchestratorSkillPath ? [manifest.orchestratorSkillPath] : []),
    ...(manifest.plugin?.installRoots ?? []),
  ];
  return [...new Set([manifest.harnessDir, "aidlc", ...topLevelRoots({ paths })])].sort();
}

function projectPluginTarget({ manifest }: { readonly manifest: HarnessManifest }): PluginTarget {
  const manifestDir = manifest.plugin?.manifestDir ?? `${manifest.harnessDir}-plugin`;
  return {
    harnessName: manifest.name,
    manifestDir,
    marketplaceDir: manifest.plugin?.marketplaceDir ?? manifestDir,
    hostCatalogue: manifest.plugin?.hostCatalogue ?? ["store", "cursor"].includes(manifest.plugin?.kind ?? "store"),
    harnessLeaf: manifest.harnessDir,
    kind: manifest.plugin?.kind ?? "store",
    installRoots: manifestInstallRoots({ manifest }),
  };
}

export function projectPluginTargets({ declarations }: { readonly declarations: readonly PluginTargetDeclaration[] }): PluginTargetTable {
  return Object.fromEntries(declarations.map(({ name, manifest }) => [name, projectPluginTarget({ manifest })]));
}

function templatePathStatus({ file }: { readonly file: string }): "safe" | "unsafe" {
  return file.length > 0 && !/[\\:\u0000-\u001f]/.test(file) && file.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..") ? "safe" : "unsafe";
}

function authoringContext({ agentNames, stageNames }: { readonly agentNames: readonly string[]; readonly stageNames: readonly string[] }): { readonly agents: readonly string[]; readonly stages: readonly string[] } {
  return { agents: agentNames.filter((name) => name.endsWith("-agent.md")).map((name) => name.slice(0, -3)).sort(), stages: stageNames.filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)).sort() };
}

function jsonArtifact({ file, content }: { readonly file: string; readonly content: unknown }): PluginAuthoringArtifact {
  return { file, bytes: new TextEncoder().encode(`${JSON.stringify(content, null, 2)}\n`) };
}

function admitTemplates({ templates }: { readonly templates: readonly PluginAuthoringTemplate[] }): { readonly kind: "admitted" } | Extract<PluginAuthoringPreparation, { readonly kind: "refused" }> {
  if (templates.some((template) => templatePathStatus({ file: template.file }) === "unsafe")) return { kind: "refused", message: "plugin authoring templates require safe relative file paths" };
  if (new Set(templates.map((template) => template.file)).size !== templates.length) return { kind: "refused", message: "plugin authoring template paths must be unique" };
  return { kind: "admitted" };
}

function preparedAuthoringArtifacts({ targets, agentNames, stageNames, templates }: PluginAuthoringRequest): PluginAuthoringPreparation {
  return { kind: "prepared", artifacts: [
    ...templates.map((template) => ({ file: `tools/data/plugin-hooks-template/${template.file}`, bytes: Uint8Array.from(template.bytes) })),
    jsonArtifact({ file: "tools/data/plugin-targets.json", content: targets }),
    jsonArtifact({ file: "tools/data/plugin-authoring-context.json", content: authoringContext({ agentNames, stageNames }) }),
  ] };
}

export function preparePluginAuthoringArtifacts(input: PluginAuthoringRequest): PluginAuthoringPreparation {
  const admission = admitTemplates(input);
  if (admission.kind === "refused") return admission;
  return preparedAuthoringArtifacts(input);
}
