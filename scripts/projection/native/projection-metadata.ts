import type { HarnessManifest, RootIntegration } from "../../manifest-types.ts";
import { harnessChoiceTextIsPlain, sha256Bytes, shipsRootBlock as nativeShipsRootBlock } from "../../../core/tools/aidlc-distribution.ts";
import { encodeRootIntegration as nativeEncodeRootIntegration } from "../../../core/tools/aidlc-root-integration-codec.ts";
import { VERSION_ID } from "../../../core/tools/aidlc-channel.ts";

export type ProjectedRootFile = { readonly path: string; readonly fileName: string; readonly bytes: Uint8Array; readonly sha256: string; readonly legacySignatureSha256?: string };
export type ProjectionMetadataArtifact = { readonly file: string; readonly bytes: Uint8Array };
export type ProjectionRootIntegrationWire = RootIntegration & { readonly extendedPolicy?: string };
export type ProjectionMetadataRules = {
  readonly choiceText: (input: { readonly declaration: HarnessManifest }) => "plain" | "invalid";
  readonly shipsRootBlock: (input: { readonly integration: RootIntegration }) => "shipped" | "not-shipped";
  readonly encodeRootIntegration: (input: { readonly integration: RootIntegration }) => ProjectionRootIntegrationWire;
  readonly samePath?: (input: { readonly left: string; readonly right: string }) => boolean;
};
export const createProjectionMetadataRules = (): ProjectionMetadataRules => ({
  choiceText: ({ declaration }) => harnessChoiceTextIsPlain(declaration) ? "plain" : "invalid",
  shipsRootBlock: ({ integration }) => nativeShipsRootBlock(integration) ? "shipped" : "not-shipped",
  encodeRootIntegration: ({ integration }) => nativeEncodeRootIntegration({ integration }),
});
export type ProjectionMetadataRequest = { readonly declaration: HarnessManifest; readonly files: readonly string[]; readonly directories: readonly string[]; readonly rootFiles: readonly ProjectedRootFile[]; readonly observedRootPaths?: readonly string[]; readonly buildVersion: string; readonly rules?: ProjectionMetadataRules };
export type ProjectionMetadataRefusal = { readonly kind: "refused"; readonly message: string };
export type ProjectionMetadataPreparation = { readonly kind: "prepared"; readonly artifacts: readonly ProjectionMetadataArtifact[] } | ProjectionMetadataRefusal;
export type ProjectionMetadataPlan = { readonly kind: "planned"; readonly managedDirectories: readonly string[]; readonly rootPathsToRead: readonly string[] } | ProjectionMetadataRefusal;
type PreparedRootIntegrations = { readonly kind: "prepared"; readonly integrations: readonly RootIntegration[]; readonly artifacts: readonly ProjectionMetadataArtifact[] } | ProjectionMetadataRefusal;
type ProjectionMetadataAssembly = { readonly request: ProjectionMetadataRequest; readonly inventory: Extract<ProjectionMetadataPlan, { readonly kind: "planned" }>; readonly roots: Extract<PreparedRootIntegrations, { readonly kind: "prepared" }>; readonly rules: ProjectionMetadataRules };

function refuse({ declaration, message }: { readonly declaration: HarnessManifest; readonly message: string }): ProjectionMetadataRefusal {
  return { kind: "refused", message: `[${declaration.name}] ${message}` };
}

function onlyRootIntegrations({ directory, files, rootPaths }: { readonly directory: string; readonly files: readonly string[]; readonly rootPaths: ReadonlySet<string> }) {
  const children = files.filter((file) => file.startsWith(`${directory}/`));
  return children.length > 0 && children.every((file) => rootPaths.has(file));
}

function managedProjectionDirectories({ files, directories, rootPaths }: { readonly files: readonly string[]; readonly directories: readonly string[]; readonly rootPaths: ReadonlySet<string> }): readonly string[] {
  return directories.filter((directory) => !directory.includes("/") && !rootPaths.has(directory) && !onlyRootIntegrations({ directory, files, rootPaths })).sort();
}

