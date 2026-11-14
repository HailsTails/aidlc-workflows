import type { ProjectPath } from "../../kernel/values.ts";

export type Sharing = "exclusive" | "union" | "identical";

type IntegrationBase = {
  readonly path: ProjectPath;
  readonly presence: "required" | "optional";
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
