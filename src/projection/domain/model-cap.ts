import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";

export type BuildMode = "build" | "check";

export type ModelCapSource = "environment" | "memory";

export type EnvironmentCapUse = "applied" | "ignored" | "unset";

export type ModelCapReading = {
  readonly cap: Tier | null;
  readonly source: ModelCapSource | null;
  readonly environment: EnvironmentCapUse;
};

export type ResolveModelCap = (mode: BuildMode) => ModelCapReading;
