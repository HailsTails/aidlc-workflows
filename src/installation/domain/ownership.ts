import type { ContentHash, RelativePath } from "../../kernel/values.ts";
import type { VersionStamp } from "../../packaging/domain/payload.ts";

export type InstalledFile = {
  readonly path: RelativePath;
  readonly writtenHash: ContentHash;
};

export type EntryHashes = Readonly<Record<string, ContentHash>>;

export type RootContribution =
  | {
      readonly policy: "managed-block";
      readonly path: RelativePath;
      readonly marker: string;
      readonly blockHash: ContentHash;
    }
  | { readonly policy: "whole-file"; readonly path: RelativePath; readonly fileHash: ContentHash }
  | {
      readonly policy: "json-map" | "json-array";
      readonly path: RelativePath;
      readonly key: string;
      readonly entries: EntryHashes;
    }
  | {
      readonly policy: "jsonc-settings";
      readonly path: RelativePath;
      readonly entries: EntryHashes;
      readonly createdFile: boolean;
    }
  | {
      readonly policy: "json-entries";
      readonly path: RelativePath;
      readonly entries: EntryHashes;
      readonly createdFile: boolean;
    };

export type McpChoice = "defaults" | "none";

export type OwnershipRecord = {
  readonly stamp: VersionStamp;
  readonly mcp: McpChoice;
  readonly files: readonly InstalledFile[];
  readonly rootContributions: readonly RootContribution[];
};
