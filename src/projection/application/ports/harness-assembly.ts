import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { Tier } from "../../../workflow-definition/domain/vocabulary.ts";
import type { AuthoredHostFile, AuthoredPlacement } from "../../domain/host-surface.ts";
import type { OnboardingFills, SharedRuntime } from "../../domain/neutral-surface.ts";
import type { DistributionChannel } from "../../domain/projected-file.ts";
import type { CompiledMethodFiles, ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { HostAgentRenderer } from "./agents.ts";
import type { CommandPlacement } from "./commands.ts";
import type { HostDocumentRenderer } from "./documents.ts";
import type { Harness } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";
import type { HostDataRenderer } from "./host-surface.ts";
import type { HostSettingsRenderer } from "./settings.ts";
import type { HostSkillRenderer } from "./skills.ts";

export type HarnessRenderers = {
  readonly agents: HostAgentRenderer;
  readonly skills: HostSkillRenderer;
  readonly settings: HostSettingsRenderer;
  readonly documents: HostDocumentRenderer;
  readonly data: HostDataRenderer;
  readonly placements: readonly AuthoredPlacement[];
  readonly commandPlacement: CommandPlacement;
};

export type HarnessAssemblyRequest = {
  readonly method: Method;
  readonly sources: readonly MethodSource[];
  readonly host: HostIdentity;
  readonly renderers: HarnessRenderers;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
  readonly modelCap: Tier | null;
  readonly entrypoints: readonly SourcePath[];
  readonly fills: OnboardingFills;
  readonly bindingHeadings: readonly string[];
  readonly projectRoot: URL;
  readonly reviewerAgents: ReadonlySet<AgentSlug>;
  readonly runtime: SharedRuntime;
  readonly compiled: CompiledMethodFiles;
};

export type HarnessAssembly = (
  request: HarnessAssemblyRequest,
) => Promise<Result<Harness, readonly ProjectionRefusal[]>>;
