import type { DistributionId, RelativePath } from "../../kernel/values.ts";
import type { HarnessProfile } from "./harness-profile.ts";
import type { ProjectedFile, ProjectionOrigin } from "./projected-file.ts";
import type { RootIntegration } from "./root-integration.ts";

export type ProjectionFinding =
  | {
      readonly kind: "unresolved-token";
      readonly path: RelativePath;
      readonly token: string;
    }
  | {
      readonly kind: "concept-not-rendered";
      readonly concept: string;
      readonly name: string;
      readonly reason: string;
    };

export type ProjectionRefusal =
  | { readonly kind: "unknown-harness"; readonly harness: string }
  | {
      readonly kind: "path-collision";
      readonly path: RelativePath;
      readonly origins: readonly [ProjectionOrigin, ProjectionOrigin];
    }
  | {
      readonly kind: "path-outside-harness";
      readonly path: RelativePath;
      readonly origin: ProjectionOrigin;
    }
  | {
      readonly kind: "render-failed";
      readonly concept: string;
      readonly name: string;
      readonly reason: string;
    };

export type Projection = {
  readonly harness: DistributionId;
  readonly profile: HarnessProfile;
  readonly files: readonly ProjectedFile[];
  readonly rootIntegrations: readonly RootIntegration[];
  readonly managedDirectories: readonly RelativePath[];
  readonly findings: readonly ProjectionFinding[];
};
