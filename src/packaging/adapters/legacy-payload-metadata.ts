import { managedPayloadDirectories, nativeCopyHistory } from "../domain/native-copy-history.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath, type ProjectPath, type KernelRefusal } from "../../kernel/values.ts";
import type { ContentHasher, PayloadMetadata, PayloadMetadataRequest } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { HostDistribution, Payload, PayloadFile } from "../domain/payload.ts";
import type { RootIntegration, Sharing } from "../domain/root-integration.ts";
import { copyStartsWithout, harnessChoiceTextIsPlain, writtenRootIntegration } from "./legacy-distribution.ts";

export type LegacyPayloadRootIntegration = {
  readonly path: ProjectPath;
  readonly policy: RootIntegration["policy"];
  readonly extendedPolicy?: string;
  readonly marker?: string;
  readonly shared?: Exclude<Sharing, "exclusive">;
  readonly jsonKey?: string;
  readonly optional?: true;
  readonly legacySignatures?: {
    readonly wholeFileHashes?: readonly string[];
    readonly jsonEntryHashes?: Readonly<Record<string, readonly string[]>>;
  };
};

export type LegacyPayloadRootParts = {
  readonly integrations: readonly LegacyPayloadRootIntegration[];
  readonly files: readonly PayloadFile[];
  readonly failures: readonly (PackagingRefusal | KernelRefusal)[];
};

export type LegacyPayloadDescriptorFields = {
  readonly schemaVersion: 1;
  readonly distribution: string;
  readonly productName: string;
  readonly choiceName?: string;
  readonly choiceNote?: string;
  readonly configNextStep: string;
  readonly firstRunSteps?: HostDistribution["listing"]["firstRunSteps"];
  readonly editorTerminalApp?: string;
  readonly cliFirst?: HostDistribution["listing"]["cliFirst"];
  readonly harnessDir: string;
  readonly onboarding?: ProjectPath;
  readonly managedDirectories: readonly string[];
  readonly rootIntegrations: readonly LegacyPayloadRootIntegration[];
};

type MetadataReading = Result<readonly PayloadFile[], readonly (PackagingRefusal | KernelRefusal)[]>;

const legacyIntegration = (distribution: HostDistribution, integration: RootIntegration) => {
  const prior = distribution.priorIntegrations.find((candidate) => candidate.integration === integration.path);
  const legacySignatures = prior ? {
    ...(prior.wholeFileHashes.length ? { wholeFileHashes: [...prior.wholeFileHashes] } : {}),
    ...(Object.keys(prior.entryHashes).length ? { jsonEntryHashes: prior.entryHashes } : {}),
  } : undefined;
  return { path: integration.path, policy: integration.policy,
    ...("marker" in integration ? { marker: integration.marker } : {}),
    ...("sharing" in integration && integration.sharing !== "exclusive" ? { shared: integration.sharing } : {}),
    ...("key" in integration ? { jsonKey: integration.key } : {}),
    ...(integration.presence === "optional" ? { optional: true as const } : {}),
    ...(legacySignatures ? { legacySignatures } : {}),
  };
};

const metadataFile = (request: {
  readonly path: string; readonly content: FileContent;
  readonly origin: "distribution-descriptor" | "version-stamp";
}, hasher: ContentHasher): MetadataReading => {
  const path = projectPath(request.path);
  if (!path.ok) return refused([{ kind: "entry-not-bundled", entry: request.path,
    reason: "The metadata path is not project-relative." }]);
  const hash = hasher.hash(request.content);
  return hash.ok ? accepted([{ path: path.value, content: request.content, mode: "regular",
    origin: { kind: request.origin }, hash: hash.value }]) : refused([hash.refusal]);
};

const metadataRootIntegrations = (request: PayloadMetadataRequest, releasePayload: Payload): readonly RootIntegration[] =>
  releasePayload.channel === "native" ? releasePayload.descriptor.layout.rootIntegrations
    : request.distribution.layout.rootIntegrations;

const rootParts = (releasePayload: Payload, request: PayloadMetadataRequest): LegacyPayloadRootParts => {
  if (releasePayload.channel === "native" && request.copy === null) return {
    integrations: metadataRootIntegrations(request, releasePayload).map((root) =>
      writtenRootIntegration(legacyIntegration(request.distribution, root))), files: [], failures: [],
  };
  const readings = metadataRootIntegrations(request, releasePayload).map((root) => {
    const integration = legacyIntegration(request.distribution, root);
    const file = releasePayload.files.find((candidate) => candidate.path === root.path);
    if (!file) return { integration, files: refused<readonly (PackagingRefusal | KernelRefusal)[]>([
      { kind: "root-integration-missing", path: root.path }]) };
    const basename = root.path.split("/").at(-1);
    const part = copyStartsWithout(integration) || root.policy === "json-entries" ? basename
      : root.policy === "managed-block" ? root.marker || basename : undefined;
    const files = part === undefined ? accepted([]) : metadataFile({
      path: `${releasePayload.descriptor.host.directory}/tools/data/root-blocks/${part}`,
      content: file.content, origin: "distribution-descriptor" }, request.hasher);
    if (root.policy !== "managed-block" || copyStartsWithout(integration)) return { integration, files };
    return { integration: { ...integration, legacySignatures: { ...integration.legacySignatures,
      wholeFileHashes: [...new Set([...(integration.legacySignatures?.wholeFileHashes ?? []),
        file.hash])] } }, files };
  });
  return { integrations: readings.map((reading) => writtenRootIntegration(reading.integration)),
    files: readings.flatMap((reading) => reading.files.ok ? reading.files.value : []),
    failures: readings.flatMap((reading) => reading.files.ok ? [] : reading.files.refusal) };
};

