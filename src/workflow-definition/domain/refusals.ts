import type { RelativePath } from "../../kernel/values.ts";
import type { PluginId, ScopeName, StageSlug } from "./identities.ts";

export type DefinitionConcept = "stage" | "scope" | "agent" | "artifact" | "sensor" | "plugin";

export type MethodRefusal =
  | {
      readonly kind: "invalid-file";
      readonly source: RelativePath;
      readonly issues: readonly string[];
    }
  | {
      readonly kind: "reserved-key";
      readonly source: RelativePath;
      readonly key: string;
      readonly reservedFor: string;
    }
  | {
      readonly kind: "slug-differs-from-file";
      readonly source: RelativePath;
      readonly slug: string;
    }
  | {
      readonly kind: "duplicate";
      readonly concept: DefinitionConcept;
      readonly name: string;
      readonly sources: readonly [RelativePath, RelativePath];
    }
  | {
      readonly kind: "unknown-reference";
      readonly source: RelativePath;
      readonly concept: DefinitionConcept;
      readonly name: string;
    }
  | {
      readonly kind: "core-namespace-claimed";
      readonly source: RelativePath;
      readonly plugin: string;
    }
  | { readonly kind: "core-agent-without-tier"; readonly source: RelativePath }
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
