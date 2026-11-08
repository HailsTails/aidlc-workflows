import type { RelativePath } from "../../kernel/values.ts";

export type FileContent =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array };

export type RenderedConcept =
  | "agent"
  | "stage-command"
  | "scope-command"
  | "session-skill"
  | "orchestrator-skill"
  | "settings"
  | "hook-registration"
  | "onboarding"
  | "harness-profile"
  | "stage-graph";

export type ProjectionOrigin =
  | { readonly kind: "neutral"; readonly source: RelativePath }
  | { readonly kind: "harness-authored"; readonly source: RelativePath }
  | { readonly kind: "rendered"; readonly concept: RenderedConcept; readonly name: string };

export type Availability = "always" | "copy-only" | "native-only";

export type ProjectedFile = {
  readonly path: RelativePath;
  readonly content: FileContent;
  readonly executable: boolean;
  readonly origin: ProjectionOrigin;
  readonly availability: Availability;
};
