import type { FileContent } from "../../kernel/file-content.ts";
import { projectPath } from "../../kernel/values.ts";
import type { PayloadMetadata } from "../application/package-payload.ts";
import type { ContentHasher } from "../application/ports.ts";
import type { Payload, PayloadFile, PayloadFileOrigin } from "../domain/payload.ts";
import type { RootIntegration } from "../domain/root-integration.ts";
import { DistributionDescriptorFileSchema } from "./distribution-descriptor-file.ts";

const policyFields = (integration: RootIntegration): object => {
  if (integration.policy === "managed-block") return {
    marker: integration.marker,
    ...(integration.sharing === "exclusive" ? {} : { shared: integration.sharing }),
  };
  if (integration.policy === "whole-file") return integration.sharing === "exclusive"
    ? {} : { shared: integration.sharing };
  if (integration.policy === "json-map" || integration.policy === "json-array") {
    return { jsonKey: integration.key };
  }
  return {};
};

const integrationFile = (request: { readonly payload: Payload;
  readonly integration: RootIntegration }): object => {
  const { integration, payload: releasePayload } = request;
  const history = releasePayload.descriptor.history.priorIntegrations.find((prior) =>
    prior.integration === integration.path);
  return { path: integration.path, policy: integration.policy,
    ...(integration.presence === "optional" ? { optional: true } : {}),
    ...policyFields(integration),
    ...(history ? { legacySignatures: { wholeFileHashes: history.wholeFileHashes,
      jsonEntryHashes: history.entryHashes } } : {}),
  };
};

const metadataFile = (request: { readonly payload: Payload; readonly hasher: ContentHasher;
  readonly name: string; readonly value: unknown; readonly origin: PayloadFileOrigin }):
  PayloadFile => {
  const rawPath = `${request.payload.descriptor.host.directory}/tools/data/${request.name}`;
  const path = projectPath(rawPath);
  if (!path.ok) throw new Error(`Invalid generated metadata path: ${rawPath}`);
  const content: FileContent = { kind: "text",
    text: `${JSON.stringify(request.value, null, 2)}\n` };
  return { path: path.value, hash: request.hasher.hash(content), content, mode: "regular",
    origin: request.origin };
};

const descriptor = (releasePayload: Payload): unknown => DistributionDescriptorFileSchema.parse({
  schemaVersion: 2, frameworkVersion: releasePayload.version, layout: releasePayload.channel,
  distribution: releasePayload.descriptor.host.distribution, harnessDir: releasePayload.descriptor.host.directory,
  rootIntegrations: releasePayload.descriptor.layout.rootIntegrations.map((integration) =>
    integrationFile({ payload: releasePayload, integration })),
  managedDirectories: releasePayload.descriptor.layout.managedDirectories,
  retiredFiles: Object.fromEntries(releasePayload.descriptor.history.retiredFiles.map((file) =>
    [file.path, file.shippedHashes])),
});

export const createPayloadMetadata = (hasher: ContentHasher): PayloadMetadata => ({
  files: (releasePayload) => [
    metadataFile({ payload: releasePayload, hasher, name: "aidlc-version.json", origin: { kind: "version-stamp" },
      value: { schemaVersion: 1, frameworkVersion: releasePayload.version,
        distribution: releasePayload.descriptor.host.distribution,
        harnessDir: releasePayload.descriptor.host.directory } }),
    metadataFile({ payload: releasePayload, hasher, name: "aidlc-projection.json",
      origin: { kind: "distribution-descriptor" }, value: descriptor(releasePayload) }),
  ],
});
