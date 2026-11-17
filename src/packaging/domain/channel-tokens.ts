import type { DistributionChannel } from "../../projection/domain/projected-file.ts";
import type { ChannelTokens } from "../../projection/domain/template-token.ts";

export const channelTokens = (request: {
  readonly channel: DistributionChannel;
  readonly directory: string;
  readonly prefix: string;
  readonly namespace: string;
}) => ({
  ["INVOKE"]: request.channel === "copy" ? `bun ${request.directory}/tools/aidlc.ts` : "aidlc",
  ["TOOL_PREFIX"]: request.channel === "copy" ? `bun ${request.directory}/tools/` : `${request.prefix} `,
  ["TRUSTED_NAMESPACE"]: request.namespace,
} satisfies ChannelTokens);