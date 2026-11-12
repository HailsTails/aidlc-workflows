import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath, type ProjectPath, type KernelRefusal } from "../../kernel/values.ts";
import type { HostData } from "../../projection/domain/host-surface.ts";
import type { PayloadMetadata } from "../application/package-payload.ts";
import type { ContentHasher } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { HostDistribution, Payload, PayloadFile } from "../domain/payload.ts";
import type { RootIntegration } from "../domain/root-integration.ts";
import { copyStartsWithout, harnessChoiceTextIsPlain, writtenRootIntegration } from "./legacy-distribution.ts";

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

const rootParts = (releasePayload: Payload, request: PayloadMetadataInputs) => {
  const readings = request.distribution.layout.rootIntegrations.map((root) => {
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

const managedDirectories = (releasePayload: Payload): readonly string[] => {
  const roots = new Set(releasePayload.descriptor.layout.rootIntegrations.map((root) => root.path));
  const directories = [...new Set(releasePayload.files.filter((file) => file.path.includes("/"))
    .map((file) => file.path.split("/")[0] ?? ""))];
  return directories.filter((directory) => !releasePayload.files.filter((file) => file.path.startsWith(`${directory}/`))
    .every((file) => roots.has(file.path))).sort();
};

type PayloadMetadataInputs = {
  readonly hasher: ContentHasher;
  readonly distribution: HostDistribution;
  readonly hostData: HostData;
  readonly onboarding?: ProjectPath;
};

export type LegacyPayloadDescriptor = {
  readonly content: FileContent;
  readonly rootBlocks: readonly PayloadFile[];
};

const descriptorContent = (request: PayloadMetadataInputs, releasePayload: Payload):
  Result<LegacyPayloadDescriptor, readonly (PackagingRefusal | KernelRefusal)[]> => {
  const parts = rootParts(releasePayload, request);
  if (parts.failures.length > 0) return refused(parts.failures);
  const host = releasePayload.descriptor.host;
  const listing = request.distribution.listing;
  return accepted({ rootBlocks: parts.files, content: { kind: "text", text: `${JSON.stringify({
    schemaVersion: 1, distribution: host.distribution, productName: request.hostData.productName,
    ...(listing.choiceName ? { choiceName: listing.choiceName } : {}),
    ...(listing.choiceNote ? { choiceNote: listing.choiceNote } : {}), configNextStep: request.hostData.configNextStep,
    ...(listing.firstRunSteps ? { firstRunSteps: listing.firstRunSteps } : {}),
    ...(listing.editorTerminalApp ? { editorTerminalApp: listing.editorTerminalApp } : {}),
    ...(listing.cliFirst ? { cliFirst: listing.cliFirst } : {}), harnessDir: host.directory,
    ...(request.onboarding?.startsWith(`${host.directory}/`) ? { onboarding: request.onboarding } : {}),
    managedDirectories: managedDirectories(releasePayload), rootIntegrations: parts.integrations,
  }, null, 2)}\n` } });
};

export const createLegacyPayloadMetadata = (request: PayloadMetadataInputs): PayloadMetadata => ({ files: (releasePayload) => {
  const host = releasePayload.descriptor.host;
  if (!harnessChoiceTextIsPlain(request.distribution.listing)) return refused([
    { kind: "listing-text-not-plain", distribution: host.distribution }]);
  const paths = new Set<ProjectPath>();
  const duplicates = request.distribution.layout.rootIntegrations.flatMap((root): readonly PackagingRefusal[] => {
    if (paths.has(root.path)) return [{ kind: "root-integration-duplicate", path: root.path }];
    paths.add(root.path);
    return [];
  });
  if (duplicates.length > 0) return refused(duplicates);
  const descriptor = descriptorContent(request, releasePayload);
  if (!descriptor.ok) return descriptor;
  const stamp = { schemaVersion: 1, frameworkVersion: releasePayload.version,
    distribution: host.distribution, harnessDir: host.directory };
  const metadataFiles = [metadataFile({ path: `${host.directory}/tools/data/aidlc-projection.json`,
    content: descriptor.value.content, origin: "distribution-descriptor" }, request.hasher),
  metadataFile({ path: `${host.directory}/tools/data/aidlc-stamp.json`,
    content: { kind: "text", text: `${JSON.stringify(stamp, null, 2)}\n` }, origin: "version-stamp" }, request.hasher)];
  const failures = metadataFiles.flatMap((file) => file.ok ? [] : file.refusal);
  return failures.length > 0 ? refused(failures)
    : accepted([...descriptor.value.rootBlocks, ...metadataFiles.flatMap((file) => file.ok ? file.value : [])]);
} });
