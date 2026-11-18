import type { ContentHash, ProjectPath } from "../../kernel/values.ts";

export type RetiredFile = {
  readonly path: ProjectPath;
  readonly shippedHashes: readonly ContentHash[];
};

export type PriorIntegrationShapes = {
  readonly integration: ProjectPath;
  readonly wholeFileHashes: readonly ContentHash[];
  readonly entryHashes: Readonly<Record<string, readonly ContentHash[]>>;
};

export type ReleaseHistory = {
  readonly retiredFiles: readonly RetiredFile[];
  readonly priorIntegrations: readonly PriorIntegrationShapes[];
};