export function planProjectionMetadata({ declaration, files, directories, observedRootPaths, rules = createProjectionMetadataRules() }: Pick<ProjectionMetadataRequest, "declaration" | "files" | "directories" | "observedRootPaths" | "rules">): ProjectionMetadataPlan {
  if (rules.choiceText({ declaration }) === "invalid") return refuse({ declaration, message: "choiceName or choiceNote is not text the harness lists can show" });
  const rootPaths = new Set(declaration.rootIntegrations.map((integration) => integration.path));
  if (rootPaths.size !== declaration.rootIntegrations.length) return refuse({ declaration, message: "duplicate root integration path" });
  // Filesystem adapters can observe a declared alias without putting that alias
  // into the actual tree inventory used for ownership classification.
  const projected = observedRootPaths ?? [...files, ...directories];
  const missing = declaration.rootIntegrations.find((integration) => !projected.includes(integration.path));
  if (missing !== undefined) return refuse({ declaration, message: `root integration is not projected: ${missing.path}` });
  const managedDirectories = managedProjectionDirectories({ files, directories, rootPaths });
  const allowed = new Set([...managedDirectories, ...declaration.rootIntegrations.map((integration) => integration.path.split("/")[0])]);
  const entries = Array.from(new Set([...files, ...directories].map((path) => path.split("/")[0])));
  const unclassified = entries.filter((entry) => !allowed.has(entry)).sort();
  if (unclassified.length > 0) return refuse({ declaration, message: `unclassified projection entries: ${unclassified.join(", ")}` });
  return { kind: "planned", managedDirectories, rootPathsToRead: declaration.rootIntegrations.filter((integration) => rules.shipsRootBlock({ integration }) === "shipped").map((integration) => integration.path) };
}

function rootBlockName({ integration, rootFile }: { readonly integration: RootIntegration; readonly rootFile: ProjectedRootFile }): string {
  return integration.policy === "managed-block" ? integration.marker || rootFile.fileName : rootFile.fileName;
}

function rootIntegrationWithSignature({ integration, rootFile }: { readonly integration: RootIntegration; readonly rootFile: ProjectedRootFile }): RootIntegration {
  if (integration.policy !== "managed-block") return integration;
  return { ...integration, legacySignatures: { ...integration.legacySignatures, wholeFileHashes: [...new Set([...(integration.legacySignatures?.wholeFileHashes ?? []), rootFile.legacySignatureSha256 ?? rootFile.sha256])] } };
}

function prepareRootIntegrations({ declaration, rootFiles, rules }: Pick<ProjectionMetadataRequest, "declaration" | "rootFiles"> & { readonly rules: ProjectionMetadataRules }): PreparedRootIntegrations {
  const missing = declaration.rootIntegrations.find((integration) => rules.shipsRootBlock({ integration }) === "shipped" && !rootFiles.some((file) => file.path === integration.path));
  if (missing !== undefined) return refuse({ declaration, message: `root integration bytes unavailable: ${missing.path}` });
  if (new Set(rootFiles.map((file) => file.path)).size !== rootFiles.length) return refuse({ declaration, message: "duplicate projected root file bytes" });
  if (rootFiles.some(file => file.legacySignatureSha256 !== undefined && !/^sha256:[a-f0-9]{64}$/.test(file.legacySignatureSha256))) return refuse({ declaration, message: "root compatibility signature requires a SHA-256 digest" });
  const prepared: { integration: RootIntegration; artifacts: ProjectionMetadataArtifact[] }[] = [];
  for (const integration of declaration.rootIntegrations) {
    const observed = rootFiles.find((file) => file.path === integration.path);
    if (rules.shipsRootBlock({ integration }) === "not-shipped" || observed === undefined) {
      prepared.push({ integration, artifacts: [] });
      continue;
    }
    // A later root can read a block written by an earlier declaration. Model
    // those ordered writes here, without publishing a partly prepared result.
    const prior = prepared.flatMap(entry => entry.artifacts).findLast(artifact => rules.samePath?.({ left: artifact.file, right: observed.path }) ?? artifact.file === observed.path);
    const rootFile = prior === undefined ? observed : { path: observed.path, fileName: observed.fileName, bytes: prior.bytes, sha256: sha256Bytes(Buffer.from(prior.bytes)) };
    prepared.push({ integration: rootIntegrationWithSignature({ integration, rootFile }), artifacts: [{ file: declaration.harnessDir + "/tools/data/root-blocks/" + rootBlockName({ integration, rootFile }), bytes: Uint8Array.from(rootFile.bytes) }] });
  }
  return { kind: "prepared", integrations: prepared.map((entry) => entry.integration), artifacts: prepared.flatMap((entry) => entry.artifacts) };
}

