import type { SourcePath } from "../../kernel/values.ts";
import type { PluginId, ScopeName, StageSlug } from "./identities.ts";

export type DefinitionConcept =
  | "stage"
  | "scope"
  | "agent"
  | "artifact"
  | "sensor"
  | "plugin"
  | "rule"
  | "hook";

export type MethodRefusal =
  | {
      readonly kind: "invalid-file";
      readonly source: SourcePath;
      readonly issues: readonly string[];
    }
  | {
      readonly kind: "reserved-key";
      readonly source: SourcePath;
      readonly key: string;
      readonly reservedFor: string;
    }
  | {
      readonly kind: "slug-differs-from-file";
      readonly source: SourcePath;
      readonly slug: string;
    }
  | {
      readonly kind: "duplicate";
      readonly concept: DefinitionConcept;
      readonly name: string;
      readonly sources: readonly [SourcePath, SourcePath];
    }
  | {
      readonly kind: "unknown-reference";
      readonly source: SourcePath;
      readonly concept: DefinitionConcept;
      readonly name: string;
    }
  | {
      readonly kind: "core-namespace-claimed";
      readonly source: SourcePath;
      readonly plugin: string;
    }
  | { readonly kind: "core-agent-without-tier"; readonly source: SourcePath }
  | {
      readonly kind: "requires-cycle";
      readonly stages: readonly StageSlug[];
    }
  | {
      readonly kind: "several-freeform-defaults";
      readonly scopes: readonly ScopeName[];
    }
  | {
      readonly kind: "missing-dependency";
      readonly plugin: PluginId;
      readonly needs: string;
    };
