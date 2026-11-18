import type { FileContent } from "../../kernel/file-content.ts";
import type { DistributionId, ProjectPath } from "../../kernel/values.ts";
import type { PackagingRefusal } from "./artifact.ts";
import type { Payload } from "./payload.ts";
import type { RootIntegration } from "./root-integration.ts";

const bytesOf = (content: FileContent): Uint8Array =>
  content.kind === "bytes" ? content.bytes : new TextEncoder().encode(content.text);

const compareContent = (first: FileContent, second: FileContent): "equal" | "different" => {
  const left = bytesOf(first);
  const right = bytesOf(second);
  return left.length === right.length && left.every((byte, index) => byte === right[index]) ? "equal" : "different";
};

export const identicalRootConflicts = ({ payloads }: {
  readonly payloads: readonly Payload[];
}): readonly PackagingRefusal[] => {
  const owners = new Map<ProjectPath, { readonly distribution: DistributionId; readonly content: FileContent }>();
  return payloads.flatMap((hostPayload) => hostPayload.descriptor.layout.rootIntegrations
    .flatMap((integration: RootIntegration): readonly PackagingRefusal[] => {
      if (!("sharing" in integration) || integration.sharing !== "identical") return [];
      const file = hostPayload.files.find((candidate) => candidate.path === integration.path);
      if (!file) return [{ kind: "root-integration-missing", path: integration.path }];
      const previous = owners.get(integration.path);
      if (!previous) {
        owners.set(integration.path, { distribution: hostPayload.descriptor.host.distribution, content: file.content });
        return [];
      }
      return compareContent(previous.content, file.content) === "equal" ? [] : [{
        kind: "shared-root-integration-differs", path: integration.path,
        distributions: [previous.distribution, hostPayload.descriptor.host.distribution],
      }];
    }));
};
