import type { ProjectPath } from "../../kernel/values.ts";
import type {
  AgentSlug,
  ArtifactName,
  RuleId,
  StageSlug,
} from "../../workflow-definition/domain/identities.ts";
import type { Gate } from "./gate.ts";
import type { GuardRefusal } from "./guard.ts";
import type { UnitName } from "./identities.ts";
import type { ReviewAttempt } from "./review.ts";

export type ArtifactDestination = {
  readonly artifact: ArtifactName;
  readonly path: ProjectPath;
};

export type QuestionOption = {
  readonly label: string;
  readonly meaning: string;
};

export type Directive =
  | {
      readonly kind: "run-stage";
      readonly stage: StageSlug;
      readonly unit: UnitName | null;
      readonly lead: AgentSlug | null;
      readonly supports: readonly AgentSlug[];
      readonly produces: readonly ArtifactDestination[];
      readonly rules: readonly RuleId[];
    }
  | { readonly kind: "request-review"; readonly attempt: ReviewAttempt }
  | {
      readonly kind: "ask-person";
      readonly gate: Gate;
      readonly question: string;
      readonly options: readonly QuestionOption[];
    }
  | { readonly kind: "refused"; readonly refusal: GuardRefusal }
  | { readonly kind: "finished" };
