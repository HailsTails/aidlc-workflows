import type { AuthoredAgent } from "./agent-definition.ts";
import type { SourceContentDigest } from "./source-origin.ts";
export type CoreAgentSources = { readonly agents: readonly AuthoredAgent[]; readonly inputs: readonly SourceContentDigest[] };