const descriptorFields = ({ inputs, releasePayload, parts }: {
  readonly inputs: PayloadMetadataRequest; readonly releasePayload: Payload;
  readonly parts: LegacyPayloadRootParts;
}): LegacyPayloadDescriptorFields => {
  const host = releasePayload.descriptor.host;
  const listing = inputs.distribution.listing;
  return {
    schemaVersion: 1, distribution: host.distribution, productName: inputs.hostData.productName,
    ...(listing.choiceName ? { choiceName: listing.choiceName } : {}),
    ...(listing.choiceNote ? { choiceNote: listing.choiceNote } : {}), configNextStep: inputs.hostData.configNextStep,
    ...(listing.firstRunSteps ? { firstRunSteps: listing.firstRunSteps } : {}),
    ...(listing.editorTerminalApp ? { editorTerminalApp: listing.editorTerminalApp } : {}),
    ...(listing.cliFirst ? { cliFirst: listing.cliFirst } : {}), harnessDir: host.directory,
    ...(inputs.onboarding?.startsWith(`${host.directory}/`) ? { onboarding: inputs.onboarding } : {}),
    managedDirectories: managedPayloadDirectories(releasePayload), rootIntegrations: parts.integrations,
  };
};

export type LegacyPayloadDescriptor = {
  readonly fields: LegacyPayloadDescriptorFields;
  readonly rootBlocks: readonly PayloadFile[];
};

const descriptorContent = (request: PayloadMetadataRequest, releasePayload: Payload):
  Result<LegacyPayloadDescriptor, readonly (PackagingRefusal | KernelRefusal)[]> => {
  const parts = rootParts(releasePayload, request);
  return parts.failures.length > 0 ? refused(parts.failures)
    : accepted({ rootBlocks: parts.files, fields: descriptorFields({ inputs: request, releasePayload, parts }) });
};

const formattedMetadata = (request: {
  readonly inputs: PayloadMetadataRequest; readonly releasePayload: Payload;
  readonly descriptor: LegacyPayloadDescriptor;
}): MetadataReading => {
  const host = request.releasePayload.descriptor.host;
  const baseDescriptor = metadataFile({ path: `${host.directory}/tools/data/aidlc-projection.json`,
    content: { kind: "text", text: `${JSON.stringify(request.descriptor.fields, null, 2)}\n` },
    origin: "distribution-descriptor" }, request.inputs.hasher);
  const stamp = metadataFile({ path: `${host.directory}/tools/data/aidlc-stamp.json`, content: { kind: "text", text:
    `${JSON.stringify({ schemaVersion: 1, frameworkVersion: request.releasePayload.version,
      distribution: host.distribution, harnessDir: host.directory }, null, 2)}\n` }, origin: "version-stamp" }, request.inputs.hasher);
  const failures = [baseDescriptor, stamp].flatMap((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const files = [...request.descriptor.rootBlocks, ...[baseDescriptor, stamp].flatMap((reading) => reading.ok ? reading.value : [])];
  if (request.inputs.copy === null) return accepted(files);
  const history = nativeCopyHistory({ native: { ...request.releasePayload, files: [...request.releasePayload.files, ...files] },
    copy: request.inputs.copy });
  const descriptor = metadataFile({ path: `${host.directory}/tools/data/aidlc-projection.json`, content: { kind: "text", text:
    `${JSON.stringify({ ...request.descriptor.fields, retiredCopyFileHashes: history.retiredCopyFileHashes,
      ...(Object.keys(history.legacyManagedFileHashes).length > 0 ? { legacyManagedFileHashes: history.legacyManagedFileHashes } : {}),
    }, null, 2)}\n` }, origin: "distribution-descriptor" }, request.inputs.hasher);
  return descriptor.ok ? accepted([...request.descriptor.rootBlocks, ...descriptor.value,
    ...(stamp.ok ? stamp.value : [])]) : descriptor;
};
export const createLegacyPayloadMetadata = (request: PayloadMetadataRequest): PayloadMetadata => ({ files: (releasePayload) => {
  const host = releasePayload.descriptor.host;
  if (!harnessChoiceTextIsPlain(request.distribution.listing)) return refused([
    { kind: "listing-text-not-plain", distribution: host.distribution }]);
  const paths = new Set<ProjectPath>();
  const duplicates = metadataRootIntegrations(request, releasePayload).flatMap((root): readonly PackagingRefusal[] => {
    if (paths.has(root.path)) return [{ kind: "root-integration-duplicate", path: root.path }];
    paths.add(root.path);
    return [];
  });
  if (duplicates.length > 0) return refused(duplicates);
  const descriptor = descriptorContent(request, releasePayload);
  if (!descriptor.ok) return descriptor;
  return formattedMetadata({ inputs: request, releasePayload, descriptor: descriptor.value });
} });
