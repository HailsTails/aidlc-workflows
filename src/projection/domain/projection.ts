import type { HostIdentity } from "../../kernel/host.ts";
import type { UnreadableTreeFile } from "../../kernel/file-system-port.ts";
import type { DistributionId, ProjectPath, SourcePath } from "../../kernel/values.ts";
import type { ProjectedFile, ProjectionOrigin, RenderedConcept } from "./projected-file.ts";
import type { PluginId } from "../../workflow-definition/domain/identities.ts";
import type { TemplateToken } from "./template-token.ts";

export type ProjectionFinding =
  | {
      readonly kind: "unresolved-token";
      readonly path: ProjectPath;
      readonly token: TemplateToken;
    }
  | {
      readonly kind: "concept-not-rendered";
      readonly concept: RenderedConcept;
      readonly name: string;
      readonly reason: string;
    };

export type ProjectionRefusal =
  | { readonly kind: "unknown-harness"; readonly harness: string }
  | {
      readonly kind: "path-collision";
      readonly path: ProjectPath;
      readonly origins: readonly [ProjectionOrigin, ProjectionOrigin];
    }
  | {
      readonly kind: "render-failed";
      readonly concept: RenderedConcept;
      readonly name: string;
      readonly reason: string;
    }
  | { readonly kind: "command-source-failed"; readonly reason: string }
  | {
      readonly kind: "host-source-unreadable";
      readonly host: HostIdentity;
      readonly source: SourcePath;
      readonly reason: string;
    }
  | { readonly kind: "neutral-source-unreadable"; readonly source: SourcePath; readonly reason: string }
  | {
      readonly kind: "plugin-emit-failed";
      readonly plugin: PluginId;
      readonly host: DistributionId;
      readonly reason: string;
    }
  | {
      readonly kind: "plugin-hook-template-unreadable";
      readonly within: string;
      readonly code: UnreadableTreeFile["code"];
    };

export type Projection = {
  readonly host: HostIdentity;
  readonly files: readonly ProjectedFile[];
  readonly findings: readonly ProjectionFinding[];
};

export type CompiledMethodFiles = {
  readonly graph: string;
  readonly grid: string;
};
