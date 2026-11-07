import type { AgentContext } from "./agent-definition.ts";
import type { Tier } from "./model.ts";
import type { SourceContentDigest, SourceOrigin } from "./source-origin.ts";

export type PreparedCoreAgentPolicy = {
  readonly tierCap: Tier;
  readonly models: AgentContext["models"];
  readonly inputs: readonly SourceContentDigest[];
  readonly origins: readonly SourceOrigin[];
};
