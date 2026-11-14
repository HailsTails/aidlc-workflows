import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { Agent, TieredModel } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { Tier } from "../../../workflow-definition/domain/vocabulary.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { DistributionChannel } from "../../domain/projected-file.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { CopyChannelAllows } from "./copy-channel.ts";
import type { DelegateShellFacts } from "./delegate-shell.ts";
import type { Harness, Rendering } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";

export type AgentModelPolicy = (request: {
  readonly host: HostIdentity;
  readonly agent: AgentSlug;
  readonly model: TieredModel;
}) => Result<string | undefined, ProjectionRefusal>;

export type AgentPersonaRequest = {
  readonly agent: Agent;
  readonly text: "authored-file" | "persona-body";
  readonly knowledge: "absorbed" | "preflight-only";
  readonly reading: "whole-files" | "in-parts";
};

export type AgentPersonaPreparer = (request: AgentPersonaRequest) => Result<string, ProjectionRefusal>;

export type MarkdownEffortKey = "effort" | "variant" | "effortLevel";

export type AgentFrontmatter = {
  readonly model: "projected" | "omitted";
  readonly effortKey: MarkdownEffortKey;
  readonly modelQuoting: "plain" | "quoted";
  readonly insertBeforeKeys: readonly string[];
  readonly removeKeys: readonly string[];
  readonly afterProjectionLines: readonly string[];
};

export type AgentDocumentRequest = AgentPersonaRequest & {
  readonly frontmatter: AgentFrontmatter;
};

export type AgentDocumentSurface = (request: AgentDocumentRequest) => Result<string, ProjectionRefusal>;

export type AgentRenderingInputs = {
  readonly tokens: TokenBindings;
  readonly persona: AgentPersonaPreparer;
  readonly documents: AgentDocumentSurface;
  readonly modelCap: Tier | null;
  readonly method: Method;
  readonly host: HostIdentity;
  readonly channel: DistributionChannel;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly models: AgentModelPolicy;
  readonly formatDocuments: ReadonlySet<string>;
  readonly allows: CopyChannelAllows;
  readonly delegateShellFacts: DelegateShellFacts;
};

export type HostAgentRenderer = (
  inputs: AgentRenderingInputs,
) => Pick<Harness, "renderAgent" | "renderConductorAgent">;

export type AgentProjectionRequest = {
  readonly rulesFolder: string | null;
  readonly reviewerAgents: ReadonlySet<AgentSlug>;
  readonly tokens: TokenBindings;
  readonly sources: readonly MethodSource[];
  readonly method: Method;
  readonly render: HostAgentRenderer;
  readonly host: HostIdentity;
  readonly channel: DistributionChannel;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly modelCap: Tier | null;
};

export type AgentProjection = (request: AgentProjectionRequest) => Rendering;
