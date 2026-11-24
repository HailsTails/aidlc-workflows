import type { HostIdentity } from "../../kernel/host.ts";
import { refused, type Result } from "../../kernel/result.ts";
import type { KernelRefusal } from "../../kernel/values.ts";
import type { HostDistribution } from "../domain/payload.ts";
import type { ReadHostDistribution } from "./ports.ts";

export const createHostDistributionReading = (ports: {
  readonly members: readonly { readonly host: HostIdentity;
    readonly read: () => Result<HostDistribution, KernelRefusal> }[];
}): ReadHostDistribution => ({ host }) => {
  const member = ports.members.find((candidate) => candidate.host.distribution === host.distribution
    && candidate.host.directory === host.directory);
  if (!member) return refused([{ kind: "unknown-harness", harness: host.distribution }]);
  const distribution = member.read();
  return distribution.ok ? distribution : refused([distribution.refusal]);
};
