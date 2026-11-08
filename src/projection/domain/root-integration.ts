import type { ContentHash, RelativePath } from "../../kernel/values.ts";

export type Sharing = "exclusive" | "union" | "identical";

export type LegacySignatures = {
  readonly wholeFileHashes: readonly ContentHash[];
  readonly jsonEntryHashes: Readonly<Record<string, readonly ContentHash[]>>;
};

type IntegrationBase = {
  readonly path: RelativePath;
  readonly optional: boolean;
  readonly legacy: LegacySignatures;
};

export type RootIntegration =
  | (IntegrationBase & {
      readonly policy: "managed-block";
      readonly marker: string;
      readonly sharing: Sharing;
    })
  | (IntegrationBase & { readonly policy: "whole-file"; readonly sharing: Sharing })
  | (IntegrationBase & { readonly policy: "json-map"; readonly key: string })
  | (IntegrationBase & { readonly policy: "json-array"; readonly key: string })
  | (IntegrationBase & { readonly policy: "jsonc-settings" })
  | (IntegrationBase & { readonly policy: "json-entries" });

export type RootIntegrationPolicy = RootIntegration["policy"];
