import type { HostIdentity } from "../../kernel/host.ts";
import { refused } from "../../kernel/result.ts";
import type { HostData } from "../../projection/domain/host-surface.ts";
import type { BuildHostPayload, BuildPackaging, ContentHasher, ReadHostDistribution } from "./ports.ts";

export const createBuildHostPayload = (ports: {
  readonly members: readonly { readonly host: HostIdentity; readonly data: () => HostData }[];
  readonly distribution: ReadHostDistribution;
  readonly packaging: Pick<BuildPackaging, "packageHost">;
  readonly hasher: ContentHasher;
}): BuildHostPayload => async (request) => {
  const projected = await request.project();
  if (!projected.ok) return projected;
  const member = ports.members.find((candidate) => candidate.host.distribution === request.host.distribution);
  const distribution = ports.distribution({ host: request.host });
  if (!member) return refused([{ kind: "unknown-harness", harness: request.host.distribution }]);
  if (!distribution.ok) return distribution;
  const hostData = member.data();
  const completed = await request.enrich(projected.value);
  if (!completed.ok) return completed;
  return ports.packaging.packageHost({ hasher: ports.hasher, distribution: distribution.value, hostData,
    projection: completed.value, channel: request.channel, copy: request.copy });
};
