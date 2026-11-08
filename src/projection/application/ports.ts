import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { Agent } from "../../workflow-definition/domain/agent.ts";
import type { KnowledgeDocument } from "../../workflow-definition/domain/knowledge.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Scope } from "../../workflow-definition/domain/scope.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { ScopeColumn, StageNode } from "../../workflow-definition/domain/stage-graph.ts";
import type { HarnessProfile } from "../domain/harness-profile.ts";
import type {
  HookEntry,
  NeutralDocument,
  NeutralSurface,
  OnboardingTemplates,
  SessionSkill,
} from "../domain/neutral-surface.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { RootIntegration } from "../domain/root-integration.ts";

export type Rendering = Result<readonly ProjectedFile[], ProjectionRefusal>;

export type NeutralDocumentRole = "protocol" | "stage" | "scope" | "rule" | "sensor" | "knowledge";

export interface Harness {
  readonly profile: HarnessProfile;
  readonly rootIntegrations: readonly RootIntegration[];
  renderAgent(request: {
    readonly agent: Agent;
    readonly knowledge: readonly KnowledgeDocument[];
  }): Rendering;
  renderStageCommand(request: { readonly stage: Stage; readonly node: StageNode }): Rendering;
  renderScopeCommand(request: { readonly scope: Scope; readonly column: ScopeColumn }): Rendering;
  renderOrchestratorSkill(request: { readonly method: Method }): Rendering;
  renderSessionSkill(request: { readonly skill: SessionSkill }): Rendering;
  renderHookRegistrations(request: { readonly hooks: readonly HookEntry[] }): Rendering;
  renderOnboarding(request: {
    readonly templates: OnboardingTemplates;
    readonly method: Method;
  }): Rendering;
  placeNeutralDocument(request: {
    readonly document: NeutralDocument;
    readonly role: NeutralDocumentRole;
  }): Rendering;
}

export interface HarnessRegistry {
  find(id: DistributionId): Result<Harness, ProjectionRefusal>;
  all(): readonly Harness[];
}

export interface NeutralSurfaceReader {
  read(): Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;
}
