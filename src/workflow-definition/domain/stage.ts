import type { NonEmptyArray } from "../../kernel/values.ts";
import type {
  AgentSlug,
  ArtifactName,
  Owner,
  SensorId,
  StageSlug,
} from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";
import type { AuthoredBody } from "./outline.ts";
import type {
  EnsembleMode,
  Phase,
  ProjectType,
  ReviewClass,
  SoloCapableMode,
  UnitKind,
} from "./vocabulary.ts";

export type AgentRef =
  | { readonly kind: "conductor" }
  | { readonly kind: "agent"; readonly agent: AgentSlug };

export type Participation =
  | {
      readonly mode: SoloCapableMode;
      readonly lead: AgentRef;
      readonly supports: readonly AgentSlug[];
    }
  | {
      readonly mode: EnsembleMode;
      readonly lead: AgentRef;
      readonly supports: NonEmptyArray<AgentSlug>;
    };

export type StageExecution = {
  readonly trigger: "always" | "conditional";
  readonly condition: string;
};

export type StageCardinality = { readonly kind: "once" } | { readonly kind: "per-unit" };

export type ArtifactProduction = {
  readonly artifact: ArtifactName;
  readonly obligation: "required" | "optional";
  readonly unitKinds: "all" | NonEmptyArray<UnitKind>;
};

export type ArtifactConsumption = {
  readonly artifact: ArtifactName;
  readonly required: boolean;
  readonly when: "always" | ProjectType;
  readonly cited: boolean;
};

export type ReviewPolicy = {
  readonly reviewer: AgentSlug;
  readonly artifact: ArtifactName;
  readonly maxIterations: number;
  readonly reviewClass: Exclude<ReviewClass, "none">;
};

export type SummaryConfirmation = "required" | "if-present" | "none";

export type StageActivation =
  | { readonly kind: "always" }
  | { readonly kind: "producer-in-plan"; readonly artifact: ArtifactName };

export type ComposerTarget = "iae" | "csu" | "ve" | "r" | "ua";

export type ComposerRole = "initialization" | "core" | "phase-gate" | "structural";

export type ComposerPrior = {
  readonly targets: readonly ComposerTarget[];
  readonly cost: 1 | 2 | 3 | 4 | 5 | null;
  readonly role: ComposerRole | null;
  readonly projectTypes: readonly ProjectType[];
};

export type StageBriefing = {
  readonly inputs: string;
  readonly outputs: string;
  readonly instructions: AuthoredBody;
};

export type Stage = {
  readonly slug: StageSlug;
  readonly source: MethodSourcePath;
  readonly displayName: string;
  readonly phase: Phase;
  readonly orderingHint: number | null;
  readonly owner: Owner;
  readonly execution: StageExecution;
  readonly participation: Participation;
  readonly cardinality: StageCardinality;
  readonly writesWorkspace: boolean;
  readonly produces: readonly ArtifactProduction[];
  readonly consumes: readonly ArtifactConsumption[];
  readonly requires: readonly StageSlug[];
  readonly sensors: readonly SensorId[];
  readonly review: ReviewPolicy | null;
  readonly summaryConfirmation: SummaryConfirmation;
  readonly activation: StageActivation;
  readonly composerPrior: ComposerPrior | null;
  readonly requiredSections: readonly string[];
  readonly briefing: StageBriefing;
};
