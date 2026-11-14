import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  ProjectPath,
} from "../../kernel/values.ts";

export type InstalledFile = {
  readonly path: ProjectPath;
  readonly writtenHash: ContentHash;
};

export type EntryHashes = Readonly<Record<string, ContentHash>>;

export type WrittenShare =
  | { readonly kind: "block"; readonly marker: string; readonly hash: ContentHash }
  | { readonly kind: "file"; readonly hash: ContentHash }
  | {
      readonly kind: "entries";
      readonly key: string | null;
      readonly entries: EntryHashes;
      readonly addedKeys: readonly string[];
      readonly fileOrigin: "created-by-aidlc" | "already-present";
    };

export type RootContribution = {
  readonly integration: ProjectPath;
  readonly written: WrittenShare;
};

export type McpChoice = "defaults" | "none";

export type RecordCoverage = "shipped-files-only" | "may-include-project-files";

export type FileEntries = {
  readonly path: ProjectPath;
  readonly entries: EntryHashes;
};

export type OwnershipRecord = {
  readonly version: FrameworkVersion;
  readonly distribution: DistributionId;
  readonly mcp: McpChoice;
  readonly coverage: RecordCoverage;
  readonly files: readonly InstalledFile[];
  readonly fileEntries: readonly FileEntries[];
  readonly rootContributions: readonly RootContribution[];
  readonly statusLine: "kept-own" | "installed";
};
