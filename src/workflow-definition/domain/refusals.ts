import type { Owner, PluginId, ScopeName, StageSlug } from "./identities.ts";
import type { MethodSourceLocation } from "./method-source.ts";

export type DefinitionConcept =
  | "stage"
  | "scope"
  | "agent"
  | "artifact"
  | "sensor"
  | "plugin"
  | "rule"
  | "hook";

export type MethodFileLocation =
  | ({ readonly kind: "method-source" } & MethodSourceLocation)
  | { readonly kind: "plugin-manifest"; readonly plugin: string }
  | { readonly kind: "stage-pins" };

export type MethodRefusal =
  | {
      readonly kind: "invalid-file";
      readonly location: MethodFileLocation;
      readonly issues: readonly string[];
    }
  | {
      readonly kind: "reserved-key";
      readonly location: MethodFileLocation;
      readonly key: string;
      readonly reservedFor: string;
    }
  | {
      readonly kind: "slug-differs-from-file";
      readonly source: MethodSourceLocation;
      readonly slug: string;
    }
  | {
      readonly kind: "duplicate";
      readonly concept: DefinitionConcept;
      readonly name: string;
      readonly sources: readonly [MethodSourceLocation, MethodSourceLocation];
    }
  | {
      readonly kind: "unknown-reference";
      readonly source: MethodSourceLocation;
      readonly concept: DefinitionConcept;
      readonly name: string;
    }
  | {
      readonly kind: "unattributed-membership";
      readonly scope: ScopeName;
      readonly stage: StageSlug;
      readonly declaredBy: Owner;
    }
  | {
      readonly kind: "core-namespace-claimed";
      readonly plugin: string;
    }
  | { readonly kind: "core-agent-without-tier"; readonly source: MethodSourceLocation }
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
