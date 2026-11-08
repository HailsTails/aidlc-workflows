import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { Agent } from "../../workflow-definition/domain/agent.ts";
import type { HookDeclaration } from "../../workflow-definition/domain/hooks.ts";
import type { KnowledgeDocument } from "../../workflow-definition/domain/knowledge.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { MethodSourceRoot } from "../../workflow-definition/domain/method-source.ts";
import type { Scope } from "../../workflow-definition/domain/scope.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { ScopeColumn, StageNode } from "../../workflow-definition/domain/stage-graph.ts";
import type {
  NeutralDocument,
  NeutralSurface,
  OnboardingTemplates,
  SessionSkill,
} from "../domain/neutral-surface.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { TokenBindings } from "../domain/template-token.ts";

export type Rendering = Result<readonly ProjectedFile[], ProjectionRefusal>;

export interface Harness {
  readonly distribution: DistributionId;
  readonly methodSourceRoot: MethodSourceRoot;
  readonly tokens: TokenBindings;
  renderAgent(request: {
    readonly agent: Agent;
    readonly knowledge: readonly KnowledgeDocument[];
  }): Rendering;
  renderStageCommand(request: { readonly stage: Stage; readonly node: StageNode }): Rendering;
  renderScopeCommand(request: { readonly scope: Scope; readonly column: ScopeColumn }): Rendering;
  renderOrchestratorSkill(request: { readonly method: Method }): Rendering;
  renderSessionSkill(request: { readonly skill: SessionSkill }): Rendering;
  renderHookRegistrations(request: { readonly hooks: readonly HookDeclaration[] }): Rendering;
  renderOnboarding(request: {
    readonly templates: OnboardingTemplates;
    readonly method: Method;
  }): Rendering;
  placeNeutralDocument(request: { readonly document: NeutralDocument }): Rendering;
}

export interface HarnessRegistry {
  find(id: DistributionId): Result<Harness, ProjectionRefusal>;
  all(): readonly Harness[];
}

export interface NeutralSurfaceReader {
  read(): Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;
}
