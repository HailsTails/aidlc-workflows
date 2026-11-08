import type { DistributionId, ProjectPath } from "../../kernel/values.ts";
import type { MethodSourceRoot } from "../../workflow-definition/domain/method-source.ts";
import type { ProjectedFile, ProjectionOrigin, RenderedConcept } from "./projected-file.ts";
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
    };

export type Projection = {
  readonly harness: DistributionId;
  readonly methodSourceRoot: MethodSourceRoot;
  readonly files: readonly ProjectedFile[];
  readonly findings: readonly ProjectionFinding[];
};
