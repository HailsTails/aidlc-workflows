import type { ReleaseArtifact } from "./artifact.ts";

export type ReleaseArchives = { readonly runtime: ReleaseArtifact; readonly copyRuntime: ReleaseArtifact };