function onboardingDescriptor({ declaration }: { readonly declaration: HarnessManifest }): { readonly onboarding?: string } {
  if (declaration.onboarding?.harnessDst) return { onboarding: `${declaration.harnessDir}/${declaration.onboarding.harnessDst}` };
  if (declaration.onboarding && !declaration.onboarding.projectRoot) return { onboarding: `${declaration.harnessDir}/${declaration.onboarding.dst}` };
  return {};
}

function metadataJson({ file, content }: { readonly file: string; readonly content: unknown }): ProjectionMetadataArtifact {
  return { file, bytes: new TextEncoder().encode(`${JSON.stringify(content, null, 2)}\n`) };
}

function projectionDescriptor({ request, inventory, roots, rules }: ProjectionMetadataAssembly) {
  const declaration = request.declaration;
  return {
    schemaVersion: 1,
    distribution: declaration.name,
    productName: declaration.productName,
    ...(declaration.choiceName ? { choiceName: declaration.choiceName } : {}),
    ...(declaration.choiceNote ? { choiceNote: declaration.choiceNote } : {}),
    configNextStep: declaration.configNextStep,
    ...(declaration.firstRunSteps ? { firstRunSteps: declaration.firstRunSteps } : {}),
    ...(declaration.editorTerminalApp ? { editorTerminalApp: declaration.editorTerminalApp } : {}),
    harnessDir: declaration.harnessDir,
    ...onboardingDescriptor({ declaration }),
    managedDirectories: inventory.managedDirectories,
    rootIntegrations: roots.integrations.map((integration) => rules.encodeRootIntegration({ integration })),
  };
}

function projectionStamp({ request }: { readonly request: ProjectionMetadataRequest }) {
  return { schemaVersion: 1, frameworkVersion: request.buildVersion, distribution: request.declaration.name, harnessDir: request.declaration.harnessDir };
}

function preparedMetadata(input: ProjectionMetadataAssembly): ProjectionMetadataPreparation {
  return { kind: "prepared", artifacts: [
    ...input.roots.artifacts,
    metadataJson({ file: `${input.request.declaration.harnessDir}/tools/data/aidlc-projection.json`, content: projectionDescriptor(input) }),
    metadataJson({ file: `${input.request.declaration.harnessDir}/tools/data/aidlc-stamp.json`, content: projectionStamp(input) }),
  ] };
}

function admitProjectionBuildVersion({ request }: { readonly request: ProjectionMetadataRequest }): { readonly kind: "admitted" } | ProjectionMetadataRefusal {
  if (!VERSION_ID.test(request.buildVersion)) return refuse({ declaration: request.declaration, message: "invalid projection build version" });
  return { kind: "admitted" };
}

export function prepareProjectionMetadata(request: ProjectionMetadataRequest): ProjectionMetadataPreparation {
  const version = admitProjectionBuildVersion({ request });
  if (version.kind === "refused") return version;
  const rules = request.rules ?? createProjectionMetadataRules();
  const inventory = planProjectionMetadata({ ...request, rules });
  if (inventory.kind === "refused") return inventory;
  const roots = prepareRootIntegrations({ ...request, rules });
  if (roots.kind === "refused") return roots;
  return preparedMetadata({ request, inventory, roots, rules });
}
